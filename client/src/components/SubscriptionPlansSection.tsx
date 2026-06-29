import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, Loader2, Phone, Play, Sparkles, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconBox } from './IconBox';
import api from '../lib/api';

export interface PlanOption {
  id: string;
  priceEgp: number;
  casesQuota: number;
  durationMonths: number;
  labelEn: string;
  labelAr: string;
}

export interface EntitlementsSummary {
  plan: string;
  isFree: boolean;
  casesQuota: number;
  casesUnlocked: number;
  casesRemaining: number;
  freeAttemptsPerCase?: number;
  attemptsByCase?: Record<string, number>;
}

interface FreeTierCase {
  id: string;
  titleEn: string;
  titleAr: string;
  chiefComplaint: string;
}

interface SubscriptionPlansSectionProps {
  entitlements: EntitlementsSummary;
  plans: PlanOption[];
  isAr: boolean;
}

type FeatureKey = string;

const PLAN_STYLE: Record<
  string,
  {
    tierKey: string;
    nameKey: string;
    purchaseKey: string;
    badgeKey?: 'mostPopular' | 'bestValue';
    theme: 'slate' | 'blue' | 'teal' | 'purple';
    tierColor: string;
    quoteColor: string;
    checkColor: string;
    featureKeys: FeatureKey[];
  }
> = {
  FREE: {
    tierKey: 'planTier0',
    nameKey: 'planNameFree',
    purchaseKey: 'planCurrentPlan',
    theme: 'slate',
    tierColor: 'text-slate-600',
    quoteColor: 'text-emerald-600',
    checkColor: 'text-emerald-500',
    featureKeys: [
      'planFreeFeatureCases',
      'planFreeFeatureAiPatient',
      'planFreeFeatureAiExaminer',
      'planFreeFeatureFeedback',
    ],
  },
  PACKAGE_50: {
    tierKey: 'planTier1',
    nameKey: 'planNameBasic',
    purchaseKey: 'purchaseBasicPlan',
    theme: 'blue',
    tierColor: 'text-blue-600',
    quoteColor: 'text-blue-600',
    checkColor: 'text-blue-500',
    featureKeys: [
      'planBasicFeatureCases',
      'planBasicFeatureAiPatient',
      'planBasicFeatureAiExaminer',
      'planBasicFeatureVoice',
      'planBasicFeatureReasoning',
      'planBasicFeatureFeedback',
    ],
  },
  PACKAGE_150: {
    tierKey: 'planTier2',
    nameKey: 'planNamePro',
    purchaseKey: 'purchaseProPlan',
    badgeKey: 'mostPopular',
    theme: 'teal',
    tierColor: 'text-teal-600',
    quoteColor: 'text-teal-600',
    checkColor: 'text-teal-500',
    featureKeys: [
      'planProFeatureCases',
      'planProFeatureIncludesBasic',
      'planProFeatureSpecialties',
      'planProFeatureTracking',
      'planProFeatureFeedback',
    ],
  },
  PACKAGE_300: {
    tierKey: 'planTier3',
    nameKey: 'planNamePremium',
    purchaseKey: 'purchasePremiumPlan',
    badgeKey: 'bestValue',
    theme: 'purple',
    tierColor: 'text-violet-600',
    quoteColor: 'text-blue-600',
    checkColor: 'text-violet-500',
    featureKeys: [
      'planPremiumFeatureCases',
      'planPremiumFeatureIncludesPro',
      'planPremiumFeatureFullAccess',
      'planPremiumFeatureExtended',
      'planPremiumFeatureAnalytics',
    ],
  },
};

