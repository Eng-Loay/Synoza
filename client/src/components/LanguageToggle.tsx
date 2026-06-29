import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export function LanguageToggle({
  className = '',
  variant = 'default',
}: {
  className?: string;
  variant?: 'default' | 'icon';
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');

  const toggleLang = () => {
    const next = isAr ? 'en' : 'ar';
    i18n.changeLanguage(next);
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
  };

  const iconClass =
    variant === 'icon'
      ? 'p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors'
      : 'flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-primary transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800';

  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label={isAr ? 'Switch to English' : 'Switch to Arabic'}
      title={isAr ? 'English' : 'العربية'}
      className={`${iconClass} ${className}`}
    >
      <Globe size={variant === 'icon' ? 18 : 14} />
      {variant === 'default' && (isAr ? 'EN' : 'AR')}
    </button>
  );
}
