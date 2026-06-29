import { Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CLINICAL_RANKS, rankLabel } from '../../lib/clinicalRanks';
import type { RankSnapshot } from './XpBreakdownSection';

function formatXp(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function CareerPathList({ progress, isAr }: { progress: RankSnapshot; isAr: boolean }) {
  const { t } = useTranslation();
  const currentMin = progress.currentRank.minXp;

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-3">
        {t('xpCareerPath')}
      </p>
      <ol className="space-y-2">
        {CLINICAL_RANKS.map((rank) => {
          const achieved = progress.totalXp >= rank.minXp;
          const isCurrent = rank.minXp === currentMin;
          return (
            <li
              key={rank.key}
              className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${
                isCurrent
                  ? 'bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800'
                  : achieved
                    ? 'bg-slate-50/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                    : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <span className={`font-medium ${isCurrent ? 'text-teal-800 dark:text-teal-200' : ''}`}>
                {rankLabel(rank, isAr)}
              </span>
              <span className="text-xs font-semibold shrink-0">
                {rank.minXp.toLocaleString()} XP
                {isCurrent && (
                  <span className="ms-2 text-[10px] uppercase text-teal-600 dark:text-teal-400">
                    {t('xpCurrentRankBadge')}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function RankProgressSummary({ progress, isAr }: { progress: RankSnapshot; isAr: boolean }) {
  const { t } = useTranslation();
  const rankName = (rank: RankSnapshot['currentRank']) => rankLabel(rank, isAr);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={18} className="text-violet-600 dark:text-violet-400" />
        <h2 className="font-bold text-slate-900 dark:text-white">{t('xpRankProgressTitle')}</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('xpCurrentRank')}
          </p>
          <p className="font-bold text-slate-900 dark:text-white mt-1 text-sm leading-snug">
            {rankName(progress.currentRank)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('xpCurrentXp')}
          </p>
          <p className="font-bold text-teal-700 dark:text-teal-400 mt-1">{formatXp(progress.totalXp)} XP</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3 col-span-2 sm:col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('xpRemainingToNext')}
          </p>
          <p className="font-bold text-slate-900 dark:text-white mt-1">
            {progress.nextRank ? `${formatXp(progress.xpNeededForNext)} XP` : t('xpMaxRank')}
          </p>
        </div>
      </div>

      {progress.nextRank && (
        <>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2 gap-2">
            <span>{rankName(progress.currentRank)}</span>
            <span>
              {t('xpNextRank')}: {rankName(progress.nextRank)}
            </span>
          </div>
          <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-700"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
            {progress.progressPercent}% {t('xpTowardNextRank')}
          </p>
        </>
      )}
    </div>
  );
}

export function CareerPathSection({ progress, isAr }: { progress: RankSnapshot; isAr: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-5 sm:p-6 shadow-sm space-y-5">
      <RankProgressSummary progress={progress} isAr={isAr} />
      <div className="pt-5 border-t border-slate-200 dark:border-slate-700">
        <CareerPathList progress={progress} isAr={isAr} />
      </div>
    </div>
  );
}