const THEME = {
  slate: {
    border: 'border-emerald-300 dark:border-emerald-700',
    bg: 'bg-white dark:bg-slate-800/95',
    badge: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white',
    btn: 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-default shadow-none',
    btnActive: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25',
    ring: 'ring-2 ring-emerald-400/30 dark:ring-emerald-700/40',
  },
  blue: {
    border: 'border-blue-400 dark:border-blue-600',
    bg: 'bg-white dark:bg-slate-800/95',
    badge: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
    btn: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25',
    btnActive: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25',
    ring: '',
  },
  teal: {
    border: 'border-teal-400 dark:border-teal-600',
    bg: 'bg-white dark:bg-slate-800/95',
    badge: 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white',
    btn: 'bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/25',
    btnActive: 'bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/25',
    ring: '',
  },
  purple: {
    border: 'border-violet-400 dark:border-violet-600',
    bg: 'bg-white dark:bg-slate-800/95',
    badge: 'bg-gradient-to-r from-violet-500 to-purple-600 text-white',
    btn: 'bg-violet-700 hover:bg-violet-800 text-white shadow-lg shadow-violet-500/25',
    btnActive: 'bg-violet-700 hover:bg-violet-800 text-white shadow-lg shadow-violet-500/25',
    ring: '',
  },
};

const CONTACT_PHONE = '01024828652';
const WHATSAPP_URL = `https://wa.me/201024828652`;

function buildWhatsAppLink(planName: string, price: number, isAr: boolean) {
  const text = isAr
    ? `مرحباً، أريد تفعيل باقة ${planName} (${price} ج.م) على Synoza.`
    : `Hi, I want to activate the ${planName} plan (${price} EGP) on Synoza.`;
  return `${WHATSAPP_URL}?text=${encodeURIComponent(text)}`;
}

function featureLabel(key: FeatureKey, casesCount: number, t: ReturnType<typeof useTranslation>['t']) {
  if (key.includes('FeatureCases')) {
    return t(key, { count: casesCount });
  }
  return t(key);
}

