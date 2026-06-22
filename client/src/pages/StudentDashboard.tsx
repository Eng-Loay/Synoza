import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, BarChart3, ClipboardList, Clock, Play, Lock, Package, TrendingUp, Shuffle } from 'lucide-react';
import api from '../lib/api';
import { Navbar } from '../components/Navbar';
import { BoardIcon, getBoardIconBg } from '../components/BoardIcon';
import { IconBox } from '../components/IconBox';
import { SectionPicker, type SectionOption } from '../components/SectionPicker';
import { useAuth } from '../context/AuthContext';

interface Case {
  id: string;
  titleEn: string;
  titleAr: string;
  patientName: string;
  chiefComplaint: string;
  specialty: { nameEn: string; nameAr: string };
  difficulty: { nameEn: string; nameAr: string; color: string; level: number };
  category?: { nameEn: string; nameAr: string } | null;
  examImages?: string;
}

interface CategoryNode {
  id: string;
  nameEn: string;
  nameAr: string;
  description?: string | null;
  children: CategoryNode[];
  _count?: { cases: number; children: number };
}

interface Stats {
  totalSessions: number;
  completedStations: number;
  averageScore: number;
}

interface Entitlements {
  plan: string;
  isFree: boolean;
  freeAttemptsPerCase: number;
  casesQuota: number;
  casesUnlocked: number;
  casesRemaining: number;
  attemptsByCase: Record<string, number>;
}

interface PlanOption {
  id: string;
  priceEgp: number;
  casesQuota: number;
  labelEn: string;
  labelAr: string;
}


const DEFAULT_COVER = '/exam/chest-inspection.svg';
function getCaseCover(examImages?: string): string {
  try {
    const parsed = JSON.parse(examImages || '[]') as Array<{ url?: string }>;
    for (const item of parsed) {
      const url = item.url?.trim();
      if (!url) continue;
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      if (url.startsWith('/')) return url;
    }
  } catch {
    /* ignore invalid JSON */
  }
  return DEFAULT_COVER;
}

function CaseCoverImage({ examImages, title }: { examImages?: string; title: string }) {
  const [src, setSrc] = useState(() => getCaseCover(examImages));
  const isSvg = src.endsWith('.svg');

  useEffect(() => {
    setSrc(getCaseCover(examImages));
  }, [examImages]);

  return (
    <img
      src={src}
      alt={title}
      className={`w-full h-full group-hover:scale-105 transition-transform duration-500 ${
        isSvg ? 'object-contain p-3 bg-slate-100 dark:bg-slate-800' : 'object-cover'
      }`}
      onError={() => {
        if (src !== DEFAULT_COVER) setSrc(DEFAULT_COVER);
      }}
    />
  );
}

function difficultyTone(level: number) {
  if (level <= 1) return 'bg-emerald-600';
  if (level === 2) return 'bg-amber-600';
  return 'bg-red-600';
}

function boardIsComingSoon(board: CategoryNode) {
  const childCases = board.children.reduce((sum, child) => sum + (child._count?.cases ?? 0), 0);
  return (board._count?.cases ?? 0) === 0 && childCases === 0 && board.children.length === 0;
}

function buildSectionOptions(categories: CategoryNode[], isAr: boolean): SectionOption[] {
  const options: SectionOption[] = [];

  for (const board of categories) {
    if (boardIsComingSoon(board)) continue;

    const boardName = isAr ? board.nameAr : board.nameEn;

    if (board.children.length > 0) {
      for (const child of board.children) {
        const caseCount = child._count?.cases ?? 0;
        if (caseCount === 0) continue;
        const childName = isAr ? child.nameAr : child.nameEn;
        options.push({
          id: child.id,
          label: `${boardName} → ${childName}`,
          shortLabel: childName,
          boardLabel: boardName,
          caseCount,
        });
      }
      const boardCases = board._count?.cases ?? 0;
      if (boardCases > 0) {
        options.push({ id: board.id, label: boardName, shortLabel: boardName, caseCount: boardCases });
      }
    } else {
      const caseCount = board._count?.cases ?? 0;
      if (caseCount > 0) {
        options.push({ id: board.id, label: boardName, shortLabel: boardName, caseCount });
      }
    }
  }

  return options;
}

