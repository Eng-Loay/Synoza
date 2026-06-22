import { Send, Phone, PhoneOff } from 'lucide-react';
import { VoiceMicButton } from './VoiceMicButton';

interface SimulationChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder: string;
  chatError?: string;
  isListening: boolean;
  isProcessing?: boolean;
  isMicSupported: boolean;
  onToggleMic: () => void;
  micListeningLabel: string;
  micNotSupportedLabel: string;
  micProcessingLabel?: string;
  micError?: string;
  isLiveCall?: boolean;
  isLiveCallBusy?: boolean;
  isLiveCallSupported?: boolean;
  onToggleLiveCall?: () => void;
  liveCallLabel?: string;
  liveCallActiveLabel?: string;
  endLiveCallLabel?: string;
}

export function SimulationChatInput({
  input,
  setInput,
  onSend,
  sending,
  placeholder,
  chatError,
  isListening,
  isProcessing,
  isMicSupported,
  onToggleMic,
  micListeningLabel,
  micNotSupportedLabel,
  micProcessingLabel,
  micError,
  isLiveCall,
  isLiveCallBusy,
  isLiveCallSupported,
  onToggleLiveCall,
  liveCallLabel,
  liveCallActiveLabel,
  endLiveCallLabel,
}: SimulationChatInputProps) {
  return (
    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
      {chatError && <p className="text-xs text-red-500 mb-2">{chatError}</p>}
      {micError && <p className="text-xs text-red-500 mb-2">{micError}</p>}
      {isProcessing && (
        <p className="text-xs text-primary mb-2 animate-pulse">{micProcessingLabel ?? '…'}</p>
      )}
      {isListening && !isProcessing && (
        <p className="text-xs text-primary mb-2">{micListeningLabel}</p>
      )}
      {isLiveCall && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {isLiveCallBusy ? '...' : liveCallActiveLabel}
        </p>
      )}

      <div className="flex gap-2 items-center">
        <input
          className="input-field flex-1 min-w-0"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          disabled={sending || isLiveCall || isProcessing}
        />
        <VoiceMicButton
          isListening={isListening || !!isProcessing}
          isSupported={isMicSupported}
          disabled={sending || isLiveCall || isProcessing}
          onClick={onToggleMic}
          listeningLabel={micListeningLabel}
          notSupportedLabel={micNotSupportedLabel}
        />
        {onToggleLiveCall && (
          <button
            type="button"
            onClick={onToggleLiveCall}
            disabled={sending || !isLiveCallSupported}
            title={isLiveCall ? endLiveCallLabel : liveCallLabel}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
              isLiveCall
                ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 animate-pulse'
                : isLiveCallSupported
                  ? 'bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700'
                  : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed opacity-60'
            }`}
          >
            {isLiveCall ? <PhoneOff size={16} /> : <Phone size={16} />}
          </button>
        )}
        <button
          type="button"
          onClick={onSend}
          disabled={sending || isLiveCall || !input.trim()}
          className="w-11 h-11 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary-dark disabled:opacity-50 shrink-0"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
