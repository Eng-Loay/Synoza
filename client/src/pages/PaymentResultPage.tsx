import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import api from '../lib/api';
import { Navbar } from '../components/Navbar';
import { IconBox } from '../components/IconBox';

type PageMode = 'success' | 'failed';

export default function PaymentResultPage({ mode }: { mode: PageMode }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const [searchParams] = useSearchParams();
  const orderRef = searchParams.get('order') || '';

  const [loading, setLoading] = useState(!!orderRef);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<{
    status: string;
    planLabelEn?: string;
    planLabelAr?: string;
    amountEgp?: number;
  } | null>(null);

  useEffect(() => {
    if (!orderRef) {
      setLoading(false);
      if (mode === 'success') setError(t('paymentPending'));
      return;
    }

    const run = async () => {
      try {
        const res = await api.get(`/payments/orders/${encodeURIComponent(orderRef)}`);
        setOrder(res.data.order);

        if (mode === 'success' && res.data.order.status !== 'PAID') {
          setError(t('paymentPending'));
        }
      } catch {
        setError(t('paymentVerifyFailed'));
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [mode, orderRef, t]);

  const planLabel = order ? (isAr ? order.planLabelAr : order.planLabelEn) : '';

  return (
    <div className="min-h-screen auth-bg flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="card max-w-md w-full p-8 text-center shadow-xl">
          {loading ? (
            <>
              <Loader2 className="w-12 h-12 text-teal-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-300">{t('paymentProcessing')}</p>
            </>
          ) : mode === 'failed' || error ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-heading text-xl mb-2">{t('paymentFailedTitle')}</h1>
              <p className="text-body text-sm mb-6">{error || t('paymentFailedDesc')}</p>
              <Link to="/student" className="btn-primary inline-block px-6 py-3">
                {t('backToDashboard')}
              </Link>
            </>
          ) : (
            <>
              <IconBox icon={CheckCircle2} variant="brand" size="xl" className="mx-auto mb-4" />
              <h1 className="text-heading text-xl mb-2">{t('paymentSuccessTitle')}</h1>
              <p className="text-body text-sm mb-2">{t('paymentSuccessDesc')}</p>
              {planLabel && (
                <p className="text-sm font-semibold text-teal-700 dark:text-teal-300 mb-6">
                  {planLabel}
                  {order?.amountEgp ? ` · ${order.amountEgp} ${t('egp')}` : ''}
                </p>
              )}
              <Link to="/student" className="btn-primary inline-block px-6 py-3">
                {t('startTraining')}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
