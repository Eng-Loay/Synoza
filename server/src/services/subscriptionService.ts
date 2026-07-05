import type { SubscriptionPlan } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export const FREE_ATTEMPTS_PER_CASE = 3;

export const PLAN_CATALOG = {
  FREE: { priceEgp: 0, casesQuota: 0, durationMonths: 0, labelEn: 'Free', labelAr: 'مجاني' },
  PACKAGE_50: { priceEgp: 150, casesQuota: 50, durationMonths: 2, labelEn: 'Basic', labelAr: 'Basic' },
  PACKAGE_150: { priceEgp: 300, casesQuota: 150, durationMonths: 4, labelEn: 'Pro', labelAr: 'Pro' },
  PACKAGE_300: { priceEgp: 500, casesQuota: 300, durationMonths: 6, labelEn: 'Premium', labelAr: 'Premium' },
  INSTITUTION: { priceEgp: 0, casesQuota: 999_999, durationMonths: 0, labelEn: 'Institution', labelAr: 'مؤسسة' },
} as const;

export type PlanCatalogKey = keyof typeof PLAN_CATALOG;

export function isPaidPlan(plan: SubscriptionPlan): boolean {
  return plan === 'PACKAGE_50' || plan === 'PACKAGE_150' || plan === 'PACKAGE_300' || plan === 'INSTITUTION';
}

export function getPlanConfig(plan: SubscriptionPlan) {
  const key = plan in PLAN_CATALOG ? (plan as PlanCatalogKey) : 'FREE';
  return PLAN_CATALOG[key];
}

function addMonths(from: Date, months: number): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + months);
  return end;
}

async function resolvePlanEndDate(
  subscription: Awaited<ReturnType<typeof getActiveSubscription>>,
): Promise<Date | null> {
  if (!subscription || !isPaidPlan(subscription.plan)) return null;
  if (subscription.endDate) return subscription.endDate;

  const config = getPlanConfig(subscription.plan);
  const months = config.durationMonths || 12;
  const computed = addMonths(subscription.startDate, months);
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { endDate: computed },
  });
  return computed;
}

export async function getActiveSubscription(userId: string) {
  return prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
}

async function getEffectiveAttempts(userId: string, caseId: string) {
  const [access, sessionCount] = await Promise.all([
    prisma.caseAccess.findUnique({
      where: { userId_caseId: { userId, caseId } },
    }),
    prisma.session.count({ where: { userId, caseId } }),
  ]);
  return Math.max(access?.attempts ?? 0, sessionCount);
}

async function getUsedCaseCredits(userId: string, since?: Date | null) {
  return prisma.session.count({
    where: {
      userId,
      ...(since ? { startedAt: { gte: since } } : {}),
    },
  });
}

export async function getUserEntitlements(userId: string) {
  const subscription = await getActiveSubscription(userId);
  const plan = subscription?.plan ?? 'FREE';
  const config = getPlanConfig(plan);
  const isFree = !isPaidPlan(plan);
  const periodStart = !isFree && subscription?.startDate ? subscription.startDate : null;
  const casesUnlocked = await getUsedCaseCredits(userId, periodStart);
  const casesQuota = subscription?.casesQuota ?? config.casesQuota;

  const caseAccess = await prisma.caseAccess.findMany({
    where: { userId },
    select: { caseId: true, attempts: true },
  });

  const attemptsByCase: Record<string, number> = {};
  for (const row of caseAccess) {
    attemptsByCase[row.caseId] = row.attempts;
  }

  const sessionsByCase = await prisma.session.groupBy({
    by: ['caseId'],
    where: { userId },
    _count: { _all: true },
  });
  for (const row of sessionsByCase) {
    attemptsByCase[row.caseId] = Math.max(attemptsByCase[row.caseId] ?? 0, row._count._all);
  }

  const planEndDate = await resolvePlanEndDate(subscription);

  return {
    plan,
    isFree,
    freeAttemptsPerCase: FREE_ATTEMPTS_PER_CASE,
    casesQuota: isFree ? 0 : casesQuota,
    casesUnlocked,
    casesRemaining: isFree ? 0 : Math.max(0, casesQuota - casesUnlocked),
    priceEgp: subscription?.priceEgp ?? config.priceEgp,
    planEndDate: planEndDate?.toISOString() ?? null,
    planStartDate: subscription?.startDate?.toISOString() ?? null,
    planDurationMonths: isFree ? 0 : getPlanConfig(plan).durationMonths,
    attemptsByCase,
  };
}

