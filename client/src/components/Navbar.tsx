import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ConnectionStatus } from './ConnectionStatus';
import { ThemeToggle } from './ThemeToggle';
import { Activity, Menu, X } from 'lucide-react';

export function Navbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <nav className="sticky top-0 z-50 glass-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0" onClick={closeMobile}>
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-md shadow-teal-500/25 shrink-0">
              <Activity className="text-white" size={20} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-base sm:text-lg text-slate-900 dark:text-white block truncate">{t('appName')}</span>
              <span className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px] lg:max-w-xs">{t('tagline')}</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3">
            <ConnectionStatus />
            <ThemeToggle />
            {user ? (
              <>
                {user.role === 'STUDENT' && (
                  <Link to="/student" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    {t('dashboard')}
                  </Link>
                )}
                {user.role === 'ADMIN' && (
                  <Link to="/admin" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    {t('adminPanel')}
                  </Link>
                )}
                <button onClick={logout} className="btn-secondary text-sm">
                  {t('logout')}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  {t('login')}
                </Link>
                <Link to="/register" className="btn-primary text-sm">
                  {t('register')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              aria-label="Menu"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 md:hidden animate-fade-in" onClick={closeMobile} aria-hidden />
          <div className="absolute top-full left-0 right-0 z-50 md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xl animate-slide-down">
            <div className="px-4 py-4 space-y-1">
              <div className="pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                <ConnectionStatus />
              </div>
              {user ? (
                <>
                  {user.role === 'STUDENT' && (
                    <Link to="/student" onClick={closeMobile} className="block px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
                      {t('dashboard')}
                    </Link>
                  )}
                  {user.role === 'ADMIN' && (
                    <Link to="/admin" onClick={closeMobile} className="block px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
                      {t('adminPanel')}
                    </Link>
                  )}
                  <button onClick={() => { logout(); closeMobile(); }} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                    {t('logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={closeMobile} className="block px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">
                    {t('login')}
                  </Link>
                  <Link to="/register" onClick={closeMobile} className="block px-4 py-3 rounded-xl text-sm font-medium bg-primary text-white text-center mt-2">
                    {t('register')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
