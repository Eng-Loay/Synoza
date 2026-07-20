type SpeechLang = 'AUTO' | 'AR' | 'EN';

interface SpeechLanguageToggleProps {
  value: SpeechLang;
  onChange: (value: SpeechLang) => void;
  disabled?: boolean;
  labels: {
    auto: string;
    ar: string;
    en: string;
  };
}

const OPTIONS: SpeechLang[] = ['AUTO', 'AR', 'EN'];

export function SpeechLanguageToggle({
  value,
  onChange,
  disabled,
  labels,
}: SpeechLanguageToggleProps) {
  const labelFor = (opt: SpeechLang) => {
    if (opt === 'AUTO') return labels.auto;
    if (opt === 'AR') return labels.ar;
    return labels.en;
  };

  return (
    <div
      className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-0.5 shrink-0"
      role="group"
      aria-label="Speech language"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-semibold transition-colors disabled:opacity-50 ${
              active
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-700/70'
            }`}
          >
            {labelFor(opt)}
          </button>
        );
      })}
    </div>
  );
}