export default function StudentDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAr = i18n.language?.startsWith('ar');

  const [cases, setCases] = useState<Case[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [rootCategories, setRootCategories] = useState<CategoryNode[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [startError, setStartError] = useState<string | null>(null);
  const [randomLoading, setRandomLoading] = useState<'all' | 'section' | null>(null);
  const [randomSectionId, setRandomSectionId] = useState('');
  const randomErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/categories').then((r) => setRootCategories(r.data.categories));
    api.get('/student/overview').then((r) => setStats(r.data.stats));
    api.get('/student/entitlements').then((r) => {
      setEntitlements(r.data.entitlements);
      setPlans(r.data.plans ?? []);
    });
  }, []);

  const selectedBoard = useMemo(
    () => rootCategories.find((cat) => cat.id === selectedBoardId) ?? null,
    [rootCategories, selectedBoardId],
  );

  const subCategories = selectedBoard?.children ?? [];

  const activeCategoryId = selectedSubId ?? selectedBoardId;

  const sectionOptions = useMemo(
    () => buildSectionOptions(rootCategories, isAr),
    [rootCategories, isAr],
  );

  useEffect(() => {
    if (!sectionOptions.length) return;
    setRandomSectionId((prev) => {
      if (prev && sectionOptions.some((o) => o.id === prev)) return prev;
      if (activeCategoryId && sectionOptions.some((o) => o.id === activeCategoryId)) {
        return activeCategoryId;
      }
      return sectionOptions[0].id;
    });
  }, [sectionOptions, activeCategoryId]);

  useEffect(() => {
    if (!rootCategories.length || selectedBoardId) return;
    const firstBoard = rootCategories[0];
    setSelectedBoardId(firstBoard.id);
    setSelectedSubId(firstBoard.children[0]?.id ?? firstBoard.id);
  }, [rootCategories, selectedBoardId]);

  useEffect(() => {
    if (!activeCategoryId && !search.trim()) return;
    setLoading(true);
    api
      .get('/cases', {
        params: {
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(activeCategoryId && !search.trim() ? { categoryId: activeCategoryId } : {}),
        },
      })
      .then((r) => setCases(r.data.cases))
      .finally(() => setLoading(false));
  }, [search, activeCategoryId]);

  const selectBoard = (board: CategoryNode) => {
    if (boardIsComingSoon(board)) return;
    setSelectedBoardId(board.id);
    setSelectedSubId(board.children[0]?.id ?? board.id);
    setSearch('');
  };

  const showStartError = (message: string) => {
    setStartError(message);
    requestAnimationFrame(() => {
      randomErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const resolveStartError = (err: unknown, scope?: 'all' | 'section') => {
    const axiosErr = err as { response?: { data?: { error?: string } } };
    const code = axiosErr.response?.data?.error;
    if (code === 'NO_ELIGIBLE_CASES') return t('noEligibleRandomCase');
    if (code === 'NO_CASES') return scope === 'section' ? t('noCasesInSection') : t('noStationsInCategory');
    if (code === 'FREE_LIMIT_REACHED') return t('freeLimitReached');
    if (code === 'CASE_QUOTA_EXCEEDED') return t('caseQuotaExceeded');
    return t('error');
  };

  const launchSession = async (caseId: string) => {
    const res = await api.post('/sessions/start', { caseId, language: isAr ? 'AR' : 'EN' });
    navigate(`/simulation/${res.data.session.id}`);
  };

  const startStation = async (caseId: string) => {
    setStartError(null);
    try {
      await launchSession(caseId);
    } catch (err: unknown) {
      showStartError(resolveStartError(err));
    }
  };

  const startRandomCase = async (categoryId?: string) => {
    setStartError(null);
    setRandomLoading(categoryId ? 'section' : 'all');
    try {
      const randomRes = await api.get('/student/random-case', {
        params: categoryId ? { categoryId } : {},
      });
      const caseId = randomRes.data?.case?.id;
      if (!caseId) {
        showStartError(t('error'));
        return;
      }
      await launchSession(caseId);
    } catch (err: unknown) {
      showStartError(resolveStartError(err, categoryId ? 'section' : 'all'));
    } finally {
      setRandomLoading(null);
    }
  };

  const startSectionRandom = () => {
    if (!randomSectionId) {
      showStartError(t('randomCaseChooseSection'));
      return;
    }
    void startRandomCase(randomSectionId);
  };

  const getCaseAttempts = (caseId: string) => entitlements?.attemptsByCase[caseId] ?? 0;

  const canStartCase = (caseId: string) => {
    if (!entitlements) return true;
    if (!entitlements.isFree) {
      const attempts = getCaseAttempts(caseId);
      if (attempts > 0) return true;
      return entitlements.casesRemaining > 0;
    }
    return getCaseAttempts(caseId) < entitlements.freeAttemptsPerCase;
  };

  const caseAttemptLabel = (caseId: string) => {
    if (!entitlements) return null;
    const used = getCaseAttempts(caseId);
    if (entitlements.isFree) {
      const left = Math.max(0, entitlements.freeAttemptsPerCase - used);
      return left > 0 ? t('attemptsRemaining', { count: left }) : t('attemptsUsedUp');
    }
    if (used > 0) return t('completed');
    return null;
  };

  return (
    <div className="min-h-screen bg-[var(--color-medical-bg)] dark:bg-[#060b14]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-label mb-1">{t('dashboard')}</p>
            <h1 className="text-heading text-2xl sm:text-3xl">
              {t('welcomeBack')}, <span className="text-gradient-brand">{user?.firstName}</span>!
            </h1>
            <p className="text-body text-sm mt-1">{t('chooseExamArea')}</p>
          </div>

          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} strokeWidth={2} />
            <input
              className="input-field !pl-11 w-full"
              placeholder={t('search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: t('totalSessions'), value: stats.totalSessions, icon: ClipboardList, variant: 'teal' as const },
              { label: t('completedStations'), value: stats.completedStations, icon: BarChart3, variant: 'emerald' as const },
              { label: t('avgScore'), value: `${stats.averageScore}%`, icon: TrendingUp, variant: 'violet' as const },
            ].map(({ label, value, icon, variant }) => (
              <div key={label} className="stat-card flex items-center gap-4">
                <IconBox icon={icon} variant={variant} size="lg" />
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <section className="card overflow-hidden">
          <div className="relative p-5 sm:p-8 flex flex-col gap-5 sm:gap-6 sm:flex-row sm:items-start">
            <div
              className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-indigo-500/5 to-transparent dark:from-teal-500/15 dark:via-indigo-500/10 pointer-events-none"
              aria-hidden
            />
            <div className="relative flex items-start gap-4 min-w-0">
              <IconBox icon={Shuffle} variant="brand" size="xl" className="shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-label mb-1">{t('randomCase')}</p>
                <h2 className="text-subheading text-lg sm:text-xl mb-1">{t('randomCaseTitle')}</h2>
                <p className="text-body text-sm">{t('randomCaseDesc')}</p>
              </div>
            </div>

            <div className="relative flex flex-col gap-3 w-full min-w-0 sm:flex-1 sm:max-w-md lg:max-w-lg">
              {startError && (
                <div
                  ref={randomErrorRef}
                  className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm font-medium"
                >
                  {startError}
                </div>
              )}

              <button
                type="button"
                onClick={() => void startRandomCase()}
                disabled={randomLoading !== null}
                className="btn-primary flex items-center justify-center gap-2 px-6 py-3 disabled:opacity-70 w-full"
              >
                {randomLoading === 'all' ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('randomCaseLoading')}
                  </>
                ) : (
                  <>
                    <Shuffle size={18} strokeWidth={2.5} />
                    {t('randomCaseAll')}
                  </>
                )}
              </button>

              {sectionOptions.length > 0 && (
                <div className="flex flex-col gap-2 w-full min-w-0">
                  <label htmlFor="random-section" className="text-label !normal-case !tracking-normal text-slate-600 dark:text-slate-400">
                    {t('randomCaseChooseSection')}
                  </label>
                  <SectionPicker
                    id="random-section"
                    options={sectionOptions}
                    value={randomSectionId}
                    onChange={setRandomSectionId}
                    disabled={randomLoading !== null}
                    chooseLabel={t('randomCaseChooseSection')}
                    casesLabel={(count) => t('packageCases', { count })}
                    startLabel={t('randomCaseFromSection')}
                    starting={randomLoading === 'section'}
                    onStart={startSectionRandom}
                  />
                  <button
                    type="button"
                    onClick={startSectionRandom}
                    disabled={randomLoading !== null || !randomSectionId}
                    className="btn-secondary flex items-center justify-center gap-2 px-5 py-3 disabled:opacity-70 w-full"
                  >
                    {randomLoading === 'section' ? (
                      <>
                        <span className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-600 dark:border-t-slate-200 rounded-full animate-spin" />
                        {t('randomCaseLoading')}
                      </>
                    ) : (
                      <>
                        <Shuffle size={16} strokeWidth={2} />
                        {t('randomCaseFromSection')}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {entitlements && (
          <section className="card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <IconBox icon={Package} variant="soft" size="md" />
                <div>
                  <h3 className="text-subheading text-base">{t('subscriptionPlans')}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {t('currentPlan')}:{' '}
                    <span className="font-semibold text-teal-700 dark:text-teal-300">
                      {entitlements.isFree ? t('planFree') : entitlements.plan.replace('PACKAGE_', '')}
                    </span>
                    {entitlements.isFree ? (
                      <span className="ms-2">— {t('planFreeDesc')}</span>
                    ) : (
                      <span className="ms-2">
                        — {t('casesUnlocked', { used: entitlements.casesUnlocked, total: entitlements.casesQuota })}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {!entitlements.isFree && entitlements.casesRemaining > 0 && (
                <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {t('casesRemaining', { count: entitlements.casesRemaining })}
                </span>
              )}
            </div>

            {entitlements.isFree && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {plans.map((plan, idx) => (
                  <div
                    key={plan.id}
                    className={`rounded-xl p-4 flex flex-col gap-1.5 border ${
                      idx === 1
                        ? 'border-teal-300 dark:border-teal-700 bg-gradient-to-br from-teal-50 to-indigo-50/50 dark:from-teal-950/30 dark:to-indigo-950/20 shadow-md shadow-teal-500/10'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                    }`}
                  >
                    <p className="text-xl font-bold text-slate-900 dark:text-white">
                      {plan.priceEgp} <span className="text-sm font-semibold text-slate-500">{t('egp')}</span>
                    </p>
                    <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
                      {t('packageCases', { count: plan.casesQuota })}
                    </p>
                    <p className="text-xs text-slate-500">{isAr ? plan.labelAr : plan.labelEn}</p>
                  </div>
                ))}
              </div>
            )}

            {entitlements.isFree && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('contactToUpgrade')}: <span className="font-semibold text-teal-600 dark:text-teal-400">{t('contactPhone')}</span>
              </p>
            )}
          </section>
        )}


        <section className="space-y-6">
          <div className="text-center md:text-start space-y-1">
            <p className="text-label">{t('rotationsLibrary')}</p>
            <h2 className="text-heading text-xl sm:text-2xl">
              {t('specialtyBoards')} <span className="text-slate-400 font-medium">({t('specialtyBoardsAr')})</span>
            </h2>
            <p className="text-body text-sm max-w-3xl">{t('browseStationsHint')}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {rootCategories.map((board) => {
              const soon = boardIsComingSoon(board);
              const selected = selectedBoardId === board.id;
              return (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => selectBoard(board)}
                  disabled={soon}
                  className={`p-4 sm:p-5 rounded-2xl border text-start transition-all relative overflow-hidden flex flex-col justify-between min-h-[118px] ${
                    soon
                      ? 'border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/30 text-slate-400 cursor-not-allowed opacity-70'
                      : selected
                        ? 'border-teal-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-lg shadow-teal-500/10 ring-1 ring-teal-500/20 scale-[1.02]'
                        : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:border-teal-200 dark:hover:border-teal-800 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <span className="text-sm font-bold block tracking-tight leading-snug">{isAr ? board.nameAr : board.nameEn}</span>
                      <span className="text-[11px] text-slate-400 block font-medium leading-none">
                        {isAr ? board.nameEn : board.nameAr}
                      </span>
                    </div>
                    {soon && (
                      <span className="badge bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[9px] shrink-0">
                        {t('comingSoon')}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end pt-3">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${getBoardIconBg(board.nameEn)}`}>
                      <BoardIcon nameEn={board.nameEn} size={17} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {!search.trim() && subCategories.length > 0 && (
            <div className="flex overflow-x-auto gap-2 pb-2 pt-1 scrollbar-thin">
              {subCategories.map((sub) => {
                const selected = selectedSubId === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSelectedSubId(sub.id)}
                    className={`px-4 py-2 rounded-xl border font-semibold text-xs shrink-0 tracking-tight transition-all flex items-center gap-2 ${
                      selected
                        ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white border-transparent shadow-md shadow-teal-500/20'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-200 dark:hover:border-teal-800'
                    }`}
                  >
                    <BoardIcon nameEn={sub.nameEn} size={14} />
                    {isAr ? sub.nameAr : sub.nameEn}
                  </button>
                );
              })}
            </div>
          )}

          {loading ? (
            <p className="text-slate-500 py-12 text-center">{t('loading')}</p>
          ) : cases.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-500">
              {t('noStationsInCategory')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {cases.map((c) => (
                <article
                  key={c.id}
                  className="card card-interactive overflow-hidden flex flex-col group"
                >
                  <div className="h-44 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                    <CaseCoverImage examImages={c.examImages} title={isAr ? c.titleAr : c.titleEn} />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span
                        className={`badge text-white text-[9px] uppercase tracking-wide ${difficultyTone(c.difficulty.level)}`}
                      >
                        {isAr ? c.difficulty.nameAr : c.difficulty.nameEn}
                      </span>
                      <span className="badge bg-slate-900/75 text-white text-[9px] flex items-center gap-1 backdrop-blur-sm">
                        <Clock size={11} strokeWidth={2.5} />
                        {t('estimatedTime')}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <span className="text-label !text-teal-600 dark:!text-teal-400 !normal-case !tracking-wide">
                        {isAr ? c.specialty.nameAr : c.specialty.nameEn}
                      </span>
                      <h4 className="text-subheading text-base mt-1 mb-1.5 leading-snug">
                        {isAr ? c.titleAr : c.titleEn}
                      </h4>
                      <p className="text-body text-xs line-clamp-3">
                        {c.chiefComplaint}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">{c.patientName}</p>
                      {caseAttemptLabel(c.id) && (
                        <p
                          className={`text-xs font-semibold mt-2 ${
                            canStartCase(c.id)
                              ? 'text-teal-600 dark:text-teal-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {caseAttemptLabel(c.id)}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => startStation(c.id)}
                      disabled={!canStartCase(c.id)}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
                        canStartCase(c.id)
                          ? 'btn-primary !py-2.5'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                      }`}
                    >
                      {canStartCase(c.id) ? <Play size={14} strokeWidth={2.5} fill="currentColor" /> : <Lock size={14} strokeWidth={2} />}
                      {canStartCase(c.id) ? t('startOsceSession') : t('attemptsUsedUp')}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-200/70 dark:border-slate-800/70">
          <Link to="/student/results" className="text-sm font-semibold text-teal-600 dark:text-teal-400 hover:underline">
            {t('myResults')}
          </Link>
          <Link to="/student/profile" className="text-sm font-semibold text-teal-600 dark:text-teal-400 hover:underline">
            {t('profile')}
          </Link>
        </div>
      </main>
    </div>
  );
}
