import { Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  subtitle?: string;
  onClick?: () => void;
}

const sizes = {
  sm: { box: 'w-9 h-9 rounded-xl', icon: 18, title: 'text-base font-bold', sub: 'hidden sm:block text-[10px]' },
  md: { box: 'w-10 h-10 rounded-xl', icon: 20, title: 'text-lg font-bold', sub: 'text-[11px]' },
  lg: { box: 'p-2.5 rounded-xl', icon: 24, title: 'text-xl font-bold', sub: 'text-[10px] font-semibold uppercase tracking-widest' },
};

export function BrandLogo({ size = 'md', showSubtitle = true, subtitle, onClick }: BrandLogoProps) {
  const s = sizes[size];
  return (
    <Link to="/" className="flex items-center gap-3 min-w-0 group" onClick={onClick}>
      <div
        className={`${s.box} bg-gradient-to-br from-teal-500 via-teal-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-teal-500/30 group-hover:shadow-teal-500/40 group-hover:scale-[1.02] transition-all duration-300 shrink-0`}
      >
        <Stethoscope className="text-white" size={s.icon} strokeWidth={2.25} />
      </div>
      <div className="min-w-0 text-start">
        <span className={`${s.title} text-slate-900 dark:text-white block truncate leading-tight tracking-tight`}>
          Synoza
        </span>
        {showSubtitle && subtitle && (
          <span className={`${s.sub} text-slate-500 dark:text-slate-400 truncate block`}>{subtitle}</span>
        )}
      </div>
    </Link>
  );
}
