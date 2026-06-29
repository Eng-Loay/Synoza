import { prisma } from '../lib/prisma.js';
import {
  getQbankModule,
  getQbankModules,
  getQbankTerm,
  type QbankModuleDef,
} from '../data/qbankCatalog.js';

export type QbankModuleView = {
  id: string;
  nameEn: string;
  nameAr: string;
  specialtyEn: string;
  specialtyAr: string;
  subjects: string[];
  locked: boolean;
  owned: boolean;
  priceEgp?: number;
};

function toModuleView(mod: QbankModuleDef, purchased: boolean): QbankModuleView {
  const owned = purchased || !!mod.bundled;
  const unlocked = !!mod.free || owned;
  return {
    id: mod.id,
    nameEn: mod.nameEn,
    nameAr: mod.nameAr,
    specialtyEn: mod.specialtyEn,
    specialtyAr: mod.specialtyAr,
    subjects: mod.subjects,
    locked: !unlocked,
    owned,
    priceEgp: unlocked ? undefined : mod.priceEgp,
  };
}

export async function getUserEntitlements(userId: string, termId: string): Promise<Set<string>> {
  const rows = await prisma.qbankModuleEntitlement.findMany({
    where: { userId, termId },
    select: { moduleId: true },
  });
  return new Set(rows.map((r) => r.moduleId));
}

export async function userHasModuleAccess(userId: string, termId: string, moduleId: string): Promise<boolean> {
  const mod = getQbankModule(termId, moduleId);
  if (!mod) return false;
  if (mod.free) return true;
  const entitlements = await getUserEntitlements(userId, termId);
  return entitlements.has(moduleId) || !!mod.bundled;
}

export async function getModulesForUser(userId: string, termId: string) {
  const term = getQbankTerm(termId);
  const catalog = getQbankModules(termId);
  if (!term || catalog.length === 0) {
    return { term: null, modules: [] as QbankModuleView[] };
  }

  const entitlements = await getUserEntitlements(userId, termId);
  const modules = catalog.map((mod) => toModuleView(mod, entitlements.has(mod.id)));

  return {
    term: {
      id: term.id,
      titleEn: term.titleEn,
      titleAr: term.titleAr,
      modules: term.modules,
      questions: term.questions,
    },
    modules,
  };
}

export async function grantModuleAccess(userId: string, termId: string, moduleId: string) {
  return prisma.qbankModuleEntitlement.upsert({
    where: {
      userId_termId_moduleId: { userId, termId, moduleId },
    },
    create: { userId, termId, moduleId },
    update: {},
  });
}
