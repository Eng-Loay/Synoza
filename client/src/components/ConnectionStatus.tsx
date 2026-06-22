import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Wifi, WifiOff, ServerCrash } from 'lucide-react';
import { pingServer } from '../lib/api';
import { LanguageToggle } from './LanguageToggle';

type Status = 'online' | 'unstable' | 'server-offline' | 'internet-offline';

export function ConnectionStatus() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('online');
  const [latency, setLatency] = useState(0);

  const check = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus('internet-offline');
      setLatency(-1);
      return;
    }

    const result = await pingServer();
    if (!result.online) {
      setStatus('server-offline');
      setLatency(-1);
    } else if (result.latencyMs > 500) {
      setStatus('unstable');
      setLatency(result.latencyMs);
    } else {
      setStatus('online');
      setLatency(result.latencyMs);
    }
  }, []);

  useEffect(() => {
    check();
    const intervalMs = status === 'server-offline' || status === 'internet-offline' ? 4000 : 15000;
    const interval = setInterval(check, intervalMs);
    window.addEventListener('online', check);
    window.addEventListener('offline', check);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', check);
      window.removeEventListener('offline', check);
      window.removeEventListener('focus', check);
    };
  }, [check, status]);

  const statusConfig = {
    online: {
      color: 'bg-green-500',
      text: t('connectionStable'),
      title: t('connectionStable'),
      Icon: Wifi,
    },
    unstable: {
      color: 'bg-yellow-500',
      text: t('connectionUnstable'),
      title: t('connectionUnstable'),
      Icon: Wifi,
    },
    'server-offline': {
      color: 'bg-amber-500',
      text: t('connectionServerOffline'),
      title: t('serverOfflineHint'),
      Icon: ServerCrash,
    },
    'internet-offline': {
      color: 'bg-red-500',
      text: t('connectionNoInternet'),
      title: t('connectionNoInternet'),
      Icon: WifiOff,
    },
  };

  const { color, text, title, Icon } = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <LanguageToggle />

      <div
        title={title}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs cursor-default"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${color} animate-pulse`} />
        <Icon size={12} className="text-slate-400" />
        <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">{text}</span>
        {latency >= 0 && <span className="text-slate-400 hidden md:inline">{latency}ms</span>}
      </div>
    </div>
  );
}
