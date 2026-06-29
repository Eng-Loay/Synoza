import type { TFunction } from 'i18next';

export type PendingCaseStart =
  | { type: 'random'; categoryId?: string }
  | { type: 'station'; caseId: string };

interface EntitlementsLike {
  isFree: boolean;
  freeAttemptsPerCase: number;
  casesRemaining: number;
  attemptsByCase: Record<string, number>;
}

export function shouldConfirmCaseStart(
  entitlements: EntitlementsLike | null | undefined,
  pending: PendingCaseStart,
): boolean {
  if (!entitlements) return false;
  if (pending.type === 'random') return !entitlements.isFree;
  if (entitlements.isFree) {
    const used = entitlements.attemptsByCase[pending.caseId] ?? 0;
    return used < entitlements.freeAttemptsPerCase;
  }
  return (entitlements.attemptsByCase[pending.caseId] ?? 0) === 0;
}

export function startCaseConfirmMessage(
  t: TFunction,
  entitlements: EntitlementsLike | null | undefined,
  pending: PendingCaseStart | null,
): string {
  if (!entitlements || !pending) return '';

  if (entitlements.isFree) {
    const used =
      pending.type === 'station' ? (entitlements.attemptsByCase[pending.caseId] ?? 0) : 0;
    const left = Math.max(0, entitlements.freeAttemptsPerCase - used);
    return t('startCaseConfirmFreeMessage', { count: left });
  }

  const remaining = entitlements.casesRemaining;
  if (pending.type === 'random') {
    return t('startCaseConfirmRandomMessage', { count: remaining });
  }
  return t('startCaseConfirmNewCaseMessage', { count: remaining });
}
