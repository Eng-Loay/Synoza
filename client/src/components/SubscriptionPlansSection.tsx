import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CreditCard, Crown, Loader2, Phone, Sparkles, Zap } from 'lucide-react';
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
}

interface SubscriptionPlansSectionProps {
  entitlements: EntitlementsSummary;
  plans: PlanOption[];
  isAr: boolean;
}

const PLAN_STYLE: Record<
  string,
  {
    tierKey: string;
    nameKey: string;
    badgeKey?: 'mostPopular' | 'bestValue';
    theme: 'slate' | 'teal' | 'indigo';
  }
> = {
  PACKAGE_50: { tierKey: 'planTier1', nameKey: 'planNameStarter', theme: 'slate' },
  PACKAGE_150: { tierKey: 'planTier2', nameKey: 'planNamePro', badgeKey: 'mostPopular', theme: 'teal' },
  PACKAGE_300: { tierKey: 'planTier3', nameKey: 'planNameElite', badgeKey: 'bestValue', theme: 'indigo' },
};

const THEME = {
  slate: {
    border: 'border-slate-300 dark:border-slate-600',
    bg: 'bg-white dark:bg-slate-900',
    badge: '',
    tagline: 'text-slate-600 dark:text-slate-300',
    btn: 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white',
    ring: '',
  },
  teal: {
    border: 'border-teal-400 dark:border-teal-500',
    bg: 'bg-gradient-to-b from-teal-50/80 to-white dark:from-teal-950/40 dark:to-slate-900',
    badge: 'bg-teal-500 text-white',
    tagline: 'text-teal-700 dark:text-teal-300',
    btn: 'bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/25',
    ring: 'ring-2 ring-teal-400/40 dark:ring-teal-500/30',
  },
  indigo: {
    border: 'border-indigo-400 dark:border-indigo-500',
    bg: 'bg-gradient-to-b from-indigo-50/80 to-white dark:from-indigo-950/40 dark:to-slate-900',
    badge: 'bg-indigo-600 text-white',
    tagline: 'text-indigo-700 dark:text-indigo-300',
    btn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25',
    ring: 'ring-2 ring-indigo-400/40 dark:ring-indigo-500/30',
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

export function SubscriptionPlansSection({ entitlements, plans, isAr }: SubscriptionPlansSectionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState('');

  const handleCheckout = async (planId: string) => {
    setCheckoutError('');
    setCheckoutPlanId(planId);
    try {
      const res = await api.post('/payments/checkout', { planId });
      const { merchantOrderId, iframeUrl, provider } = res.data as {
        merchantOrderId: string;
        iframeUrl?: string;
        provider?: string;
      };
      if (iframeUrl) {
        sessionStorage.setItem(`synoza_checkout_${merchantOrderId}`, iframeUrl);
      }
      navigate(`/student/payment/checkout?order=${encodeURIComponent(merchantOrderId)}`, {
        state: { iframeUrl, provider },
      });
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setCheckoutError(code === 'PAYMOB_NOT_CONFIGURED' ? t('paymentGatewayNotReady') : t('paymentCheckoutFailed'));
      setCheckoutPlanId(null);
    }
  };

  const featureKeys = [
    'planFeatureAiPatient',
    'planFeatureExaminer',
    'planFeatureUnlimitedRetries',
    'planFeatureReports',
    'planFeatureRandom',
  ] as const;

  if (!entitlements.isFree) {
    const planLabel = entitlements.plan.replace('PACKAGE_', '');
    return (
      <section className="relative overflow-hidden rounded-2xl border border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-50 via-white to-indigo-50/50 dark:from-teal-950/30 dark:via-slate-900 dark:to-indigo-950/20 p-6 sm:p-8">
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
            <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 px-4 py-3 min-w-[120px]">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('casesUnlockedLabel')}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {entitlements.casesUnlocked}/{entitlements.casesQuota}
              </p>
            </div>
            <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-200 dark:border-emerald-800 px-4 py-3 min-w-[120px]">
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('casesRemainingLabel')}</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {t('casesRemaining', { count: entitlements.casesRemaining })}
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="text-center sm:text-start">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 text-xs font-semibold mb-3">
          <Sparkles size={14} />
          {t('subscriptionHeroBadge')}
        </div>
        <h2 className="text-heading text-2xl sm:text-3xl mb-2">{t('subscriptionHeroTitle')}</h2>
        <p className="text-body text-sm sm:text-base max-w-2xl mx-auto sm:mx-0">{t('subscriptionHeroDesc')}</p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          {t('currentPlan')}:{' '}
          <span className="font-bold text-teal-700 dark:text-teal-300">{t('planFree')}</span>
          <span className="mx-2 text-slate-300">·</span>
          {t('planFreeDesc')}
        </p>
      </div>

      {checkoutError && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
          {checkoutError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {plans.map((plan) => {
          const style = PLAN_STYLE[plan.id] ?? PLAN_STYLE.PACKAGE_50;
          const theme = THEME[style.theme];
          const planName = t(style.nameKey);
          const casesCount = plan.casesQuota;

          return (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border-2 p-5 sm:p-6 ${theme.border} ${theme.bg} ${theme.ring} shadow-sm hover:shadow-xl transition-shadow duration-300`}
            >
              {style.badgeKey && (
                <span
                  className={`absolute -top-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md ${theme.badge}`}
                >
                  {t(style.badgeKey)}
                </span>
              )}

              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-1">
                {t(style.tierKey)}
              </p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">{planName}</h3>

              <div className="mb-4">
                <span className="text-4xl sm:text-[2.75rem] font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {plan.priceEgp}
                </span>
                <span className="text-base font-semibold text-slate-500 dark:text-slate-400 ms-1.5">{t('egp')}</span>
              </div>

              <p className={`text-base sm:text-lg font-bold mb-2 ${theme.tagline}`}>
                {t('planTaglineCases', { count: casesCount })}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                {t('planFeatureDuration', { count: plan.durationMonths })}
              </p>

              <ul className="space-y-3 mb-5 flex-1">
                <li className="flex items-start gap-2.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <Check size={18} className="text-emerald-500 shrink-0 mt-0.5" strokeWidth={2.5} />
                  {t('planFeatureCasesCount', { count: casesCount })}
                </li>
                {featureKeys.map((key) => (
                  <li key={key} className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                    <Check size={18} className="text-emerald-500 shrink-0 mt-0.5" strokeWidth={2.5} />
                    {t(key)}
                  </li>
                ))}
              </ul>

              <p className="text-[11px] italic text-slate-400 dark:text-slate-500 mb-4 leading-relaxed">
                {t('planUsageRule')}
              </p>

              <button
                type="button"
                onClick={() => void handleCheckout(plan.id)}
                disabled={checkoutPlanId !== null}
                className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold uppercase tracking-wide transition-all hover:-translate-y-0.5 disabled:opacity-70 ${theme.btn}`}
              >
                {checkoutPlanId === plan.id ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {t('paymentProcessing')}
                  </>
                ) : (
                  <>
                    <CreditCard size={18} />
                    {t('payNow', { plan: planName })}
                  </>
                )}
              </button>
            </article>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <IconBox icon={Zap} variant="soft" size="md" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white text-sm">{t('paymentHelpTitle')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('paymentSecureDesc')}
            </p>
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
