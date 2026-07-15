import { Loader2, Mic, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface LiveCallMicStatusProps {
  isLiveCall?: boolean;
  isBusy?: boolean;
  isMicListening?: boolean;
  isSpeaking?: boolean;
}

export function LiveCallMicStatus({
  isLiveCall,
  isBusy,
  isMicListening,
  isSpeaking,
}: LiveCallMicStatusProps) {
  const { t } = useTranslation();

  if (!isLiveCall) return null;

  let label = t('liveCallMicReady');
  let dotClass = 'bg-slate-400';
  let barClass = 'border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/80 dark:bg-emerald-950/30';
  let textClass = 'text-emerald-700 dark:text-emerald-300';
  let trailingIcon: 'mic' | 'volume' | 'spinner' = 'mic';

  if (isBusy) {
    label = t('liveCallMicProcessing');
    dotClass = 'bg-amber-500 animate-pulse';
    barClass = 'border-amber-100 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/30';
    textClass = 'text-amber-800 dark:text-amber-300';
    trailingIcon = 'spinner';
  } else if (isSpeaking) {
    label = t('liveCallMicSpeaking');
    dotClass = 'bg-violet-500 animate-pulse';
    barClass = 'border-violet-100 dark:border-violet-900/40 bg-violet-50/80 dark:bg-violet-950/30';
    textClass = 'text-violet-800 dark:text-violet-300';
    trailingIcon = 'volume';
  } else if (isMicListening) {
    label = t('liveCallMicActive');
    dotClass = 'bg-emerald-500 animate-pulse';
    trailingIcon = 'mic';
  }

  return (
    <div className={`px-4 py-2 border-t ${barClass}`}>
      <p className={`text-xs font-medium flex items-center gap-2 ${textClass}`}>
        {trailingIcon === 'volume' ? (
          <Volume2 size={14} className="shrink-0" />
        ) : (
          <Mic size={14} className="shrink-0" />
        )}
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} aria-hidden />
        <span className="flex-1">{label}</span>
        {trailingIcon === 'spinner' && (
          <Loader2 size={14} className="shrink-0 animate-spin" aria-hidden />
        )}
      </p>
    </div>
  );
}
