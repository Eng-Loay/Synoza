import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { i18n } = useTranslation();

  const toggleLang = () => {
    const next = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(next);
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
  };

  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label={i18n.language === 'ar' ? 'Switch to English' : 'Switch to Arabic'}
      className={`flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-primary transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${className}`}
    >
      <Globe size={14} />
      {i18n.language === 'ar' ? 'EN' : 'AR'}
    </button>
  );
}
