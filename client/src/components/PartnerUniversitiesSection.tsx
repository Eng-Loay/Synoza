import { GraduationCap, Building2 } from 'lucide-react';
import { AnimateOnScroll } from './AnimateOnScroll';

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
    <section className="py-16 sm:py-24 bg-slate-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-600/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-600/20 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <AnimateOnScroll className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 border border-white/10 mb-4">
            <GraduationCap className="text-teal-400" size={28} />
          </div>
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">{title}</h3>
          <p className="text-slate-400 mt-3 text-sm sm:text-base max-w-xl mx-auto">
            {isAr ? 'جامعات شريكة تثق في Synoza لتدريب طلابها' : 'Trusted by leading medical universities across Egypt'}
          </p>
        </AnimateOnScroll>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {universities.map((uni, i) => {
            const name = isAr ? uni.nameAr : uni.nameEn;
            const content = (
              <div className="group flex items-center gap-3 p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-teal-500/10 hover:border-teal-400/30 hover:-translate-y-0.5 transition-all duration-300 h-full">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border border-teal-400/20 flex items-center justify-center overflow-hidden">
                  {uni.logoUrl ? (
                    <img src={uni.logoUrl} alt="" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Building2 size={18} className="text-teal-300" />
                  )}
                </div>
                <span className="text-sm font-medium text-slate-200 group-hover:text-white leading-snug">{name}</span>
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
