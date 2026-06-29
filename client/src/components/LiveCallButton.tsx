import { Phone, PhoneOff } from 'lucide-react';

export interface LiveCallButtonProps {
  isLiveCall?: boolean;
  isLiveCallBusy?: boolean;
  isLiveCallSupported?: boolean;
  onToggleLiveCall?: () => void;
  liveCallLabel?: string;
  endLiveCallLabel?: string;
  disabled?: boolean;
}

export function LiveCallButton({
  isLiveCall,
  isLiveCallBusy,
  isLiveCallSupported,
  onToggleLiveCall,
  liveCallLabel = 'Live call',
  endLiveCallLabel = 'End call',
  disabled,
}: LiveCallButtonProps) {
  if (!onToggleLiveCall) return null;

  const label = isLiveCall ? endLiveCallLabel : liveCallLabel;

  return (
    <button
      type="button"
      onClick={onToggleLiveCall}
      disabled={(disabled && !isLiveCall) || isLiveCallBusy}
      title={label}
      className={`inline-flex items-center gap-1.5 shrink-0 font-semibold transition-all px-3 py-1.5 rounded-full text-xs ${
        isLiveCall
          ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 animate-pulse'
          : isLiveCallSupported
            ? 'bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700'
            : 'bg-slate-200 dark:bg-slate-700 text-slate-500 cursor-not-allowed opacity-60'
      }`}
    >
      {isLiveCall ? <PhoneOff size={14} /> : <Phone size={14} />}
      <span>{label}</span>
    </button>
  );
}
