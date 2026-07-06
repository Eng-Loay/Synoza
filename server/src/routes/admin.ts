import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { Role, type SubscriptionPlan } from '@prisma/client';
import {
  getPlanConfig,
  getUserEntitlements,
  getActiveSubscription,
  setUserSubscriptionPlan,
  PLAN_CATALOG,
} from '../services/subscriptionService.js';
import { clearAISettingsCache } from '../services/aiService.js';
import adminQbankRoutes from './adminQbank.js';

const router = Router();

router.use(authenticate);
router.use(authorize(Role.ADMIN));

router.get('/stats', async (_req, res) => {
  const [users, cases, sessions, completedSessions, avgScore] = await Promise.all([
    prisma.user.count(),
    prisma.case.count(),
    prisma.session.count(),
    prisma.session.count({ where: { status: 'COMPLETED' } }),
    prisma.result.aggregate({ _avg: { totalScore: true } }),
  ]);

  const recentSessions = await prisma.session.findMany({
    take: 10,
    orderBy: { startedAt: 'desc' },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      case: { select: { titleEn: true } },
    },
  });

  res.json({
    stats: {
      users,
      cases,
      sessions,
      completedSessions,
      averageScore: avgScore._avg.totalScore || 0,
    },
    recentSessions,
  });
});

router.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      university: true,
      createdAt: true,
      subscriptions: { take: 1, orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ users });
});

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  'FREE',
  'PACKAGE_50',
  'PACKAGE_150',
  'PACKAGE_300',
  'INSTITUTION',
];

router.get('/users/:userId/entitlements', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });

  const [entitlements, subscription] = await Promise.all([
    getUserEntitlements(user.id),
    getActiveSubscription(user.id),
  ]);

  res.json({
    user,
    entitlements,
    subscription,
    plans: SUBSCRIPTION_PLANS.map((id) => ({
      id,
      ...PLAN_CATALOG[id as keyof typeof PLAN_CATALOG],
    })),
  });
});

router.patch('/users/:id', async (req, res) => {
  const { role, isActive } = req.body;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role, isActive },
  });
  res.json({ user });
});

router.post('/users', async (req, res) => {
  const { email, password, firstName, lastName, role, university } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, firstName, lastName, role, university, emailVerified: true },
  });
  res.status(201).json({ user });
});

router.get('/specialties', async (_req, res) => {
  const specialties = await prisma.specialty.findMany({ orderBy: { nameEn: 'asc' } });
  res.json({ specialties });
});

router.post('/specialties', async (req, res) => {
  const specialty = await prisma.specialty.create({ data: req.body });
  res.status(201).json({ specialty });
});

router.put('/specialties/:id', async (req, res) => {
  const specialty = await prisma.specialty.update({ where: { id: req.params.id }, data: req.body });
  res.json({ specialty });
});

router.get('/difficulties', async (_req, res) => {
  const difficulties = await prisma.difficultyLevel.findMany({ orderBy: { level: 'asc' } });
  res.json({ difficulties });
});

router.post('/difficulties', async (req, res) => {
  const difficulty = await prisma.difficultyLevel.create({ data: req.body });
  res.status(201).json({ difficulty });
});

