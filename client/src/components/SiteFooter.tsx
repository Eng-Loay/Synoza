import { Link } from 'react-router-dom';
import { Phone, Mail, Activity, ArrowUpRight } from 'lucide-react';

export interface SiteSettings {
  footerTaglineEn: string;
  footerTaglineAr: string;
  contactPhone: string;
  contactEmail?: string | null;
  ctaTitleEn: string;
  ctaTitleAr: string;
  ctaSubtitleEn: string;
  ctaSubtitleAr: string;
}

interface SiteFooterProps {
  settings: SiteSettings;
  isAr: boolean;
  appName: string;
  contactLabel: string;
  getStartedLabel: string;
}

export function SiteCtaSection({ settings, isAr, getStartedLabel }: Pick<SiteFooterProps, 'settings' | 'isAr' | 'getStartedLabel'>) {
  return (
    <section className="relative py-16 sm:py-20 overflow-hidden border-y border-teal-900/30">
      <div className="absolute inset-0 cta-gradient" />
      <div className="absolute inset-0 opacity-25 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-teal-400/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl" />
      </div>
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center text-white animate-fade-in">
        <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 tracking-tight">
          {isAr ? settings.ctaTitleAr : settings.ctaTitleEn}
        </h3>
        <p className="text-teal-50/85 mb-8 text-sm sm:text-base lg:text-lg leading-relaxed">
          {isAr ? settings.ctaSubtitleAr : settings.ctaSubtitleEn}
        </p>
        <Link
          to="/register"
          className="group inline-flex items-center gap-2 bg-white text-primary px-8 py-3.5 rounded-xl font-semibold shadow-lg shadow-black/15 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
        >
          {getStartedLabel}
          <ArrowUpRight size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>
    </section>
  );
}

export function SiteFooter({ settings, isAr, appName, contactLabel }: Omit<SiteFooterProps, 'getStartedLabel'>) {
  const tagline = isAr ? settings.footerTaglineAr : settings.footerTaglineEn;

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-teal-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center">
                <Activity className="text-white" size={20} />
              </div>
              <span className="text-white font-bold text-xl">{appName}</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">{tagline}</p>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
              {isAr ? 'روابط سريعة' : 'Quick Links'}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/login" className="hover:text-white transition-colors">{isAr ? 'تسجيل الدخول' : 'Login'}</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">{isAr ? 'إنشاء حساب' : 'Register'}</Link></li>
              <li><a href="#about" className="hover:text-white transition-colors">{isAr ? 'عن المنصة' : 'About'}</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">{contactLabel}</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href={`tel:${settings.contactPhone}`} className="flex items-center gap-2.5 hover:text-white transition-colors group">
                  <span className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Phone size={16} className="text-teal-400" />
                  </span>
                  {settings.contactPhone}
                </a>
              </li>
              {settings.contactEmail && (
                <li>
                  <a href={`mailto:${settings.contactEmail}`} className="flex items-center gap-2.5 hover:text-white transition-colors group">
                    <span className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Mail size={16} className="text-teal-400" />
                    </span>
                    <span className="break-all">{settings.contactEmail}</span>
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {appName}. {isAr ? 'جميع الحقوق محفوظة' : 'All rights reserved.'}</p>
          <p>{isAr ? 'منصة تدريب OSCE بالذكاء الاصطناعي' : 'AI-Powered OSCE Training Platform'}</p>
        </div>
      </div>
    </footer>
  );
}
