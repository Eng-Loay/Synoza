import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Award,
  Bookmark,
  BookOpen,
  Crown,
  Headphones,
  Home,
  LineChart,
  Medal,
  NotebookPen,
  Settings,
  Stethoscope,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SynozaLogo } from '../../SynozaLogo';
import { QBANK } from '../../../lib/qbankTheme';
import { buildSupportWhatsAppUrl } from '../../../lib/supportContacts';

type NavItem = {
  path?: string;
  icon: LucideIcon;
  labelKey: string;
  end?: boolean;
  soon?: boolean;
};

const MAIN_NAV: NavItem[] = [
  { path: '/student', icon: Home, labelKey: 'portalNavHome', end: true },
  { path: '/student', icon: Stethoscope, labelKey: 'portalNavOsce' },
  { path: '/student/mcq', icon: BookOpen, labelKey: 'portalNavQbank' },
  { path: '/student/diagnostics', icon: LineChart, labelKey: 'portalNavDiagnostics' },
  { icon: Medal, labelKey: 'portalNavLeaderboard', soon: true },
  { icon: Bookmark, labelKey: 'portalNavSaved', soon: true },
  { icon: NotebookPen, labelKey: 'portalNavNotes', soon: true },
  { icon: Award, labelKey: 'portalNavAchievements', soon: true },
  { path: '/student/profile', icon: Settings, labelKey: 'portalNavSettings' },
];

interface QbankPortalSidebarProps {
  onNavigate?: () => void;
  isAr?: boolean;
}

export function QbankPortalSidebar({ onNavigate, isAr }: QbankPortalSidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const whatsappUrl = buildSupportWhatsAppUrl(!!isAr, 'qbank');

  const isActive = (path: string, end?: boolean) =>
    end ? location.pathname === path : location.pathname.startsWith(path);

  const isOsceActive = location.pathname.startsWith('/simulation');

  const navClass = (active: boolean, soon?: boolean) => {
    if (soon) {
      return 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 cursor-not-allowed';
    }
    if (active) {
      return 'flex items-center gap-3 py-2.5 pe-3 rounded-xl text-sm font-semibold transition-colors border-s-[3px]';
    }
    return 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors';
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white border-e border-slate-200">
      <div className="px-5 py-5 border-b border-slate-100 shrink-0">
        <SynozaLogo height={40} to="/student/mcq" onClick={onNavigate} />
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-0.5">
        {MAIN_NAV.map(({ path, icon: Icon, labelKey, end, soon }) => {
          let active = false;
          if (path && labelKey === 'portalNavOsce') active = isOsceActive;
          else if (path) active = isActive(path, end);
          const label = t(labelKey);

          if (soon || !path) {
            return (
              <div key={labelKey} className={navClass(false, true)} aria-disabled>
                <Icon size={18} className="text-slate-300 shrink-0" strokeWidth={1.75} />
                <span>{label}</span>
              </div>
            );
          }

          return (
            <Link
              key={labelKey}
              to={path}
              onClick={onNavigate}
              className={navClass(active)}
              style={
                active
                  ? {
                      backgroundColor: QBANK.light,
                      color: QBANK.primary,
                      borderColor: QBANK.primary,
                      paddingInlineStart: '9px',
                    }
                  : undefined
              }
            >
              <Icon
                size={18}
                className={active ? '' : 'text-slate-400'}
                style={active ? { color: QBANK.primary } : undefined}
                strokeWidth={active ? 2 : 1.75}
              />
              <span style={active ? { color: QBANK.primary } : undefined}>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 p-4 space-y-3 border-t border-slate-100 bg-white pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div
          className="rounded-2xl p-4 text-center border border-[#E4DFFF]"
          style={{ background: 'linear-gradient(180deg, #F5F3FF 0%, #EEF0FF 100%)' }}
        >
          <div
            className="w-10 h-10 rounded-xl mx-auto mb-2.5 flex items-center justify-center"
            style={{ backgroundColor: QBANK.light }}
          >
            <Crown size={20} style={{ color: QBANK.primary }} strokeWidth={1.75} />
          </div>
          <p className="font-bold text-sm mb-1" style={{ color: QBANK.heading }}>
            {t('portalGoPremium')}
          </p>
          <p className="text-[11px] leading-relaxed mb-3" style={{ color: QBANK.muted }}>
            {t('portalGoPremiumDesc')}
          </p>
          <Link
            to="/student/upgrade"
            onClick={onNavigate}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-white text-xs font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: QBANK.primary }}
          >
            {t('portalUpgradeNow')}
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Headphones size={16} className="text-slate-500" />
            <p className="text-sm font-semibold text-slate-800">{t('portalNeedHelp')}</p>
          </div>
          <p className="text-[11px] text-slate-500 mb-2">{t('portalNeedHelpDesc')}</p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold hover:underline"
            style={{ color: QBANK.primary }}
          >
            {t('portalContactSupport')} →
          </a>
        </div>
      </div>
    </div>
  );
}
