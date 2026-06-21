import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Brain, Stethoscope, ClipboardCheck, Sparkles, ArrowRight } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { AnimateOnScroll } from '../components/AnimateOnScroll';
import { PartnerUniversitiesSection } from '../components/PartnerUniversitiesSection';
import { SiteCtaSection, SiteFooter, type SiteSettings } from '../components/SiteFooter';
import { TypewriterText } from '../components/TypewriterText';
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

const heroPhrasesEn = [
  'Refine Your Clinical Skills with AI',
  'Master OSCE Clinical Stations',
  'Practice with AI Simulated Patients',
];

const heroPhrasesAr = [
  'طوّر مهاراتك السريرية بالذكاء الاصطناعي',
  'أتقن محطات OSCE السريرية',
  'تدرّب مع مرضى محاكاة بالذكاء الاصطناعي',
];

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
    { icon: Brain, title: t('aiPatient'), desc: t('aiPatientDesc'), color: 'from-teal-500 to-cyan-500' },
    { icon: Stethoscope, title: t('clinicalManeuvers'), desc: t('clinicalManeuversDesc'), color: 'from-teal-600 to-emerald-500' },
    { icon: ClipboardCheck, title: t('examinerScoring'), desc: t('examinerScoringDesc'), color: 'from-cyan-500 to-teal-500' },
  ];

  const uniCount = universities.length > 0 ? `${universities.length}+` : '12+';
  const stats = [
    { value: 'AI', label: 'Simulated Patients' },
    { value: 'OSCE', label: 'Exam Format' },
    { value: '24/7', label: 'Practice Access' },
    { value: uniCount, label: 'Partner Universities' },
  ];

  const heroPhrases = isAr ? heroPhrasesAr : heroPhrasesEn;

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface dark:bg-surface-dark">
      <Navbar />

      <section className="relative overflow-hidden hero-gradient text-white">
        <div className="absolute inset-0 opacity-25 pointer-events-none">
          <div className="absolute top-16 left-[5%] w-56 sm:w-72 h-56 sm:h-72 bg-teal-300/40 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-10 right-[5%] w-64 sm:w-96 h-64 sm:h-96 bg-cyan-400/30 rounded-full blur-3xl animate-float stagger-3" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <p className="animate-fade-in inline-flex items-center gap-2 text-teal-100 text-xs sm:text-sm font-medium mb-4 sm:mb-6 tracking-wide uppercase bg-white/10 px-4 py-1.5 rounded-full border border-teal-400/20">
              <Sparkles size={14} className="text-teal-300" /> Academic OSCE Simulation • 2026
            </p>

            <h1
              className="animate-fade-up text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 sm:mb-6 leading-[1.2] tracking-tight min-h-[2.6em] sm:min-h-[2.4em] flex items-center justify-center"
              dir={isAr ? 'rtl' : 'ltr'}
            >
              <TypewriterText phrases={heroPhrases} dir={isAr ? 'rtl' : 'ltr'} />
            </h1>

            <p className="animate-fade-up stagger-1 text-base sm:text-lg lg:text-xl text-teal-50/85 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2">
              {t('heroSubtitle')}
            </p>

            <div className="animate-fade-up stagger-2 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
              <Link
                to="/register"
                className="group inline-flex items-center justify-center gap-2 bg-white text-primary px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-semibold shadow-lg shadow-black/15 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
              >
                {t('getStarted')}
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="#about"
                className="inline-flex items-center justify-center border-2 border-teal-300/40 text-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-semibold hover:bg-white/10 hover:border-teal-200/60 transition-all duration-300"
              >
                {t('learnMore')}
              </a>
            </div>
          </div>

          <div className="animate-fade-up stagger-3 mt-14 sm:mt-20 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
            {stats.map(({ value, label }) => (
              <div key={label} className="text-center p-4 sm:p-5 rounded-2xl bg-white/10 backdrop-blur-sm border border-teal-400/15 hover:bg-white/15 hover:border-teal-300/25 transition-colors">
                <p className="text-2xl sm:text-3xl font-bold text-white">{value}</p>
                <p className="text-[11px] sm:text-xs text-teal-100/75 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="py-16 sm:py-24 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <AnimateOnScroll className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-4">{t('aboutTitle')}</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-3xl mx-auto text-base sm:text-lg leading-relaxed">{t('aboutText')}</p>
          </AnimateOnScroll>

          <AnimateOnScroll delay={100}>
            <h3 className="text-xl sm:text-2xl font-bold text-center mb-8 sm:mb-10 text-slate-900 dark:text-white">{t('pillars')}</h3>
          </AnimateOnScroll>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
            {pillars.map(({ icon: Icon, title, desc, color }, i) => (
              <AnimateOnScroll key={title} delay={i * 100} animation="scale-in">
                <div className="card card-interactive p-6 sm:p-8 text-center h-full">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mx-auto mb-5 shadow-lg shadow-teal-500/20`}>
                    <Icon className="text-white" size={28} />
                  </div>
                  <h4 className="font-semibold text-lg mb-2 text-slate-900 dark:text-white">{title}</h4>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{desc}</p>
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
