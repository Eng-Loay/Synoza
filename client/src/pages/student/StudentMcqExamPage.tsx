import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { splitQuestionContent } from '../../lib/qbankQuestionContent';
import {
  ChevronRight,
  Flag,
  Pause,
  Play,
  Bookmark,
  X,
} from 'lucide-react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  examStorageKey,
  examQuestionsStorageKey,
  type QbankAnswerState,
  type QbankExamConfig,
  type QbankExamResult,
  type QbankQuestion,
} from '../../data/qbankMock';
import {
  buildSavedQuestionKey,
  isQuestionSaved,
  toggleSavedQuestion,
} from '../../lib/qbankSavedQuestions';

type McqExamPersisted = {
  config: QbankExamConfig;
  startedAt: number;
  current: number;
  answers: QbankAnswerState[];
  timerPaused?: boolean;
  meta?: { termTitleEn?: string; moduleNameEn?: string };
};

function emptyAnswers(count: number): QbankAnswerState[] {
  return Array.from({ length: count }, () => ({ selected: null, marked: false, skipped: false }));
}

function formatTimer(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function StudentMcqExamPage() {
  const { termId = '401', moduleId = 'med-1' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const storageKey = examStorageKey(termId, moduleId);
  const questionsKey = examQuestionsStorageKey(termId, moduleId);

  const [config, setConfig] = useState<QbankExamConfig | null>(null);
  const [questions, setQuestions] = useState<QbankQuestion[]>([]);
  const [displayMeta, setDisplayMeta] = useState({ termTitle: termId, moduleName: moduleId });
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<QbankAnswerState[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(90 * 60);
  const [timerPaused, setTimerPaused] = useState(false);
  const [exitPrompt, setExitPrompt] = useState<'navigation' | 'refresh' | null>(null);
  const [questionSaved, setQuestionSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const finishTriggeredRef = useRef(false);

  const examInProgress = loaded && !!config;

  const finishExam = useCallback(() => {
    if (finishTriggeredRef.current || !config) return;
    finishTriggeredRef.current = true;
    const result: QbankExamResult = {
      config,
      answers,
      questions,
      startedAt: startedAt ?? Date.now(),
      finishedAt: Date.now(),
      termId,
      moduleId,
    };
    sessionStorage.removeItem(storageKey);
    sessionStorage.removeItem(questionsKey);
    sessionStorage.setItem(`${storageKey}-result`, JSON.stringify(result));
    navigate(`/student/mcq/${termId}/${moduleId}/report`);
  }, [answers, config, moduleId, navigate, questions, questionsKey, startedAt, storageKey, termId]);

  const persistProgress = useCallback(
    (patch: Partial<McqExamPersisted>) => {
      if (!config || startedAt == null) return;
      const payload: McqExamPersisted = {
        config,
        startedAt,
        current,
        answers,
        timerPaused,
        ...patch,
      };
      sessionStorage.setItem(storageKey, JSON.stringify(payload));
    },
    [answers, config, current, startedAt, storageKey, timerPaused],
  );

  const confirmExit = useCallback(() => {
    sessionStorage.removeItem(storageKey);
    sessionStorage.removeItem(questionsKey);
    setExitPrompt(null);
    navigate(`/student/mcq/${termId}/${moduleId}/setup`);
  }, [moduleId, navigate, questionsKey, storageKey, termId]);

  useEffect(() => {
    const activeQuestion = questions[current];
    if (!activeQuestion) return;
    setQuestionSaved(
      isQuestionSaved(buildSavedQuestionKey(termId, moduleId, activeQuestion.id)),
    );
  }, [termId, moduleId, questions, current]);

  useEffect(() => {
    const raw = sessionStorage.getItem(storageKey);
    const qRaw = sessionStorage.getItem(questionsKey);
    if (raw && qRaw) {
      try {
        const parsed = JSON.parse(raw) as Partial<McqExamPersisted> & { config: QbankExamConfig };
        const qs = JSON.parse(qRaw) as QbankQuestion[];
        if (!parsed.config || qs.length === 0) throw new Error('invalid');
        const started = parsed.startedAt ?? Date.now();
        const restoredAnswers =
          parsed.answers?.length === qs.length ? parsed.answers : emptyAnswers(qs.length);
        const restoredCurrent = Math.min(parsed.current ?? 0, Math.max(0, qs.length - 1));

        setConfig(parsed.config);
        setQuestions(qs);
        setAnswers(restoredAnswers);
        setCurrent(restoredCurrent);
        setStartedAt(started);
        setTimerPaused(!!parsed.timerPaused);
        if (parsed.meta) {
          setDisplayMeta({
            termTitle: parsed.meta.termTitleEn ?? termId,
            moduleName: parsed.meta.moduleNameEn ?? moduleId,
          });
        }

        const progress: McqExamPersisted = {
          config: parsed.config,
          startedAt: started,
          current: restoredCurrent,
          answers: restoredAnswers,
          timerPaused: !!parsed.timerPaused,
          meta: parsed.meta,
        };
        sessionStorage.setItem(storageKey, JSON.stringify(progress));
        setLoaded(true);
        return;
      } catch {
        /* fall through */
      }
    }
    navigate(`/student/mcq/${termId}/${moduleId}/setup`, { replace: true });
  }, [moduleId, navigate, questionsKey, storageKey, termId]);

  useEffect(() => {
    if (!loaded || !config || startedAt == null) return;
    persistProgress({ config, startedAt, current, answers, timerPaused });
  }, [answers, config, current, loaded, persistProgress, startedAt, timerPaused]);

  useEffect(() => {
    if (!config || startedAt == null) return;
    if (config.mode === 'practice') {
      setSecondsLeft(99 * 3600);
      return;
    }

    const durationSec = (config.examDurationMinutes ?? 60) * 60;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, durationSec - elapsed);
      if (!timerPaused) {
        setSecondsLeft(remaining);
      }
      if (remaining <= 0) {
        finishExam();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [config, finishExam, startedAt, timerPaused]);

  useEffect(() => {
    if (!loaded || !config || config.mode !== 'exam' || startedAt == null) return;
    const durationSec = (config.examDurationMinutes ?? 60) * 60;
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    if (elapsed >= durationSec) {
      finishExam();
    }
  }, [config, finishExam, loaded, secondsLeft, startedAt]);

  useEffect(() => {
    if (!examInProgress) return;
    if ((location.state as { fromCaseStart?: boolean } | null)?.fromCaseStart) return;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav?.type === 'reload') {
      setExitPrompt('refresh');
    }
  }, [examInProgress, location.state]);

  useEffect(() => {
    if (!examInProgress) return;
    return undefined;
  }, [examInProgress]);

  const progressPct = questions.length ? Math.round(((current + 1) / questions.length) * 100) : 0;
  const q = questions[current];
  const ans = answers[current] ?? { selected: null, marked: false, skipped: false };
  const display = q ? splitQuestionContent(q.text, q.explanation) : { stem: '', explanation: undefined };

  const stats = useMemo(() => {
    let answered = 0;
    let skipped = 0;
    let marked = 0;
    for (const a of answers) {
      if (a.marked) marked += 1;
      if (a.skipped) skipped += 1;
      else if (a.selected != null) answered += 1;
    }
    return {
      answered,
      skipped,
      marked,
      unanswered: questions.length - answered - skipped,
    };
  }, [answers, questions.length]);

  if (!config || !q) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const updateAnswer = (patch: Partial<QbankAnswerState>) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = { ...next[current], ...patch };
      return next;
    });
  };

  const examTimedOut = config.mode === 'exam' && secondsLeft <= 0;

  const submitAnswer = () => {
    if (examTimedOut) return;
    if (config.mode === 'practice') {
      if (ans.revealed) {
        if (current < questions.length - 1) setCurrent((c) => c + 1);
        return;
      }
      updateAnswer({ revealed: true });
      return;
    }
    if (current < questions.length - 1) setCurrent((c) => c + 1);
  };

  const navStatus = (i: number) => {
    const a = answers[i];
    if (!a) return 'unanswered';
    if (a.marked) return 'marked';
    if (a.skipped) return 'skipped';
    if (a.selected != null) return 'answered';
    return 'unanswered';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-8">
      <ConfirmDialog
        open={exitPrompt !== null}
        title={exitPrompt === 'refresh' ? t('refreshExamTitle') : t('portalMcqExitExam')}
        message={exitPrompt === 'refresh' ? t('refreshExamMessage') : t('portalMcqExitExamDesc')}
        confirmLabel={t('portalMcqExitExam')}
        cancelLabel={t('stayInExam')}
        variant="danger"
        onConfirm={confirmExit}
        onCancel={() => setExitPrompt(null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setExitPrompt('navigation')} className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
          <X size={16} />
          {t('portalMcqExitExam')}
        </button>
        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
          <span>{termId}</span>
          <ChevronRight size={12} />
          <span>{displayMeta.moduleName}</span>
          <ChevronRight size={12} />
          <span className="text-violet-600 dark:text-violet-400 font-medium">
            {config.mode === 'practice' ? t('portalMcqPracticeMode') : t('portalMcqExamMode')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm font-mono text-slate-700 dark:text-slate-200">
          <span className={examTimedOut ? 'text-red-600 dark:text-red-400 font-bold' : secondsLeft < 300 ? 'text-amber-600 dark:text-amber-400' : ''}>
            {formatTimer(secondsLeft)}
          </span>
          <span className="text-xs text-slate-400">{t('portalMcqTimeRemaining')}</span>
          {config.mode === 'exam' && (
            <button type="button" onClick={() => setTimerPaused((p) => !p)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600">
              {timerPaused ? <Play size={14} /> : <Pause size={14} />}
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {t('portalMcqQuestionOf', { current: current + 1, total: questions.length })}
              </span>
              <span className="text-violet-600 dark:text-violet-400 font-bold">{progressPct}% {t('portalMcqCompleted')}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className="h-full bg-violet-600 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-6 shadow-sm">
            <p className="text-base sm:text-lg font-medium text-slate-900 dark:text-white leading-relaxed mb-6">{display.stem}</p>
            <div className="space-y-3">
              {q.options.map((opt, idx) => {
                const selected = ans.selected === idx;
                const isCorrect = ans.revealed && q.correctIndex != null && idx === q.correctIndex;
                const isWrong = ans.revealed && selected && q.correctIndex != null && idx !== q.correctIndex;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => !examTimedOut && updateAnswer({ selected: idx, skipped: false })}
                    disabled={examTimedOut}
                    className={`w-full text-start flex items-center gap-3 p-4 rounded-xl border-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                      isCorrect
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                        : isWrong
                          ? 'border-red-400 bg-red-50 dark:bg-red-950/30'
                          : selected
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                            : 'border-slate-200 dark:border-slate-600 hover:border-violet-300'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      selected ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="text-sm text-slate-800 dark:text-slate-200">{opt}</span>
                  </button>
                );
              })}
            </div>

            {ans.revealed && display.explanation?.trim() && (
              <div className="mt-5 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300 mb-2">
                  {t('portalMcqExplanation')}
                </p>
                <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {display.explanation}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={ans.marked} onChange={(e) => updateAnswer({ marked: e.target.checked })} className="rounded text-violet-600" />
                  {t('portalMcqMarkReview')}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const saved = toggleSavedQuestion(termId, moduleId, q);
                    setQuestionSaved(saved);
                  }}
                  className={`inline-flex items-center gap-2 text-sm font-semibold transition-colors ${
                    questionSaved
                      ? 'text-violet-600 dark:text-violet-400'
                      : 'text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400'
                  }`}
                >
                  <Bookmark size={16} className={questionSaved ? 'fill-current' : ''} />
                  {questionSaved ? t('portalMcqSavedQuestion') : t('portalMcqSaveQuestion')}
                </button>
              </div>
              <button type="button" onClick={submitAnswer} disabled={examTimedOut} className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
                {config.mode === 'practice' && ans.revealed ? t('portalMcqNext') : t('portalMcqSubmitAnswer')}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={current === 0}
              onClick={() => setCurrent((c) => c - 1)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-semibold disabled:opacity-40"
            >
              {t('portalMcqPrevious')}
            </button>
            <button type="button" onClick={() => updateAnswer({ skipped: true, selected: null })} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-amber-600 dark:text-amber-400 font-medium">
              <Flag size={14} />
              {t('portalMcqFlagQuestion')}
            </button>
            <button
              type="button"
              disabled={current >= questions.length - 1}
              onClick={() => setCurrent((c) => c + 1)}
              className="px-4 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-sm font-semibold disabled:opacity-40"
            >
              {t('portalMcqNext')}
            </button>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">{t('portalMcqQuestionNav')}</p>
            <div className="grid grid-cols-6 gap-1.5">
              {questions.map((_, i) => {
                const status = navStatus(i);
                const isCurrent = i === current;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrent(i)}
                    className={`aspect-square rounded-lg text-[11px] font-bold border transition-colors relative ${
                      isCurrent ? 'ring-2 ring-violet-500 ring-offset-1 dark:ring-offset-slate-900' : ''
                    } ${
                      status === 'answered'
                        ? 'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-300 text-emerald-800 dark:text-emerald-300'
                        : status === 'skipped'
                          ? 'bg-red-100 dark:bg-red-950/50 border-red-300 text-red-700'
                          : status === 'marked'
                            ? 'bg-amber-100 dark:bg-amber-950/50 border-amber-300 text-amber-800'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {i + 1}
                    {status === 'marked' && <span className="absolute top-0.5 end-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-4 text-xs space-y-2">
            <p className="font-bold text-slate-800 dark:text-slate-200 mb-2">{t('portalMcqExamDetails')}</p>
            <div className="flex justify-between"><span className="text-slate-500">{t('portalMcqTubeMode')}</span><span className="font-semibold">{config.mode === 'practice' ? 'Practice' : 'Exam'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t('portalMcqQuestions')}</span><span className="font-semibold">{questions.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t('portalMcqStatAnswered')}</span><span className="font-semibold text-emerald-600">{stats.answered}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t('portalMcqStatSkipped')}</span><span className="font-semibold text-red-500">{stats.skipped}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t('portalMcqStatUnanswered')}</span><span className="font-semibold">{stats.unanswered}</span></div>
          </div>

          <button type="button" onClick={finishExam} className="w-full py-3 rounded-xl border-2 border-red-500 text-red-600 dark:text-red-400 font-bold text-sm hover:bg-red-50 dark:hover:bg-red-950/20">
            {config.mode === 'practice' ? t('portalMcqEndPractice') : t('portalMcqEndExam')}
          </button>
        </aside>
      </div>
    </div>
  );
}
