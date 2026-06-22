import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Brain, Stethoscope, ClipboardCheck, Sparkles, ArrowRight } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { AnimateOnScroll } from '../components/AnimateOnScroll';
import { PartnerUniversitiesSection } from '../components/PartnerUniversitiesSection';
import { SiteCtaSection, SiteFooter, type SiteSettings } from '../components/SiteFooter';
import { TypewriterText } from '../components/TypewriterText';
import { IconBox } from '../components/IconBox';
import api from '../lib/api';

const defaultSettings: SiteSettings = {
  footerTaglineEn: 'AI-Powered OSCE Medical Training Platform',
  footerTaglineAr: 'منصة التدريب الطبي بالذكاء الاصطناعي - OSCE',
  contactPhone: '01024828652',
  contactEmail: null,
  ctaTitleEn: 'Ready to practice?',
  ctaTitleAr: 'جاهز للتدريب؟',
  ctaSubtitleEn: 'Join Synoza and start your OSCE training today.',
  ctaSubtitleAr: 'انضم إلى Synoza وابدأ تدريب OSCE اليوم.',
};

const heroHighlightEn = ['Maneuvers', 'Skills', 'Stations'];
const heroHighlightAr = ['مهاراتك السريرية', 'محطاتك السريرية', 'مناوراتك السريرية'];

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const [universities, setUniversities] = useState<{ id: string; nameEn: string; nameAr: string; logoUrl?: string | null; website?: string | null }[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);

  useEffect(() => {
    api.get('/site/public')
      .then((r) => {
        setUniversities(r.data.universities || []);
        if (r.data.settings) setSettings(r.data.settings);
      })
      .catch(() => {});
  }, []);

  const pillars = [
    { icon: Brain, title: t('aiPatient'), desc: t('aiPatientDesc'), variant: 'teal' as const },
    { icon: Stethoscope, title: t('clinicalManeuvers'), desc: t('clinicalManeuversDesc'), variant: 'violet' as const },
    { icon: ClipboardCheck, title: t('examinerScoring'), desc: t('examinerScoringDesc'), variant: 'emerald' as const },
  ];

  const heroHighlights = isAr ? heroHighlightAr : heroHighlightEn;

  return (
    <div className="min-h-screen overflow-x-hidden hero-gradient selection:bg-blue-100 dark:selection:bg-blue-900/40">
      <div className="brand-glow w-96 h-96 bg-blue-400/20 top-0 left-1/4 -translate-x-1/2" />
      <div className="brand-glow w-80 h-80 bg-blue-300/15 top-32 right-0" style={{ animationDelay: '2s' }} />

      <Navbar variant="landing" />

      <main className="relative max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-24 flex flex-col items-center text-center">
        <div className="w-full animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-full text-xs font-semibold text-blue-700 dark:text-blue-300 shadow-sm mb-8">
            <Sparkles size={15} strokeWidth={2} className="text-blue-600 animate-pulse-soft" />
            <span className="text-label !text-blue-700 dark:!text-blue-300 !tracking-widest">{t('heroBadge')}</span>
          </div>

          <h1
            className="text-display mb-6 max-w-4xl mx-auto min-h-[2.8em] sm:min-h-[2.4em] flex flex-col items-center justify-center gap-1 sm:gap-2"
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <span className="text-slate-900 dark:text-white">{t('heroTitleLine1')}</span>
            <span className="inline-flex flex-wrap items-center justify-center gap-x-2 sm:gap-x-3 leading-tight">
              <TypewriterText
                phrases={heroHighlights}
                dir={isAr ? 'rtl' : 'ltr'}
                className="text-blue-600 dark:text-blue-400 font-bold"
                cursorClassName="text-blue-600 dark:text-blue-400"
              />
              <span className="text-slate-900 dark:text-white">{t('heroTitleLine2')}</span>
            </span>
          </h1>

          <p className="text-body max-w-2xl mx-auto mb-10 text-lg">
            {t('heroSubtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              to="/register"
              className="group bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl text-base font-bold shadow-xl shadow-blue-200/80 dark:shadow-blue-900/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2.5"
            >
              {t('getStarted')}
              <ArrowRight size={20} strokeWidth={2.5} className={`group-hover:translate-x-0.5 transition-transform ${isAr ? 'rotate-180 group-hover:-translate-x-0.5' : ''}`} />
            </Link>
            <a href="#about" className="btn-secondary px-10 py-4 text-base flex items-center justify-center">
              {t('learnMore')}
            </a>
          </div>
        </div>
      </main>

      <section id="about" className="section-muted py-16 sm:py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <AnimateOnScroll className="text-center mb-12 sm:mb-16">
            <p className="text-label mb-3">{t('aboutTitle')}</p>
            <h2 className="text-heading mb-4">{t('aboutTitle')}</h2>
            <p className="text-body max-w-3xl mx-auto">{t('aboutText')}</p>
          </AnimateOnScroll>

          <AnimateOnScroll delay={100}>
            <h3 className="text-subheading text-center mb-8 sm:mb-10">{t('pillars')}</h3>
          </AnimateOnScroll>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {pillars.map(({ icon, title, desc, variant }, i) => (
              <AnimateOnScroll key={title} delay={i * 100} animation="scale-in">
                <div className="card card-interactive p-6 sm:p-8 text-center h-full">
                  <IconBox icon={icon} variant={variant} size="xl" className="mx-auto mb-5" />
                  <h4 className="text-subheading text-base mb-2">{title}</h4>
                  <p className="text-body text-sm">{desc}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      <PartnerUniversitiesSection universities={universities} isAr={!!isAr} title={t('partnerUniversities')} />

      <SiteCtaSection settings={settings} isAr={!!isAr} getStartedLabel={t('getStarted')} />

      <SiteFooter
        settings={settings}
        isAr={!!isAr}
        appName={t('appName')}
        contactLabel={t('contact')}
      />
    </div>
  );
}
