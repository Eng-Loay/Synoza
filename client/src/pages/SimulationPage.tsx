import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import {
  MessageSquare,
  Search,
  FlaskConical,
  ClipboardList,
  Lightbulb,
  Send,
  UserCircle,
  ChevronRight,
  Stethoscope,
  Eye,
  Download,
  Shield,
  ClipboardCheck,
} from "lucide-react";
import api from "../lib/api";
import { downloadTextFile } from "../lib/download";
import { ConnectionStatus } from "../components/ConnectionStatus";
import chestInspectionImg from "../assets/exam/chest-inspection.svg?url";
import chestPalpationImg from "../assets/exam/chest-palpation.svg?url";
import chestPercussionImg from "../assets/exam/chest-percussion.svg?url";
import chestAuscultationImg from "../assets/exam/chest-auscultation.svg?url";
// import { VoiceMicButton } from '../components/VoiceMicButton';
// import { useSpeechInput } from '../hooks/useSpeechInput';

interface Message {
  id: string;
  role: "STUDENT" | "PATIENT" | "EXAMINER" | "SYSTEM";
  content: string;
  stage: string;
  createdAt: string;
}

interface ExamImage {
  url: string;
  caption?: string;
  captionAr?: string;
  maneuver?: string;
}

interface VitalSigns {
  bp?: { value: string; note: string };
  hr?: { value: string; note: string };
  temp?: { value: string; note: string };
  spo2?: { value: string; note: string };
}

interface Session {
  id: string;
  currentStage: string;
  activeManeuver: string | null;
  completedManeuvers: string;
  language: string;
  case: {
    titleEn: string;
    titleAr: string;
    patientName: string;
    patientAge: number;
    patientGender: string;
    patientNationality: string;
    vitalSigns: string;
    physicalExam: string;
    labResults: string;
    examImages: string;
  };
  messages: Message[];
  result?: Record<string, unknown>;
}

const STAGES = [
  "history",
  "examination",
  "investigations",
  "diagnosis",
  "feedback",
] as const;
const STAGE_ICONS = {
  history: MessageSquare,
  examination: Search,
  investigations: FlaskConical,
  diagnosis: ClipboardList,
  feedback: Lightbulb,
};

const EXAM_MANEUVERS = [
  { id: "inspection", nameEn: "Inspection", nameAr: "الفحص البصري" },
  { id: "palpation", nameEn: "Palpation", nameAr: "الجس" },
  { id: "percussion", nameEn: "Percussion", nameAr: "النقر" },
  { id: "auscultation", nameEn: "Auscultation", nameAr: "الاستماع" },
] as const;

const STATION_SECONDS = 15 * 60;

const MANEUVER_OBJECTIVES: Record<
  string,
  { en: string; ar: string; checklistEn: string[]; checklistAr: string[] }
> = {
  inspection: {
    en: "Inspect the precordium, chest wall, and any visible scars. Comment on breathing pattern and chest shape.",
    ar: "افحص منطقة القلب والصدر والـ scars الظاهرة. علّق على نمط التنفس وشكل الصدر.",
    checklistEn: [
      "Scars / deformity",
      "Apex visible",
      "Chest movement",
      "Cyanosis / clubbing",
    ],
    checklistAr: [
      "Scars / deformity",
      "الذروة ظاهرة",
      "حركة الصدر",
      "Cyanosis / clubbing",
    ],
  },
  palpation: {
    en: "Palpate the apex beat, heaves, and thrills. Assess character and position.",
    ar: "اجس نبض الذروة والـ heaves والـ thrills. قيّم المكان والطبيعة.",
    checklistEn: [
      "Apex location",
      "Character (tapping/heaving)",
      "Thrills at RUSB",
      "Parasternal heave",
    ],
    checklistAr: [
      "مكان الذروة",
      "الطبيعة",
      "Thrills عند RUSB",
      "Parasternal heave",
    ],
  },
  percussion: {
    en: "Percuss heart borders and compare with expected normal limits.",
    ar: "انقر حدود القلب وقارن بالطبيعي.",
    checklistEn: [
      "Right heart border",
      "Left heart border",
      "Upper border",
      "Compare lung fields",
    ],
    checklistAr: ["الحد الأيمن", "الحد الأيسر", "الحد العلوي", "قارن بالرئة"],
  },
  auscultation: {
    en: "Auscultate all valve areas with the bell and diaphragm. Describe murmurs systematically.",
    ar: "استمع لكل مناطق الصمامات بالـ bell والـ diaphragm. صِف الـ murmurs بشكل منظم.",
    checklistEn: [
      "Aortic area (RUSB)",
      "Pulmonary area",
      "Mitral area (apex)",
      "Tricuspid area",
      "Radiation to carotids",
    ],
    checklistAr: [
      "Aortic (RUSB)",
      "Pulmonary",
      "Mitral (apex)",
      "Tricuspid",
      "Radiation للـ carotids",
    ],
  },
};