export async function checkCanStartCase(userId: string, caseId: string) {
  const subscription = await getActiveSubscription(userId);
  const plan = subscription?.plan ?? 'FREE';
  const config = getPlanConfig(plan);

  if (!isPaidPlan(plan)) {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { isFreeTier: true },
    });
    if (!caseData?.isFreeTier) {
      return {
        allowed: false as const,
        code: 'SUBSCRIPTION_REQUIRED' as const,
      };
    }

    const attempts = await getEffectiveAttempts(userId, caseId);
    if (attempts >= FREE_ATTEMPTS_PER_CASE) {
      return {
        allowed: false as const,
        code: 'FREE_LIMIT_REACHED' as const,
        attempts,
        limit: FREE_ATTEMPTS_PER_CASE,
      };
    }
    return {
      allowed: true as const,
      attempts,
      attemptsRemaining: FREE_ATTEMPTS_PER_CASE - attempts,
    };
  }

  const periodStart = subscription?.startDate ?? null;
  const casesUnlocked = await getUsedCaseCredits(userId, periodStart);
  const quota = subscription?.casesQuota ?? config.casesQuota;
  if (casesUnlocked >= quota) {
    return {
      allowed: false as const,
      code: 'CASE_QUOTA_EXCEEDED' as const,
      casesUnlocked,
      casesQuota: quota,
    };
  }

  return {
    allowed: true as const,
    casesRemaining: quota - casesUnlocked,
  };
}

export async function recordCaseAttempt(userId: string, caseId: string) {
  await prisma.caseAccess.upsert({
    where: { userId_caseId: { userId, caseId } },
    create: { userId, caseId, attempts: 1 },
    update: { attempts: { increment: 1 } },
  });
}

export async function pickRandomEligibleCase(userId: string, categoryId?: string) {
  const subscription = await getActiveSubscription(userId);
  const plan = subscription?.plan ?? 'FREE';
  const freePlan = !isPaidPlan(plan);

  const cases = await prisma.case.findMany({
    where: {
      isPublished: true,
      ...(freePlan ? { isFreeTier: true } : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    include: { specialty: true, difficulty: true, category: true },
  });

  if (cases.length === 0) {
    return { ok: false as const, code: 'NO_CASES' as const };
  }

  const eligible = [];
  for (const caseData of cases) {
    const access = await checkCanStartCase(userId, caseData.id);
    if (access.allowed) eligible.push(caseData);
  }

  if (eligible.length === 0) {
    return { ok: false as const, code: 'NO_ELIGIBLE_CASES' as const };
  }

  const picked = eligible[Math.floor(Math.random() * eligible.length)];
  return { ok: true as const, case: picked, eligibleCount: eligible.length };
}

export async function activatePlan(
  userId: string,
  plan: SubscriptionPlan,
  options?: { endDate?: Date },
) {
  if (plan === 'FREE') {
    throw new Error('INVALID_PLAN');
  }

  const config = getPlanConfig(plan);
  if (!config.casesQuota) {
    throw new Error('INVALID_PLAN');
  }

  await prisma.subscription.updateMany({
    where: { userId, status: 'ACTIVE' },
    data: { status: 'CANCELLED', endDate: new Date() },
  });

  const endDate =
    options?.endDate ??
    (config.durationMonths > 0 ? addMonths(new Date(), config.durationMonths) : null);

  return prisma.subscription.create({
    data: {
      userId,
      plan,
      status: 'ACTIVE',
      casesQuota: config.casesQuota,
      priceEgp: config.priceEgp,
      endDate,
    },
  });
}

export async function setUserSubscriptionPlan(
  userId: string,
  plan: SubscriptionPlan,
  options?: { endDate?: Date },
) {
  if (plan === 'FREE') {
    await prisma.subscription.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'CANCELLED', endDate: new Date() },
    });
    return null;
  }

  return activatePlan(userId, plan, options);
}