router.get('/cases', async (_req, res) => {
  const cases = await prisma.case.findMany({
    include: { specialty: true, difficulty: true, category: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ cases });
});

router.get('/cases/:id', async (req, res) => {
  const caseData = await prisma.case.findUnique({
    where: { id: req.params.id },
    include: { specialty: true, difficulty: true, category: true },
  });
  if (!caseData) return res.status(404).json({ error: 'Case not found' });
  res.json({ case: caseData });
});

router.get('/users/:userId/activity', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      university: true,
      createdAt: true,
    },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const [entitlements, subscription, sessions, caseAccess] = await Promise.all([
    getUserEntitlements(user.id),
    getActiveSubscription(user.id),
    prisma.session.findMany({
      where: { userId: user.id },
      include: {
        case: { select: { id: true, titleEn: true, titleAr: true } },
        result: { select: { totalScore: true, createdAt: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    }),
    prisma.caseAccess.findMany({
      where: { userId: user.id },
      include: { case: { select: { titleEn: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const totalAiTokens = sessions.reduce((sum, s) => sum + (s.aiTotalTokens ?? 0), 0);

  res.json({
    user,
    entitlements,
    subscription,
    caseAccess,
    totalAiTokens,
    sessions: sessions.map((s) => ({
      id: s.id,
      status: s.status,
      currentStage: s.currentStage,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      durationSeconds: s.durationSeconds,
      messageCount: s._count.messages,
      aiPromptTokens: s.aiPromptTokens,
      aiCompletionTokens: s.aiCompletionTokens,
      aiTotalTokens: s.aiTotalTokens,
      case: s.case,
      score: s.result?.totalScore ?? null,
    })),
  });
});

router.get('/results', async (_req, res) => {
  const results = await prisma.result.findMany({
    include: {
      session: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          case: { select: { titleEn: true, titleAr: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ results });
});

router.get('/ai-settings', async (_req, res) => {
  let settings = await prisma.aISettings.findFirst();
  if (!settings) settings = await prisma.aISettings.create({ data: {} });
  res.json({ settings });
});

router.put('/ai-settings', async (req, res) => {
  let settings = await prisma.aISettings.findFirst();
  if (!settings) settings = await prisma.aISettings.create({ data: {} });
  settings = await prisma.aISettings.update({ where: { id: settings.id }, data: req.body });
  clearAISettingsCache();
  res.json({ settings });
});

router.get('/audit-logs', async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
  });
  res.json({ logs });
});

router.get('/subscriptions', async (_req, res) => {
  const subscriptions = await prisma.subscription.findMany({
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ subscriptions });
});

router.patch('/subscriptions/:id', async (req, res) => {
  const { plan, status, endDate } = req.body;
  const data: Record<string, unknown> = {};
  if (status !== undefined) data.status = status;
  if (endDate !== undefined) data.endDate = endDate;
  if (plan !== undefined) {
    const config = getPlanConfig(plan);
    data.plan = plan;
    data.casesQuota = config.casesQuota;
    data.priceEgp = config.priceEgp;
  }
  const subscription = await prisma.subscription.update({
    where: { id: req.params.id },
    data,
  });
  res.json({ subscription });
});

router.post('/users/:userId/subscription', async (req, res) => {
  const { plan, endDate } = req.body;

  if (!plan || !SUBSCRIPTION_PLANS.includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.params.userId },
    select: { id: true, role: true },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role !== Role.STUDENT) {
    return res.status(400).json({ error: 'Only student accounts can have subscription plans assigned' });
  }

  try {
    const parsedEndDate = endDate ? new Date(endDate) : undefined;
    if (parsedEndDate && Number.isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({ error: 'Invalid end date' });
    }

    const subscription = await setUserSubscriptionPlan(user.id, plan as SubscriptionPlan, {
      endDate: parsedEndDate,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'SUBSCRIPTION_CHANGED',
        entity: 'User',
        entityId: user.id,
        details: JSON.stringify({
          plan,
          endDate: parsedEndDate?.toISOString() ?? null,
        }),
      },
    });

    const entitlements = await getUserEntitlements(user.id);
    res.json({ subscription, entitlements });
  } catch {
    return res.status(400).json({ error: 'Could not update subscription plan' });
  }
});

router.get('/categories', async (_req, res) => {
  const categories = await prisma.knowledgeCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    include: {
      _count: { select: { items: true, cases: true, children: true } },
      parent: { select: { id: true, nameEn: true, nameAr: true } },
    },
  });
  res.json({ categories });
});

router.post('/categories', async (req, res) => {
  const { nameEn, nameAr, description, parentId, sortOrder, isActive } = req.body;
  const category = await prisma.knowledgeCategory.create({
    data: { nameEn, nameAr, description, parentId: parentId || null, sortOrder, isActive },
  });
  res.status(201).json({ category });
});

router.put('/categories/:id', async (req, res) => {
  const { nameEn, nameAr, description, parentId, sortOrder, isActive } = req.body;
  const category = await prisma.knowledgeCategory.update({
    where: { id: req.params.id },
    data: {
      nameEn,
      nameAr,
      description,
      parentId: parentId === undefined ? undefined : parentId || null,
      sortOrder,
      isActive,
    },
  });
  res.json({ category });
});

router.delete('/categories/:id', async (req, res) => {
  const childCount = await prisma.knowledgeCategory.count({ where: { parentId: req.params.id } });
  if (childCount > 0) {
    return res.status(400).json({ error: 'Cannot delete category with subcategories' });
  }
  await prisma.knowledgeCategory.delete({ where: { id: req.params.id } });
  res.json({ message: 'Category deleted' });
});

router.get('/categories/:id/knowledge', async (req, res) => {
  const items = await prisma.knowledgeItem.findMany({
    where: { categoryId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items });
});

router.post('/knowledge', async (req, res) => {
  const { categoryId, titleEn, titleAr, content, type, isActive } = req.body;
  const item = await prisma.knowledgeItem.create({
    data: { categoryId, titleEn, titleAr, content, type, isActive },
  });
  res.status(201).json({ item });
});

router.put('/knowledge/:id', async (req, res) => {
  const item = await prisma.knowledgeItem.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json({ item });
});

router.delete('/knowledge/:id', async (req, res) => {
  await prisma.knowledgeItem.delete({ where: { id: req.params.id } });
  res.json({ message: 'Knowledge item deleted' });
});

router.get('/universities', async (_req, res) => {
  const universities = await prisma.partnerUniversity.findMany({
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
  });
  res.json({ universities });
});

router.get('/universities/:id', async (req, res) => {
  const university = await prisma.partnerUniversity.findUnique({ where: { id: req.params.id } });
  if (!university) return res.status(404).json({ error: 'University not found' });
  res.json({ university });
});

router.post('/universities', async (req, res) => {
  const { nameEn, nameAr, logoUrl, website, sortOrder, isActive } = req.body;
  if (!nameEn?.trim() || !nameAr?.trim()) {
    return res.status(400).json({ error: 'English and Arabic names are required' });
  }
  const university = await prisma.partnerUniversity.create({
    data: {
      nameEn: nameEn.trim(),
      nameAr: nameAr.trim(),
      logoUrl: logoUrl || null,
      website: website || null,
      sortOrder: sortOrder ?? 0,
      isActive: isActive ?? true,
    },
  });
  res.status(201).json({ university });
});

router.put('/universities/:id', async (req, res) => {
  const { nameEn, nameAr, logoUrl, website, sortOrder, isActive } = req.body;
  const existing = await prisma.partnerUniversity.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'University not found' });

  const university = await prisma.partnerUniversity.update({
    where: { id: req.params.id },
    data: {
      ...(nameEn !== undefined ? { nameEn: String(nameEn).trim() } : {}),
      ...(nameAr !== undefined ? { nameAr: String(nameAr).trim() } : {}),
      ...(logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
      ...(website !== undefined ? { website: website || null } : {}),
      ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) || 0 } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    },
  });
  res.json({ university });
});

router.delete('/universities/:id', async (req, res) => {
  await prisma.partnerUniversity.delete({ where: { id: req.params.id } });
  res.json({ message: 'University deleted' });
});

router.get('/site-settings', async (_req, res) => {
  let settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
  if (!settings) settings = await prisma.siteSettings.create({ data: { id: 'default' } });
  res.json({ settings });
});

router.put('/site-settings', async (req, res) => {
  let settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
  if (!settings) settings = await prisma.siteSettings.create({ data: { id: 'default' } });
  settings = await prisma.siteSettings.update({ where: { id: 'default' }, data: req.body });
  res.json({ settings });
});

router.use('/qbank', adminQbankRoutes);

export default router;
