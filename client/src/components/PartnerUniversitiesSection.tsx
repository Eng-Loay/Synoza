import { GraduationCap, Building2 } from 'lucide-react';
import { AnimateOnScroll } from './AnimateOnScroll';
import { IconBox } from './IconBox';

export interface PartnerUniversity {
  id: string;
  nameEn: string;
  nameAr: string;
  logoUrl?: string | null;
  website?: string | null;
}

interface PartnerUniversitiesSectionProps {
  universities: PartnerUniversity[];
  isAr: boolean;
  title: string;
}

export function PartnerUniversitiesSection({ universities, isAr, title }: PartnerUniversitiesSectionProps) {
  if (universities.length === 0) return null;

  return (
    <section className="py-16 sm:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-white dark:bg-slate-900/80" />
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="brand-glow w-96 h-96 bg-teal-300/30 top-0 left-1/4" />
        <div className="brand-glow w-80 h-80 bg-indigo-200/40 bottom-0 right-1/4" style={{ animationDelay: '2.5s' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <AnimateOnScroll className="text-center mb-10 sm:mb-14">
          <IconBox icon={GraduationCap} variant="soft" size="xl" className="mx-auto mb-4" />
          <h3 className="text-heading">{title}</h3>
          <p className="text-body mt-3 text-sm sm:text-base max-w-xl mx-auto">
            {isAr ? 'جامعات شريكة تثق في Synoza لتدريب طلابها' : 'Trusted by leading medical universities across Egypt'}
          </p>
        </AnimateOnScroll>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {universities.map((uni, i) => {
            const name = isAr ? uni.nameAr : uni.nameEn;
            const content = (
              <div className="group flex items-center gap-3 p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/70 hover:bg-teal-50/80 dark:hover:bg-teal-950/20 hover:border-teal-200 dark:hover:border-teal-800/50 hover:-translate-y-0.5 transition-all duration-300 h-full shadow-sm">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden group-hover:border-teal-200 dark:group-hover:border-teal-800 transition-colors">
                  {uni.logoUrl ? (
                    <img src={uni.logoUrl} alt="" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Building2 size={18} strokeWidth={2} className="text-teal-600 dark:text-teal-400" />
                  )}
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white leading-snug">{name}</span>
              </div>
            );

            return (
              <AnimateOnScroll key={uni.id} delay={i * 40} animation="fade-in">
                {uni.website ? (
                  <a href={uni.website} target="_blank" rel="noopener noreferrer" className="block">
                    {content}
                  </a>
                ) : (
                  content
                )}
              </AnimateOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}