export function SubscriptionPlansSection({ entitlements, plans, isAr }: SubscriptionPlansSectionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [freeCases, setFreeCases] = useState<FreeTierCase[]>([]);
  const [startingCaseId, setStartingCaseId] = useState<string | null>(null);

  const freeAttemptsPerCase = entitlements.freeAttemptsPerCase ?? 3;
  const attemptsByCase = entitlements.attemptsByCase ?? {};
  const totalAttemptsUsed = Object.values(attemptsByCase).reduce((sum, n) => sum + n, 0);
  const isNewFreeUser = entitlements.isFree && totalAttemptsUsed === 0;
  const freeCase = freeCases[0] ?? null;

  useEffect(() => {
    if (!entitlements.isFree) return;
    api.get('/cases', { params: { freeTier: 'true' } }).then((r) => setFreeCases(r.data.cases ?? [])).catch(() => {});
  }, [entitlements.isFree]);

  const getAttemptsLeft = (caseId: string) =>
    Math.max(0, freeAttemptsPerCase - (attemptsByCase[caseId] ?? 0));

  const startFreeCase = async (caseId: string) => {
    setStartingCaseId(caseId);
    try {
      const res = await api.post('/sessions/start', { caseId, language: 'AR' });
      navigate(`/simulation/${res.data.session.id}`);
    } catch {
      /* handled on simulation route */
    } finally {
      setStartingCaseId(null);
    }
  };

  const handleCheckout = async (planId: string) => {
    setCheckoutError('');
    setCheckoutPlanId(planId);
    try {
      const res = await api.post('/payments/checkout', { planId });
      const { merchantOrderId, iframeUrl, provider, status } = res.data as {
        merchantOrderId: string;
        iframeUrl?: string;
        provider?: string;
        status?: string;
      };
      if (status === 'PAID') {
        navigate(`/student/payment/success?order=${encodeURIComponent(merchantOrderId)}`);
        return;
      }
      if (iframeUrl) {
        sessionStorage.setItem(`synoza_checkout_${merchantOrderId}`, iframeUrl);
      }
      navigate(`/student/payment/checkout?order=${encodeURIComponent(merchantOrderId)}`, {
        state: { iframeUrl, provider },
      });
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setCheckoutError(code === 'PAYMOB_NOT_CONFIGURED' ? t('paymentGatewayNotReady') : t('paymentCheckoutFailed'));
    } finally {
      setCheckoutPlanId(null);
    }
  };

  if (!entitlements.isFree) {
    const planLabel = entitlements.plan.replace('PACKAGE_', '');
    return (
      <section className="relative overflow-hidden rounded-2xl border border-teal-200 dark:border-teal-800/60 bg-gradient-to-br from-teal-50 via-white to-indigo-50/50 dark:from-teal-950/30 dark:via-slate-900/80 dark:to-indigo-950/20 p-6 sm:p-8">
        <div className="absolute top-0 end-0 w-40 h-40 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" aria-hidden />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-start gap-4">
            <IconBox icon={Crown} variant="brand" size="xl" />
            <div>
              <p className="text-label mb-1">{t('subscriptionPlans')}</p>
              <h2 className="text-heading text-xl sm:text-2xl mb-1">
                {t('activePlanTitle', { plan: planLabel })}
              </h2>
              <p className="text-body text-sm">{t('activePlanDesc')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-4 py-3 min-w-[120px]">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('casesUnlockedLabel')}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {entitlements.casesUnlocked}/{entitlements.casesQuota}
              </p>
            </div>
            <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 border border-emerald-200 dark:border-emerald-800/60 px-4 py-3 min-w-[120px]">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('casesRemainingLabel')}</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                {t('casesRemaining', { count: entitlements.casesRemaining })}
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="subscription-plans" className="space-y-6">
      <div className="text-center sm:text-start">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 text-xs font-semibold mb-3">
          <Sparkles size={14} />
          {t('subscriptionHeroBadge')}
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">{t('subscriptionHeroTitle')}</h2>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto sm:mx-0">{t('subscriptionHeroDesc')}</p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          {t('currentPlan')}:{' '}
          <span className="font-bold text-teal-700 dark:text-teal-400">{t('planFree')}</span>
          <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
          {t('planFreeDesc')}
        </p>
      </div>

      {checkoutError && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
          {checkoutError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 max-w-xl mx-auto lg:max-w-none lg:grid-cols-2 xl:grid-cols-4">
        {(() => {
          const style = PLAN_STYLE.FREE;
          const theme = THEME[style.theme];
          const freeCaseCount = 3;
          const canStartFree = freeCase && getAttemptsLeft(freeCase.id) > 0;
          const showFreeCaseEmbed = isNewFreeUser && freeCase;

          return (
            <article
              className={`relative flex flex-col rounded-2xl border-2 p-6 ${theme.border} ${theme.bg} ${theme.ring} shadow-sm`}
            >
              <p className={`text-[11px] font-bold uppercase tracking-[0.14em] mb-1 ${style.tierColor}`}>
                {t(style.tierKey)}
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">{t(style.nameKey)}</h3>

              <div className="mb-4">
                <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">0</span>
                <span className="text-base font-semibold text-slate-600 dark:text-slate-400 ms-1.5">{t('planPriceSuffixFree')}</span>
              </div>

              <div className={`space-y-1 mb-5 ${style.quoteColor}`}>
                <p className="text-sm font-bold italic uppercase tracking-wide">
                  {t('planQuoteCases', { count: freeCaseCount })}
                </p>
                <p className="text-sm font-bold italic uppercase tracking-wide">{t('planQuoteValidityFree')}</p>
              </div>

              <ul className="space-y-3 mb-5 flex-1">
                {style.featureKeys.map((key) => (
                  <li key={key} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                    <Check size={18} className={`${style.checkColor} shrink-0 mt-0.5`} strokeWidth={2.5} />
                    {featureLabel(key, freeCaseCount, t)}
                  </li>
                ))}
              </ul>

              {showFreeCaseEmbed && (
                <div className="mb-5 rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-2">
                    {t('planFreeTrialCase')}
                  </p>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                    {isAr ? freeCase.titleAr : freeCase.titleEn}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">{freeCase.chiefComplaint}</p>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-3">
                    {t('attemptsRemaining', { count: getAttemptsLeft(freeCase.id) })}
                  </p>
                  <button
                    type="button"
                    onClick={() => void startFreeCase(freeCase.id)}
                    disabled={!canStartFree || startingCaseId !== null}
                    className={`w-full rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wide inline-flex items-center justify-center gap-2 transition-all ${
                      canStartFree ? theme.btnActive : theme.btn
                    }`}
                  >
                    {startingCaseId === freeCase.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Play size={16} />
                    )}
                    {startingCaseId === freeCase.id ? t('paymentProcessing') : t('planStartFreeOsce')}
                  </button>
                </div>
              )}

              <p className="text-[11px] italic text-slate-400 dark:text-slate-500 mb-5 leading-relaxed">{t('planUsageRuleFree')}</p>

              <button type="button" disabled className={`w-full rounded-xl px-4 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wide ${theme.btn}`}>
                {t(style.purchaseKey)}
              </button>
            </article>
          );
        })()}

        {plans.map((plan) => {
          const style = PLAN_STYLE[plan.id] ?? PLAN_STYLE.PACKAGE_50;
          const theme = THEME[style.theme];
          const planName = t(style.nameKey);
          const casesCount = plan.casesQuota;

          return (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border-2 p-6 ${theme.border} ${theme.bg} ${theme.ring} shadow-sm`}
            >
              {style.badgeKey && (
                <span
                  className={`absolute -top-3 end-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md ${theme.badge}`}
                >
                  {t(style.badgeKey)}
                </span>
              )}

              <p className={`text-[11px] font-bold uppercase tracking-[0.14em] mb-1 ${style.tierColor}`}>
                {t(style.tierKey)}
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4">{planName}</h3>

              <div className="mb-4">
                <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {plan.priceEgp}
                </span>
                <span className="text-base font-semibold text-slate-600 dark:text-slate-400 ms-1.5">
                  {t('planPriceSuffix', { months: plan.durationMonths })}
                </span>
              </div>

              <div className={`space-y-1 mb-5 ${style.quoteColor}`}>
                <p className="text-sm font-bold italic uppercase tracking-wide">
                  {t('planQuoteCases', { count: casesCount })}
                </p>
                <p className="text-sm font-bold italic uppercase tracking-wide">
                  {t('planQuoteValidity', { count: plan.durationMonths })}
                </p>
              </div>

              <ul className="space-y-3 mb-5 flex-1">
                {style.featureKeys.map((key) => (
                  <li key={key} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                    <Check size={18} className={`${style.checkColor} shrink-0 mt-0.5`} strokeWidth={2.5} />
                    {featureLabel(key, casesCount, t)}
                  </li>
                ))}
              </ul>

              <p className="text-[11px] italic text-slate-400 dark:text-slate-500 mb-5 leading-relaxed">
                {t('planUsageRuleCredit', { count: casesCount })}
              </p>

              <button
                type="button"
                onClick={() => void handleCheckout(plan.id)}
                disabled={checkoutPlanId !== null}
                className={`w-full rounded-xl px-4 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wide transition-all hover:-translate-y-0.5 disabled:opacity-70 ${theme.btn}`}
              >
                {checkoutPlanId === plan.id ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    {t('paymentProcessing')}
                  </span>
                ) : (
                  t(style.purchaseKey)
                )}
              </button>
            </article>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <IconBox icon={Zap} variant="soft" size="md" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white text-sm">{t('paymentHelpTitle')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('paymentSecureDesc')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`tel:+20${CONTACT_PHONE.replace(/^0/, '')}`}
            className="btn-secondary inline-flex items-center gap-2 text-sm px-4 py-2.5"
          >
            <Phone size={16} />
            {CONTACT_PHONE}
          </a>
          <a
            href={buildWhatsAppLink(t('planNamePro'), 300, isAr)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary inline-flex items-center gap-2 text-sm px-4 py-2.5"
          >
            WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}