const DEFAULT_MANEUVER_IMAGES: Record<string, string> = {
  inspection: chestInspectionImg,
  palpation: chestPalpationImg,
  percussion: chestPercussionImg,
  auscultation: chestAuscultationImg,
};

function resolveExamImageUrl(maneuverId: string, url: string): string {
  const bundled = DEFAULT_MANEUVER_IMAGES[maneuverId];
  if (bundled) return bundled;
  if (url.startsWith("/exam/") || url.includes("chest-")) {
    return `/exam/chest-${maneuverId}.svg`;
  }
  return url;
}

const maneuverStage = (id: string) => `examination:${id}`;
const HISTORY_EXAMINER_STAGE = "history:examiner";

function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function ChatTypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
          {label}
        </p>
      </div>
    </div>
  );
}

export default function SimulationPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith("ar");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [activeStage, setActiveStage] = useState("history");
  const [activeManeuver, setActiveManeuver] = useState<string | null>(null);
  const [completedManeuvers, setCompletedManeuvers] = useState<string[]>([]);
  const [showExaminerPanel, setShowExaminerPanel] = useState(false);
  const [input, setInput] = useState("");
  const [lang, setLang] = useState<"AUTO" | "AR" | "EN">("AUTO");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(STATION_SECONDS);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [vivaActive, setVivaActive] = useState(false);
  // const [micError, setMicError] = useState('');
  // const speechLang =
  //   lang === 'AR' ? 'ar-EG' : lang === 'EN' ? 'en-US' : isAr ? 'ar-EG' : 'en-US';

  const sendMessage = useCallback(
    async (overrideText?: string): Promise<boolean> => {
      const text = (overrideText ?? input).trim();
      if (!text || sending) return false;
      setSending(true);
      setChatError("");
      if (!overrideText) setInput("");

      const isExamViva = activeStage === "examination" && activeManeuver;
      const endpoint =
        isExamViva || activeStage === "diagnosis" || showExaminerPanel
          ? "examiner"
          : "chat";
      const stage = isExamViva
        ? maneuverStage(activeManeuver!)
        : activeStage === "history" && showExaminerPanel
          ? HISTORY_EXAMINER_STAGE
          : activeStage;

      const studentMsg: Message = {
        id: `tmp-${Date.now()}`,
        role: "STUDENT",
        content: text,
        stage,
        createdAt: new Date().toISOString(),
      };
      setSession((prev) =>
        prev ? { ...prev, messages: [...prev.messages, studentMsg] } : prev,
      );

      try {
        const res = await api.post(`/sessions/${sessionId}/${endpoint}`, {
          message: text,
          stage,
          ...(isExamViva ? { maneuverId: activeManeuver } : {}),
        });
        setSession((prev) => {
          if (!prev) return prev;
          const base = prev.messages.filter((m) => m.id !== studentMsg.id);
          const next = [...base, studentMsg];
          if (!next.some((m) => m.id === res.data.message.id)) {
            next.push(res.data.message);
          }
          return { ...prev, messages: next };
        });
        return true;
      } catch (err) {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.filter((m) => m.id !== studentMsg.id),
              }
            : prev,
        );
        if (!overrideText) setInput(text);
        if (!axios.isAxiosError(err) || !err.response) {
          setChatError(t("chatErrorOffline"));
        } else {
          setChatError(String(err.response.data?.error || t("chatError")));
        }
        return false;
      } finally {
        setSending(false);
      }
    },
    [
      input,
      sending,
      activeStage,
      activeManeuver,
      showExaminerPanel,
      sessionId,
      t,
    ],
  );

  // const { isListening, isSupported: isMicSupported, toggleListening } = useSpeechInput({
  //   lang: speechLang,
  //   onResult: (transcript) => {
  //     setMicError('');
  //     void sendMessage(transcript);
  //   },
  //   onError: (code) => {
  //     if (code === 'not-supported') setMicError(t('micNotSupported'));
  //     else if (code === 'not-allowed') setMicError(t('micPermissionDenied'));
  //     else setMicError(t('micError'));
  //   },
  // });
  const loadSession = useCallback(async () => {
    const res = await api.get(`/sessions/${sessionId}`);
    const s = res.data.session as Session;
    setSession(s);
    setActiveManeuver(s.activeManeuver);
    setCompletedManeuvers(parseJsonArray(s.completedManeuvers, []));
    if (s.result) {
      setResult(s.result);
      setActiveStage("feedback");
    } else {
      setActiveStage(s.currentStage || "history");
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    const timer = setInterval(
      () => setSecondsLeft((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages, activeStage, activeManeuver, sending]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  let vitals: VitalSigns = {};
  let examImages: ExamImage[] = [];
  try {
    if (session) {
      vitals = JSON.parse(session.case.vitalSigns);
      examImages = parseJsonArray(session.case.examImages, []);
    }
  } catch {
    /* empty */
  }

  const isManeuverUnlocked = (id: string, index: number) =>
    index === 0 || completedManeuvers.includes(EXAM_MANEUVERS[index - 1].id);

  const startManeuver = async (maneuverId: string) => {
    setSending(true);
    try {
      const res = await api.post(`/sessions/${sessionId}/maneuver/start`, {
        maneuverId,
      });
      setActiveManeuver(maneuverId);
      setVivaActive(true);
      setActiveStage("examination");
      setSession((prev) =>
        prev
          ? {
              ...prev,
              activeManeuver: maneuverId,
              currentStage: "examination",
              messages: prev.messages.some((m) => m.id === res.data.message.id)
                ? prev.messages
                : [...prev.messages, res.data.message],
            }
          : prev,
      );
    } finally {
      setSending(false);
    }
  };

  const completeManeuver = async () => {
    if (!activeManeuver) return;
    const res = await api.post(`/sessions/${sessionId}/maneuver/complete`, {
      maneuverId: activeManeuver,
    });
    setCompletedManeuvers(res.data.completedManeuvers);
    setActiveManeuver(null);
    setVivaActive(false);
    setSession((prev) =>
      prev
        ? {
            ...prev,
            activeManeuver: null,
            completedManeuvers: JSON.stringify(res.data.completedManeuvers),
          }
        : prev,
    );
  };

  const changeStage = (stage: string) => {
    setActiveStage(stage);
    api.patch(`/sessions/${sessionId}/stage`, { stage });
    if (
      stage === "examination" &&
      !activeManeuver &&
      completedManeuvers.length === 0
    ) {
      startManeuver("inspection");
    }
  };

  const completeSession = async () => {
    setCompleting(true);
    setCompleteError("");
    const evaluationLanguage =
      lang === "AR" ? "AR" : lang === "EN" ? "EN" : i18n.language.startsWith("ar") ? "AR" : "EN";
    try {
      const res = await api.post(`/sessions/${sessionId}/complete`, {
        language: evaluationLanguage,
      });
      setResult(res.data.result);
      setActiveStage("feedback");
    } catch (err) {
      if (!axios.isAxiosError(err) || !err.response) {
        setCompleteError(t("chatErrorOffline"));
      } else {
        setCompleteError(String(err.response.data?.error || t("completeSessionError")));
      }
    } finally {
      setCompleting(false);
    }
  };

  const quitSession = async () => {
    await api.post(`/sessions/${sessionId}/abandon`);
    navigate("/student");
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const historyPatientMessages = session.messages.filter(
    (m) =>
      m.stage === "history" && (m.role === "STUDENT" || m.role === "PATIENT"),
  );

  const historyExaminerMessages = session.messages.filter(
    (m) =>
      m.stage === HISTORY_EXAMINER_STAGE &&
      (m.role === "STUDENT" || m.role === "EXAMINER"),
  );

  const activeHistoryMessages = showExaminerPanel
    ? historyExaminerMessages
    : historyPatientMessages;

  const maneuverMessages = activeManeuver
    ? session.messages.filter(
        (m) =>
          m.stage === maneuverStage(activeManeuver) &&
          (m.role === "STUDENT" || m.role === "EXAMINER"),
      )
    : [];

  const diagnosisMessages = session.messages.filter(
    (m) =>
      m.stage === "diagnosis" &&
      (m.role === "STUDENT" || m.role === "EXAMINER"),
  );

  const activeManeuverMeta = EXAM_MANEUVERS.find(
    (m) => m.id === activeManeuver,
  );

  const downloadChatTranscript = () => {
    const title = isAr ? session.case.titleAr : session.case.titleEn;
    const lines = session.messages.map((m) => {
      const role =
        m.role === "STUDENT"
          ? "Student"
          : m.role === "PATIENT"
            ? "Patient"
            : m.role === "EXAMINER"
              ? "Examiner"
              : m.role;
      return `[${new Date(m.createdAt).toLocaleString()}] [${m.stage}] ${role}: ${m.content}`;
    });
    const body = [
      `Synoza OSCE Chat Transcript`,
      `Station: ${title}`,
      `Patient: ${session.case.patientName}`,
      `Session: ${session.id}`,
      `Exported: ${new Date().toLocaleString()}`,
      "",
      ...lines,
    ].join("\n");
    downloadTextFile(`synoza-chat-${session.id.slice(0, 8)}.txt`, body);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Synoza OSCE
            </p>
            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
              {isAr ? session.case.titleAr : session.case.titleEn}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ConnectionStatus />
            <button
              type="button"
              onClick={downloadChatTranscript}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Download size={14} /> {t("downloadChat")}
            </button>
            <button
              onClick={() => setShowExaminerPanel((v) => !v)}
              className={`hidden sm:block text-xs font-bold px-3 py-1.5 rounded border ${
                showExaminerPanel
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200"
                  : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
              }`}
            >
              {t("viewExaminer")}
            </button>
            <div
              className={`px-3 py-1 rounded font-mono text-sm font-bold ${secondsLeft < 120 ? "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"}`}
            >
              {formatTime(secondsLeft)}
            </div>
            <button
              onClick={quitSession}
              className="bg-red-500 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-red-600"
            >
              {t("quit")}
            </button>
          </div>
        </div>

        {/* Stage tabs */}
        <div className="flex gap-0 mt-2 -mb-px overflow-x-auto">
          {STAGES.map((stage) => {
            const Icon = STAGE_ICONS[stage];
            return (
              <button
                key={stage}
                onClick={() => changeStage(stage)}
                className={`flex items-center gap-1.5 px-5 py-2.5 text-sm border-b-2 whitespace-nowrap transition-colors ${
                  activeStage === stage
                    ? "border-primary text-primary font-semibold bg-primary/5"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <Icon size={15} /> {t(stage)}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 hidden md:flex flex-col shrink-0">
          {activeStage === "examination" ? (
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 mb-1">
                <Stethoscope size={18} className="text-primary" />
                <h2 className="font-bold text-sm text-slate-800 dark:text-white">
                  {t("physicalExam")}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                {t("physicalExamDesc")}
              </p>
              <div className="space-y-2 mb-4">
                {EXAM_MANEUVERS.map((m, i) => {
                  const unlocked = isManeuverUnlocked(m.id, i);
                  const active = activeManeuver === m.id;
                  const done = completedManeuvers.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      disabled={!unlocked || sending}
                      onClick={() => unlocked && startManeuver(m.id)}
                      className={`w-full text-left px-3 py-3 rounded-lg border text-sm transition-all ${
                        active
                          ? "border-primary bg-primary text-white shadow-md"
                          : done
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : unlocked
                              ? "border-slate-200 dark:border-slate-700 hover:border-primary/50 text-slate-700 dark:text-slate-200"
                              : "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      <p className="font-semibold">
                        {isAr ? m.nameAr : m.nameEn}
                      </p>
                      <p
                        className={`text-[10px] mt-0.5 ${active ? "text-white/80" : ""}`}
                      >
                        {active
                          ? t("activeViva")
                          : done
                            ? t("completed")
                            : unlocked
                              ? t("clickToStart")
                              : t("locked")}
                      </p>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                  {t("vitalSigns")}
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["bp", "hr", "temp", "spo2"] as const).map((key) => {
                    const v = vitals[key];
                    return (
                      <div
                        key={key}
                        className="border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800"
                      >
                        <p className="text-[9px] font-bold text-slate-400 uppercase">
                          {key}
                        </p>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {v?.value || "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                  <UserCircle size={28} className="text-slate-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">
                    {session.case.patientName}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {session.case.patientAge} {isAr ? "سنة" : "yo"} ·{" "}
                    {session.case.patientGender}
                  </p>
                </div>
              </div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                {t("vitalSigns")}
              </h3>
              <div className="grid grid-cols-2 gap-1.5 mb-4">
                {(["bp", "hr", "temp", "spo2"] as const).map((key) => {
                  const v = vitals[key];
                  return (
                    <div
                      key={key}
                      className="border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800"
                    >
                      <p className="text-[9px] font-bold text-slate-400 uppercase">
                        {key}
                      </p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {v?.value || "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950 relative">
          {completing && (
            <div className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
              <div className="card p-8 text-center max-w-sm mx-4">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="font-semibold text-slate-900 dark:text-white">{t("generatingFeedback")}</p>
                <p className="text-sm text-slate-500 mt-2">{t("feedbackGeneratedFromChat")}</p>
              </div>
            </div>
          )}
          {activeStage === "feedback" && result ? (
            <div className="flex-1 overflow-y-auto p-4">
              <FeedbackView
                result={result}
                t={t}
                session={session}
                isAr={isAr}
                onRegenerate={completeSession}
                regenerating={completing}
              />
            </div>
          ) : activeStage === "examination" ? (
            <ExaminationView
              session={session}
              isAr={isAr}
              t={t}
              activeManeuver={activeManeuver}
              activeManeuverMeta={activeManeuverMeta}
              vivaActive={vivaActive}
              examImages={examImages}
              messages={maneuverMessages}
              input={input}
              setInput={setInput}
              sendMessage={sendMessage}
              sending={sending}
              chatError={chatError}
              completeManeuver={completeManeuver}
              chatEndRef={chatEndRef}
              lang={lang}
              setLang={setLang}
            />
          ) : activeStage === "investigations" ? (
            <InvestigationsView
              t={t}
              isAr={isAr}
              labResults={session.case.labResults}
            />
          ) : activeStage === "diagnosis" ? (
            <DiagnosisView
              t={t}
              messages={diagnosisMessages}
              sendMessage={sendMessage}
              sending={sending}
              chatError={chatError}
              completeSession={completeSession}
              completing={completing}
              completeError={completeError}
              chatEndRef={chatEndRef}
            />
          ) : (
            <HistoryChatView
              t={t}
              session={session}
              messages={activeHistoryMessages}
              input={input}
              setInput={setInput}
              sendMessage={sendMessage}
              sending={sending}
              chatError={chatError}
              chatEndRef={chatEndRef}
              lang={lang}
              setLang={setLang}
              showExaminerPanel={showExaminerPanel}
              setShowExaminerPanel={setShowExaminerPanel}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function ExaminationView({
  session,
  isAr,
  t,
  activeManeuver,
  activeManeuverMeta,
  vivaActive,
  examImages,
  messages,
  input,
  setInput,
  sendMessage,
  sending,
  chatError,
  completeManeuver,
  chatEndRef,
  lang,
  setLang,
}: {
  session: Session;
  isAr: boolean;
  t: (k: string) => string;
  activeManeuver: string | null;
  activeManeuverMeta?: (typeof EXAM_MANEUVERS)[number];
  vivaActive: boolean;
  examImages: ExamImage[];
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  sendMessage: (text?: string) => void | Promise<void>;
  sending: boolean;
  chatError: string;
  completeManeuver: () => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  lang: "AUTO" | "AR" | "EN";
  setLang: (l: "AUTO" | "AR" | "EN") => void;
}) {
  if (!activeManeuver || !activeManeuverMeta) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-500">
        <div>
          <Eye size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium">{t("selectManeuver")}</p>
          <p className="text-sm mt-1">{t("selectManeuverDesc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Station header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {isAr ? activeManeuverMeta.nameAr : activeManeuverMeta.nameEn} ·{" "}
            {t("observationStation")}
          </p>
          <p className="text-sm font-bold text-slate-800 dark:text-white uppercase">
            {t("mustExaminerPanel")}
          </p>
        </div>
        {vivaActive && (
          <span className="text-[10px] font-bold uppercase px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            {t("oralCheckInProgress")}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeManeuver && (
          <ClinicalStationPanel
            maneuverId={activeManeuver}
            examImages={examImages}
            isAr={isAr}
            t={t}
          />
        )}

        {/* Clinical examiner chat */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col min-h-[280px]">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <Stethoscope size={16} className="text-amber-700" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">
                {t("clinicalExaminer")}
              </p>
              <p className="text-xs text-slate-600">
                {isAr ? activeManeuverMeta.nameAr : activeManeuverMeta.nameEn}
              </p>
            </div>
          </div>

          <div
            className="flex-1 p-4 overflow-y-auto space-y-3 max-h-64"
            dir="ltr"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                {t("examinerWillStart")}
              </p>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "STUDENT" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm ${
                      msg.role === "STUDENT"
                        ? "bg-primary text-white rounded-br-sm"
                        : "bg-amber-50 border border-amber-100 text-amber-950 rounded-bl-sm"
                    }`}
                  >
                    <span dir="auto">{msg.content}</span>
                  </div>
                </div>
              ))
            )}
            {sending && <ChatTypingIndicator label={t("examinerTyping")} />}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            {chatError && (
              <p className="text-xs text-red-500 mb-2">{chatError}</p>
            )}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {/* Voice input hidden for now
              <VoiceMicButton
                isListening={isListening}
                isSupported={isMicSupported}
                disabled={sending}
                onClick={onToggleMic}
                listeningLabel={t('micListening')}
                notSupportedLabel={t('micNotSupported')}
              />
              {(['AUTO', 'AR', 'EN'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`text-xs px-2 py-1 rounded ${lang === l ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                >
                  {l === 'AUTO' ? t('auto') : l === 'AR' ? t('arabic') : t('english')}
                </button>
              ))}
              {micError && <p className="text-xs text-red-500 mb-2">{micError}</p>}
              {isListening && <p className="text-xs text-primary mb-2">{t('micListening')}</p>}
              */}
              <button
                type="button"
                onClick={completeManeuver}
                className="ml-auto text-xs btn-secondary"
              >
                {t("completeStep")}{" "}
                <ChevronRight size={14} className="inline" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                placeholder={t("describeFindings")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                disabled={sending}
              />
              <button
                onClick={() => sendMessage()}
                disabled={sending}
                className="w-11 h-11 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary-dark disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryChatView({
  t,
  session,
  messages,
  input,
  setInput,
  sendMessage,
  sending,
  chatError,
  chatEndRef,
  lang,
  setLang,
  showExaminerPanel,
  setShowExaminerPanel,
}: {
  t: (k: string) => string;
  session: Session;
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  sendMessage: (text?: string) => void | Promise<void>;
  sending: boolean;
  chatError: string;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  lang: "AUTO" | "AR" | "EN";
  setLang: (l: "AUTO" | "AR" | "EN") => void;
  showExaminerPanel: boolean;
  setShowExaminerPanel: (value: boolean) => void;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 shrink-0">
        <button
          type="button"
          onClick={() => setShowExaminerPanel(false)}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
            !showExaminerPanel
              ? "bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-600 shadow-sm"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
          }`}
        >
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
              !showExaminerPanel
                ? "bg-sky-500 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
            }`}
          >
            <UserCircle size={24} />
          </div>
          <div className="min-w-0">
            <p
              className={`text-[11px] font-bold uppercase tracking-wider ${
                !showExaminerPanel
                  ? "text-sky-700 dark:text-sky-300"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {t("patientEncounter")}
            </p>
            <p
              className={`text-sm font-semibold truncate ${
                !showExaminerPanel
                  ? "text-sky-900 dark:text-sky-100"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {session.case.patientName}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowExaminerPanel(true)}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
            showExaminerPanel
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-600 shadow-sm"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
          }`}
        >
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
              showExaminerPanel
                ? "bg-amber-500 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
            }`}
          >
            <Shield size={22} />
          </div>
          <div className="min-w-0">
            <p
              className={`text-[11px] font-bold uppercase tracking-wider ${
                showExaminerPanel
                  ? "text-amber-800 dark:text-amber-300"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {t("examinerBox")}
            </p>
            <p
              className={`text-sm font-medium ${
                showExaminerPanel
                  ? "text-amber-900 dark:text-amber-100"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {t("vivaQuestions")}
            </p>
          </div>
        </button>
      </div>

      <div className="card flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {showExaminerPanel
              ? t("examinerBox")
              : `${t("interviewLog")}: ${session.case.patientName}`}
          </h3>
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />{" "}
            {t("active")}
          </span>
        </div>

        <div
          className="flex-1 p-4 overflow-y-auto space-y-3 bg-white dark:bg-slate-900"
          dir="ltr"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 py-12">
              {showExaminerPanel ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                    <Shield
                      size={32}
                      className="text-slate-300 dark:text-slate-500"
                    />
                  </div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">
                    {t("examinerBox")}
                  </p>
                  <p className="text-sm mt-1 text-center max-w-sm">
                    {t("startExaminerViva")}
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                    <UserCircle
                      size={32}
                      className="text-slate-300 dark:text-slate-500"
                    />
                  </div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">
                    {t("simulatedInterview")}
                  </p>
                  <p className="text-sm mt-1 text-center max-w-sm">
                    {t("startInterview")}
                  </p>
                </>
              )}
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "STUDENT" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                    msg.role === "STUDENT"
                      ? "bg-primary text-white rounded-br-md"
                      : msg.role === "EXAMINER"
                        ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 rounded-bl-md"
                        : "bg-teal-50 dark:bg-slate-800 border border-teal-100 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-md"
                  }`}
                >
                  <span dir="auto">{msg.content}</span>
                </div>
              </div>
            ))
          )}
          {sending && (
            <ChatTypingIndicator
              label={
                showExaminerPanel ? t("examinerTyping") : t("patientTyping")
              }
            />
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          {chatError && (
            <p className="text-xs text-red-500 mb-2">{chatError}</p>
          )}
          {/* Voice input hidden for now
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <VoiceMicButton
              isListening={isListening}
              isSupported={isMicSupported}
              disabled={sending}
              onClick={onToggleMic}
              listeningLabel={t('micListening')}
              notSupportedLabel={t('micNotSupported')}
            />
            {(['AUTO', 'AR', 'EN'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`text-xs px-2 py-1 rounded ${lang === l ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
              >
                {l === 'AUTO' ? t('auto') : l === 'AR' ? t('arabic') : t('english')}
              </button>
            ))}
          </div>
          {micError && <p className="text-xs text-red-500 mb-2">{micError}</p>}
          {isListening && <p className="text-xs text-primary mb-2">{t('micListening')}</p>}
          */}
          <div className="flex gap-2">
            <input
              className="input-field flex-1"
              placeholder={
                showExaminerPanel ? t("askExaminer") : t("askPatient")
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={sending}
            />
            <button
              onClick={() => sendMessage()}
              disabled={sending}
              className="w-11 h-11 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary-dark disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DiagnosisView({
  t,
  messages,
  sendMessage,
  sending,
  chatError,
  completeSession,
  completing,
  completeError,
  chatEndRef,
}: {
  t: (k: string) => string;
  messages: Message[];
  sendMessage: (text?: string) => Promise<boolean>;
  sending: boolean;
  chatError: string;
  completeSession: () => void | Promise<void>;
  completing: boolean;
  completeError: string;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [impression, setImpression] = useState("");
  const [management, setManagement] = useState("");

  const buildSubmission = () => {
    const parts: string[] = [];
    if (impression.trim()) {
      parts.push(`${t("diagnosticImpression")}:\n${impression.trim()}`);
    }
    if (management.trim()) {
      parts.push(`${t("initialManagement")}:\n${management.trim()}`);
    }
    return parts.join("\n\n");
  };

  const handleSubmit = async () => {
    const text = buildSubmission();
    if (!text) return;
    const ok = await sendMessage(text);
    if (ok) {
      setImpression("");
      setManagement("");
    }
  };

  const canSubmit = impression.trim() || management.trim();

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-10">
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 text-primary text-[11px] font-semibold tracking-wider uppercase bg-white dark:bg-slate-900 shadow-sm">
            <Stethoscope size={14} />
            {t("diagnosticFinalizationStation")}
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-center text-slate-900 dark:text-white mb-3">
          {t("clinicalFormulation")}
        </h1>
        <p className="text-center text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-10 text-sm md:text-base leading-relaxed">
          {t("clinicalFormulationDesc")}
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
            <div className="flex items-center gap-2 mb-4 text-teal-600 dark:text-teal-400">
              <Search size={18} />
              <span className="text-xs font-bold tracking-wider uppercase">
                {t("diagnosticImpression")}
              </span>
            </div>
            <textarea
              className="w-full min-h-[220px] rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-4 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              placeholder={t("diagnosticImpressionPlaceholder")}
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
            <div className="flex items-center gap-2 mb-4 text-emerald-600 dark:text-emerald-400">
              <ClipboardCheck size={18} />
              <span className="text-xs font-bold tracking-wider uppercase">
                {t("initialManagement")}
              </span>
            </div>
            <textarea
              className="w-full min-h-[220px] rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-4 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder={t("initialManagementPlaceholder")}
              value={management}
              onChange={(e) => setManagement(e.target.value)}
              disabled={sending}
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 mb-10">
          {(chatError || completeError) && (
            <p className="text-sm text-red-500 text-center">{chatError || completeError}</p>
          )}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => void handleSubmit()}
              disabled={sending || completing || !canSubmit}
              className="btn-primary px-8 min-w-[200px] flex items-center justify-center gap-2"
            >
              <Send size={16} />
              {sending ? t("examinerTyping") : t("submitToExaminer")}
            </button>
            <button
              onClick={() => void completeSession()}
              disabled={completing || sending}
              className="btn-secondary px-8 min-w-[200px] flex items-center justify-center gap-2"
            >
              {completing ? (
                <>
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {t("generatingFeedback")}
                </>
              ) : (
                t("completeSession")
              )}
            </button>
          </div>
        </div>

        {messages.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase bg-white dark:bg-slate-900">
              {t("clinicalExaminer")}
            </div>
            <div
              className="max-h-72 p-4 overflow-y-auto space-y-3 bg-white dark:bg-slate-900"
              dir="ltr"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "STUDENT" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === "STUDENT" ? "bg-primary text-white" : "bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-800 text-amber-950 dark:text-amber-100"}`}
                  >
                    <span dir="auto">{msg.content}</span>
                  </div>
                </div>
              ))}
              {sending && <ChatTypingIndicator label={t("examinerTyping")} />}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClinicalStationPanel({
  maneuverId,
  examImages,
  isAr,
  t,
}: {
  maneuverId: string;
  examImages: ExamImage[];
  isAr: boolean;
  t: (k: string) => string;
}) {
  const objective = MANEUVER_OBJECTIVES[maneuverId];
  const stationImages = examImages.filter(
    (img) => !img.maneuver || img.maneuver === maneuverId,
  );
  const fallbackUrl =
    DEFAULT_MANEUVER_IMAGES[maneuverId] || DEFAULT_MANEUVER_IMAGES.inspection;
  const displayImages =
    stationImages.length > 0
      ? stationImages.map((img) => ({
          ...img,
          url: resolveExamImageUrl(maneuverId, img.url),
        }))
      : [
          {
            url: fallbackUrl,
            caption: t("clinicalStation"),
            captionAr: t("clinicalStation"),
          },
        ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase mb-1">
          {t("patientSlideGallery")}
        </p>
        {objective && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {isAr ? objective.ar : objective.en}
          </p>
        )}
      </div>

      <div className="grid gap-3">
        {displayImages.map((img, i) => (
          <div
            key={`${img.url}-${i}`}
            className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950"
          >
            <img
              src={img.url}
              alt={img.caption || "Clinical station"}
              className="w-full max-h-80 object-contain mx-auto"
            />
            {(img.caption || img.captionAr) && (
              <p className="text-xs text-slate-400 px-3 py-2 border-t border-slate-800">
                {isAr ? img.captionAr || img.caption : img.caption}
              </p>
            )}
          </div>
        ))}
      </div>

      {objective && (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3">
          <p className="text-[10px] font-bold text-primary uppercase mb-2">
            {t("examChecklist")}
          </p>
          <ul className="grid sm:grid-cols-2 gap-1.5">
            {(isAr ? objective.checklistAr : objective.checklistEn).map(
              (item) => (
                <li
                  key={item}
                  className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5"
                >
                  <span className="text-primary mt-0.5">•</span>
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

interface LabSection {
  title: string;
  titleAr?: string;
  content: string;
  contentAr?: string;
}

function InvestigationsView({
  t,
  isAr,
  labResults,
}: {
  t: (k: string) => string;
  isAr: boolean;
  labResults: string;
}) {
  let sections: LabSection[] = [];
  try {
    const parsed = JSON.parse(labResults);
    if (Array.isArray(parsed.sections)) sections = parsed.sections;
  } catch {
    /* plain text fallback */
  }

  if (sections.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <StageContent title={t("investigations")} content={labResults} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="card p-4">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
          {t("investigations")}
        </h3>
        <p className="text-sm text-slate-500">{t("investigationsDesc")}</p>
      </div>
      {sections.map((section) => (
        <div key={section.title} className="card p-5">
          <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
            {isAr ? section.titleAr || section.title : section.title}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
            {isAr ? section.contentAr || section.content : section.content}
          </p>
        </div>
      ))}
    </div>
  );
}

function StageContent({ title, content }: { title: string; content: string }) {
  return (
    <div className="card p-6">
      <h3 className="font-semibold mb-3">{title}</h3>
      <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
        {content}
      </p>
    </div>
  );
}

function FeedbackView({
  result,
  t,
  session,
  isAr,
  onRegenerate,
  regenerating,
}: {
  result: Record<string, unknown>;
  t: (key: string) => string;
  session: Session;
  isAr: boolean;
  onRegenerate?: () => void | Promise<void>;
  regenerating?: boolean;
}) {
  const sections = [
    { key: "strengths", label: t("strengths") },
    { key: "weaknesses", label: t("weaknesses") },
    { key: "missedQuestions", label: t("missedQuestions") },
    { key: "clinicalErrors", label: t("clinicalErrors") },
    { key: "recommendations", label: t("recommendations") },
    { key: "idealApproach", label: t("idealApproach") },
  ];

  const downloadReport = () => {
    const title = isAr ? session.case.titleAr : session.case.titleEn;
    const fullReport =
      (result.fullReport as string) ||
      sections
        .map(({ key, label }) => `## ${label}\n${result[key] as string}`)
        .join("\n\n");
    const body = [
      `# Synoza OSCE Evaluation Report`,
      `Station: ${title}`,
      `Patient: ${session.case.patientName}`,
      `Total Score: ${result.totalScore}%`,
      `Date: ${new Date().toLocaleString()}`,
      "",
      fullReport,
    ].join("\n");
    downloadTextFile(`synoza-report-${session.id.slice(0, 8)}.txt`, body);
  };

  return (
    <div className="space-y-4">
      <div className="card p-6 text-center">
        <p className="text-xs text-slate-500 mb-2">{t("feedbackGeneratedFromChat")}</p>
        <p className="text-sm text-slate-500">{t("totalScore")}</p>
        <p className="text-5xl font-bold text-primary">
          {result.totalScore as number}%
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-4">
          <button
            type="button"
            onClick={downloadReport}
            className="btn-secondary inline-flex items-center gap-2 min-w-[200px] justify-center"
          >
            <Download size={16} /> {t("downloadReport")}
          </button>
          {onRegenerate && (
            <button
              type="button"
              onClick={() => void onRegenerate()}
              disabled={regenerating}
              className="btn-secondary inline-flex items-center gap-2 min-w-[200px] justify-center"
            >
              {regenerating ? t("generatingFeedback") : t("regenerateReport")}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6">
          {(
            [
              ["communicationScore", "scoreCommunication"],
              ["historyTakingScore", "scoreHistory"],
              ["clinicalReasonScore", "scoreClinicalReason"],
              ["organizationScore", "scoreOrganization"],
              ["closingScore", "scoreClosing"],
            ] as const
          ).map(([key, labelKey]) => (
            <div
              key={key}
              className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(labelKey)}
              </p>
              <p className="font-bold text-slate-900 dark:text-white">
                {result[key] as number}%
              </p>
            </div>
          ))}
        </div>
      </div>
      {sections.map(({ key, label }) => (
        <div key={key} className="card p-5">
          <h4 className="font-semibold mb-2 text-slate-900 dark:text-white">
            {label}
          </h4>
          <p
            className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap"
            dir="auto"
          >
            {result[key] as string}
          </p>
        </div>
      ))}
      {Boolean(result.fullReport) && (
        <div className="card p-5">
          <h4 className="font-semibold mb-2 text-slate-900 dark:text-white">
            {t("fullReport")}
          </h4>
          <div
            className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none"
            dir="auto"
          >
            {(result.fullReport as string).replace(/^## /gm, "### ")}
          </div>
        </div>
      )}
    </div>
  );
}
