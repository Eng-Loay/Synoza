import OpenAI from 'openai';
import type { Case, Language } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getCategoryKnowledgeContext } from './knowledgeService.js';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SessionMessage {
  role: string;
  content: string;
  stage: string;
  createdAt?: Date | string;
}

export interface EvaluationSessionContext {
  completedManeuvers?: string[];
  durationSeconds?: number;
}

export interface EvaluationResult {
  totalScore: number;
  communicationScore: number;
  historyTakingScore: number;
  clinicalReasonScore: number;
  organizationScore: number;
  closingScore: number;
  strengths: string;
  weaknesses: string;
  missedQuestions: string;
  clinicalErrors: string;
  recommendations: string;
  idealApproach: string;
  fullReport: string;
}

function formatStageLabel(stage: string): string {
  if (stage === 'history') return 'History — Patient Interview';
  if (stage === 'history:examiner') return 'History — Examiner Viva';
  if (stage.startsWith('examination:')) {
    const maneuver = stage.split(':')[1] || 'examination';
    return `Examination — ${maneuver.charAt(0).toUpperCase()}${maneuver.slice(1)}`;
  }
  if (stage === 'diagnosis') return 'Diagnosis & Management';
  if (stage === 'investigations') return 'Investigations';
  return stage;
}

export function buildSessionTranscript(caseData: Case, messages: SessionMessage[]): string {
  const studentCount = messages.filter((m) => m.role === 'STUDENT').length;
  const lines = [
    '=== FULL OSCE SESSION TRANSCRIPT ===',
    `Case: ${caseData.titleEn}`,
    `Patient: ${caseData.patientName}, ${caseData.patientAge}y ${caseData.patientGender}`,
    `Correct Diagnosis: ${caseData.finalDiagnosis}`,
    `Chief Complaint: ${caseData.chiefComplaint}`,
    `Teaching Points: ${caseData.teachingPoints}`,
    `Evaluation Rubric: ${caseData.evaluationRubric}`,
    `Student messages: ${studentCount} | Total messages: ${messages.length}`,
    '',
  ];

  let currentStage = '';
  for (const msg of messages) {
    if (msg.stage !== currentStage) {
      currentStage = msg.stage;
      lines.push(`\n--- ${formatStageLabel(currentStage)} ---`);
    }
    lines.push(`[${msg.role}]: ${msg.content}`);
  }

  return lines.join('\n');
}

function clampScore(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeEvaluation(
  raw: Partial<EvaluationResult>,
  fallback: EvaluationResult
): EvaluationResult {
  return {
    totalScore: clampScore(raw.totalScore, fallback.totalScore),
    communicationScore: clampScore(raw.communicationScore, fallback.communicationScore),
    historyTakingScore: clampScore(raw.historyTakingScore, fallback.historyTakingScore),
    clinicalReasonScore: clampScore(raw.clinicalReasonScore, fallback.clinicalReasonScore),
    organizationScore: clampScore(raw.organizationScore, fallback.organizationScore),
    closingScore: clampScore(raw.closingScore, fallback.closingScore),
    strengths: String(raw.strengths || fallback.strengths),
    weaknesses: String(raw.weaknesses || fallback.weaknesses),
    missedQuestions: String(raw.missedQuestions || fallback.missedQuestions),
    clinicalErrors: String(raw.clinicalErrors || fallback.clinicalErrors),
    recommendations: String(raw.recommendations || fallback.recommendations),
    idealApproach: String(raw.idealApproach || fallback.idealApproach),
    fullReport: String(raw.fullReport || fallback.fullReport),
  };
}

function hasPattern(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function buildPatientSystemPrompt(caseData: Case, language: Language, knowledgeContext: string): string {
  const langNote =
    language === 'AR'
      ? 'Respond ONLY in Arabic (Egyptian medical Arabic when appropriate).'
      : language === 'EN'
        ? 'Respond ONLY in English.'
        : 'Respond in the same language the student uses (Arabic or English).';

  return `You are a simulated patient in an OSCE clinical examination. Stay fully in character.

INTERNAL BACKGROUND (never volunteer this — only reveal the specific fact if directly asked):
- Name: ${caseData.patientName}
- Age: ${caseData.patientAge} | Gender: ${caseData.patientGender} | Nationality: ${caseData.patientNationality}
- Chief complaint: ${caseData.chiefComplaint}
- Medical history: ${caseData.medicalHistory}
- Medications: ${caseData.medicationHistory}
- Surgical history: ${caseData.surgicalHistory}
- Family history: ${caseData.familyHistory}
- Social history: ${caseData.socialHistory}
- Personality: ${caseData.patientPersonality || 'Cooperative but anxious about symptoms'}
- Scenario: ${caseData.scenarioPrompt || 'Standard OSCE patient encounter'}

STRICT RULES — violating these fails the simulation:
1. NEVER reveal the diagnosis (${caseData.finalDiagnosis}) directly.
2. Answer ONLY the specific question asked. One topic per answer. No extra sentences.
3. NEVER volunteer symptoms, name, age, history, medications, or complaints unprompted.
4. Greeting only (Hello / Hi / السلام عليكم / صباح الخير) → reply ONLY "Hello doctor." or "أهلاً دكتور." — nothing else.
5. Doctor introduces themselves → brief polite greeting back only. Do NOT describe your problem.
6. Asked your name → name only. Asked age → age only. Asked "what brought you" / symptoms → chief complaint only.
7. Lay language, not medical jargon. If unsure, say you don't know.
8. Unclear question → ask the doctor to clarify. Do NOT guess or dump information.
9. ${langNote}
${knowledgeContext}`;
}

function pickLang(en: string, ar: string, lang: 'AR' | 'EN'): string {
  return lang === 'AR' ? ar : en;
}

function textHasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function mergeEvaluationWithLanguage(
  ai: EvaluationResult,
  localized: EvaluationResult,
  lang: 'AR' | 'EN'
): EvaluationResult {
  if (lang === 'EN') return ai;

  const pick = (aiText: string, localizedText: string) =>
    textHasArabic(aiText) ? aiText : localizedText;

  return {
    ...ai,
    strengths: pick(ai.strengths, localized.strengths),
    weaknesses: pick(ai.weaknesses, localized.weaknesses),
    missedQuestions: pick(ai.missedQuestions, localized.missedQuestions),
    clinicalErrors: pick(ai.clinicalErrors, localized.clinicalErrors),
    recommendations: pick(ai.recommendations, localized.recommendations),
    idealApproach: pick(ai.idealApproach, localized.idealApproach),
    fullReport: pick(ai.fullReport, localized.fullReport),
  };
}

export function resolveEvaluationLanguage(
  sessionLang: Language,
  messages: SessionMessage[],
  uiLang?: string
): 'AR' | 'EN' {
  if (uiLang === 'AR' || uiLang === 'EN') return uiLang;
  if (sessionLang === 'AR') return 'AR';
  if (sessionLang === 'EN') return 'EN';
  const studentText = messages
    .filter((m) => m.role === 'STUDENT')
    .map((m) => m.content)
    .join(' ');
  return /[\u0600-\u06FF]/.test(studentText) ? 'AR' : 'EN';
}

function buildExaminerEvaluationPrompt(
  caseData: Case,
  knowledgeContext: string,
  lang: 'AR' | 'EN'
): string {
  const langRule =
    lang === 'AR'
      ? '7. Write ALL string fields (strengths, weaknesses, missedQuestions, clinicalErrors, recommendations, idealApproach, fullReport) ONLY in Arabic (Egyptian medical Arabic when appropriate).'
      : '7. Write ALL string fields (strengths, weaknesses, missedQuestions, clinicalErrors, recommendations, idealApproach, fullReport) ONLY in English.';

  const caseTitle = lang === 'AR' ? caseData.titleAr || caseData.titleEn : caseData.titleEn;

  return `You are a senior OSCE clinical examiner. You will receive the COMPLETE transcript of a student's OSCE session (history, examination viva, diagnosis, and all examiner interactions).

CASE CONTEXT:
- Title: ${caseTitle}
- Correct Diagnosis: ${caseData.finalDiagnosis}
- Chief Complaint: ${caseData.chiefComplaint}
- Key Teaching Points: ${caseData.teachingPoints}
- Scoring Rubric: ${caseData.evaluationRubric}
- Physical Exam Findings (expected): ${caseData.physicalExam}

INSTRUCTIONS:
1. Read EVERY [STUDENT] message across ALL stages before scoring.
2. Score based on what the student ACTUALLY did — not generic defaults.
3. Compare their history questions, exam descriptions, and final diagnosis against the case data.
4. Identify specific missed questions, clinical errors, and strengths from the transcript.
5. Write the fullReport as a detailed markdown evaluation referencing specific student actions.
6. Return ONLY valid JSON — no markdown fences, no extra text.
${langRule}

JSON structure (all scores 0-100 integers):
{
  "totalScore": number,
  "communicationScore": number,
  "historyTakingScore": number,
  "clinicalReasonScore": number,
  "organizationScore": number,
  "closingScore": number,
  "strengths": "string — specific strengths from transcript",
  "weaknesses": "string — specific gaps observed",
  "missedQuestions": "string — questions they should have asked but did not",
  "clinicalErrors": "string — errors or unsafe reasoning",
  "recommendations": "string — actionable study recommendations",
  "idealApproach": "string — how an excellent candidate would approach this case",
  "fullReport": "string — comprehensive markdown report covering history, exam, diagnosis, and overall performance"
}${knowledgeContext ? `\n\nDomain knowledge for scoring:\n${knowledgeContext}` : ''}`;
}

async function getAISettings() {
  const defaultModel = process.env.OPENAI_MODEL || 'gpt-5-mini';
  let settings = await prisma.aISettings.findFirst();
  if (!settings) {
    settings = await prisma.aISettings.create({
      data: {
        provider: process.env.AI_PROVIDER || 'openai',
        patientModel: defaultModel,
        examinerModel: defaultModel,
      },
    });
  }
  return {
    ...settings,
    provider: process.env.AI_PROVIDER || settings.provider,
    patientModel: process.env.OPENAI_PATIENT_MODEL || process.env.OPENAI_MODEL || settings.patientModel || defaultModel,
    examinerModel: process.env.OPENAI_EXAMINER_MODEL || process.env.OPENAI_MODEL || settings.examinerModel || defaultModel,
  };
}

async function callOpenAI(messages: ChatMessage[], model: string, temperature: number, maxTokens: number) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  return response.choices[0]?.message?.content || '';
}

function logAiFallback(context: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  console.warn(`[AI] ${context} — OpenAI unavailable, using mock fallback: ${msg}`);
}

async function callOpenAISafe(
  messages: ChatMessage[],
  model: string,
  temperature: number,
  maxTokens: number,
  fallback: () => string
): Promise<string> {
  try {
    return await callOpenAI(messages, model, temperature, maxTokens);
  } catch (error) {
    logAiFallback('chat completion', error);
    return fallback();
  }
}

function resolvePatientLanguage(language: Language, userMessage: string): boolean {
  return language === 'AR' || /[\u0600-\u06FF]/.test(userMessage);
}

function isGreetingOnly(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /^(hi+|hello+|hey+|good\s+(morning|afternoon|evening)|السلام\s*عليكم|السلام|سلام\s*عليكم|سلام|مرحب|أهلا|اهلا|هاي|صباح\s*الخير|مساء\s*الخير)[!.?\s]*$/i.test(
    t,
  );
}

function isDoctorIntroduction(text: string): boolean {
  return /^(good\s+(morning|afternoon|evening)|nice to meet|pleased to meet|i'?m\s+(dr|doctor)|my name is.*(dr|doctor)|أنا\s+(د|دكتور)|اسمي\s+(د|دكتور)|تشرفنا|نورت)/i.test(
    text.trim(),
  );
}

function asksAboutSymptoms(text: string): boolean {
  return /why|what brought|what brings|present|complain|symptom|problem|chief|feel|wrong|happening|issue|breath|dyspnea|swell|pain|chest|tell me about|describe|history of|إيه|ليه|سبب|شكو|عرض|عندك|وجع|ألم|الم|ضيق|تنفس|تورم|حاس|حاسس|إيه اللي|ما الذي/i.test(
    text,
  );
}

function asksName(text: string): boolean {
  return /name|your name|اسم|اسمك|who are you|مين|من انت|may i have your name|what is your name/i.test(
    text,
  );
}

function asksAge(text: string): boolean {
  return /age|old are you|how old|years old|سن|عمر|كم عمر|سنك/i.test(text);
}

function sanitizePatientResponse(
  caseData: Case,
  userMessage: string,
  response: string,
  language: Language,
): string {
  const isArabic = resolvePatientLanguage(language, userMessage);
  const text = userMessage.trim().toLowerCase();
  const trimmed = response.trim();
  if (!trimmed) return trimmed;

  if (isGreetingOnly(userMessage) || isDoctorIntroduction(userMessage)) {
    return isArabic ? 'أهلاً دكتور.' : 'Hello doctor.';
  }

  if (asksName(userMessage) && !asksAboutSymptoms(userMessage)) {
    return isArabic ? `اسمي ${caseData.patientName}.` : `My name is ${caseData.patientName}.`;
  }

  if (asksAge(userMessage) && !asksAboutSymptoms(userMessage)) {
    return isArabic
      ? `عندي ${caseData.patientAge} سنة.`
      : `I am ${caseData.patientAge} years old.`;
  }

  if (!asksAboutSymptoms(userMessage)) {
    const complaintSnippet = caseData.chiefComplaint.toLowerCase().slice(0, 40);
    const responseLower = trimmed.toLowerCase();
    const dumpsComplaint =
      complaintSnippet.length > 10 && responseLower.includes(complaintSnippet.slice(0, 20));
    const dumpsNameAndMore =
      trimmed.includes(caseData.patientName) &&
      (dumpsComplaint || /shortness|breath|swell|swelling|dyspnea|تنفس|تورم|ضيق/i.test(trimmed));

    if (dumpsNameAndMore || dumpsComplaint) {
      if (asksName(userMessage)) {
        return isArabic ? `اسمي ${caseData.patientName}.` : `My name is ${caseData.patientName}.`;
      }
      return isArabic ? 'أهلاً دكتور.' : 'Hello doctor.';
    }
  }

  return trimmed;
}

function getDeterministicPatientResponse(
  caseData: Case,
  userMessage: string,
  language: Language,
  history: { role: string; content: string }[] = [],
): string | null {
  const isArabic = resolvePatientLanguage(language, userMessage);
  const text = userMessage.trim().toLowerCase();
  const name = caseData.patientName;
  const complaint = caseData.chiefComplaint.split('.')[0].trim();
  const studentTurn = history.filter((m) => m.role === 'STUDENT').length;

  if (isGreetingOnly(userMessage) || isDoctorIntroduction(userMessage)) {
    return isArabic ? 'أهلاً دكتور.' : 'Hello doctor.';
  }

  if (asksName(userMessage) && !asksAboutSymptoms(userMessage)) {
    return isArabic ? `اسمي ${name}.` : `My name is ${name}.`;
  }

  if (/how are you|how r u|عامل|إزيك|ازيك|كيف حال|حالك/i.test(text)) {
    return isArabic ? 'مش في أحسن حالي.' : 'Not great, doctor.';
  }

  if (asksAge(userMessage) && !asksAboutSymptoms(userMessage)) {
    return isArabic
      ? `عندي ${caseData.patientAge} سنة.`
      : `I am ${caseData.patientAge} years old.`;
  }

  if (/allerg|حساس|حساسية/i.test(text)) {
    return isArabic ? 'لا، مفيش حساسية من أدوية عندي.' : 'No, I have no known drug allergies.';
  }

  if (/medic|drug|tablet|دوا|أدوية|ادوية/i.test(text)) {
    return isArabic ? 'مش باخد أدوية بانتظام حالياً.' : 'I am not on regular medications currently.';
  }

  if (/family|famil|عيل|أهل|family history/i.test(text)) {
    return isArabic ? 'مفيش حد في العيلة عنده نفس المشكلة.' : 'No similar conditions run in my family.';
  }

  if (asksAboutSymptoms(text)) {
    return isArabic ? `${complaint}.` : `${complaint}.`;
  }

  return null;
}

function mockPatientResponse(
  caseData: Case,
  userMessage: string,
  language: Language,
  history: { role: string; content: string }[] = []
): string {
  const deterministic = getDeterministicPatientResponse(caseData, userMessage, language, history);
  if (deterministic !== null) return deterministic;

  const isArabic = resolvePatientLanguage(language, userMessage);
  const studentTurn = history.filter((m) => m.role === 'STUDENT').length;
  const fallbacks = isArabic
    ? [
        'ممكن توضح سؤالك أكتر؟',
        'مش فاهم قصدك، ممكن تسأل بطريقة أوضح؟',
        'أنا هنا — اسألني اللي محتاج تعرفه.',
      ]
    : [
        'Could you clarify your question?',
        'I am not sure what you mean — please ask more specifically.',
        'I am here — please ask what you need to know.',
      ];

  return fallbacks[studentTurn % fallbacks.length];
}

function mockExaminerEvaluation(
  caseData: Case,
  messages: SessionMessage[],
  lang: 'AR' | 'EN' = 'EN',
  context: EvaluationSessionContext = {}
): EvaluationResult {
  const studentMessages = messages.filter((m) => m.role === 'STUDENT');
  const studentText = studentMessages.map((m) => m.content).join(' ').toLowerCase();
  const studentWordCount = studentText.split(/\s+/).filter((w) => w.length > 1).length;
  const historyMsgCount = studentMessages.filter(
    (m) => m.stage === 'history' || m.stage === 'history:examiner'
  ).length;
  const examMsgCount = studentMessages.filter((m) => m.stage.startsWith('examination:')).length;
  const diagnosisMsgCount = studentMessages.filter((m) => m.stage === 'diagnosis').length;
  const stagesCovered = new Set(studentMessages.map((m) => m.stage)).size;
  const completedManeuvers = context.completedManeuvers ?? [];
  const checklistHits = [
    hasPattern(studentText, /\b(introduc|my name|hello|good (morning|afternoon|evening)|اسم|أنا د|مرحب)/i),
    hasPattern(studentText, /\b(pain|breath|dyspnea|chest|symptom|complaint|ألم|ضيق|تنفس|عرض)/i),
    hasPattern(studentText, /\b(rheumatic|fever|penicillin|prophylaxis|حمى)/i),
    hasPattern(studentText, /\b(medication|medicine|drug|دواء|علاج)/i),
    hasPattern(studentText, /\b(family|عيل|أهل)/i),
    hasPattern(studentText, /\b(syncope|palpitation|orthopnea|إغماء|خفقان)/i),
    hasPattern(studentText, /\b(exertion|exercise|sport|football|مجهود|رياض)/i),
    hasPattern(studentText, /\b(murmur|apex|scar|auscult|palpat|percuss|inspect|صمام|ذرو|ندبة)/i),
  ].filter(Boolean).length;

  const historyText = studentMessages
    .filter((m) => m.stage === 'history' || m.stage === 'history:examiner')
    .map((m) => m.content)
    .join(' ')
    .toLowerCase();
  const examText = studentMessages
    .filter((m) => m.stage.startsWith('examination:'))
    .map((m) => m.content)
    .join(' ')
    .toLowerCase();
  const diagnosisText = studentMessages
    .filter((m) => m.stage === 'diagnosis')
    .map((m) => m.content)
    .join(' ')
    .toLowerCase();

  const askedIntroduction = hasPattern(studentText, /\b(introduc|my name|hello|good (morning|afternoon|evening)|اسم|أنا د|مرحب)/i);
  const askedComplaint = hasPattern(historyText, /\b(pain|breath|dyspnea|chest|symptom|complaint|when|how long|duration|ألم|ضيق|تنفس|عرض)/i);
  const askedRheumatic = hasPattern(historyText, /\b(rheumatic|fever|rheumatic fever|childhood illness|penicillin|prophylaxis|حمى)/i);
  const askedMeds = hasPattern(historyText, /\b(medication|medicine|drug|compliance|prophylaxis|دواء|علاج)/i);
  const askedFamily = hasPattern(historyText, /\b(family|hereditary|genetic|عيل|أهل|family history)/i);
  const askedRedFlags = hasPattern(historyText, /\b(syncope|palpitation|orthopnea|pnd|night sweat|weight|fever|red flag|إغماء|خفقان)/i);
  const askedExertional = hasPattern(historyText, /\b(exertion|exercise|effort|sport|football|activity|مجهود|رياض)/i);
  const describedExam = hasPattern(examText, /\b(murmur|apex|scar|auscult|palpat|percuss|inspect|thrill|heave|صمام|ذرو|ندبة)/i);
  const correctDiagnosis = hasPattern(
    diagnosisText,
    /\b(aortic stenosis|mitral regurg|rheumatic|as\s*\+\s*mr|combined.*stenosis|تضيق.*أورط|قصور.*mitral|rheumatic heart)/i
  );
  const partialDiagnosis = !correctDiagnosis && hasPattern(diagnosisText, /\b(heart|cardiac|valve|murmur|valvular|قلب|صمام)/i);
  const gaveManagement = hasPattern(diagnosisText, /\b(manage|treat|refer|echo|echocardi|follow.?up|penicillin|surgery|intervention|إدارة|علاج|متابعة)/i);

  let communicationScore =
    20 +
    Math.min(25, historyMsgCount * 6) +
    Math.min(20, Math.floor(studentWordCount / 8)) +
    Math.min(15, stagesCovered * 4);
  if (askedIntroduction) communicationScore += 12;
  communicationScore = Math.min(100, communicationScore);

  let historyTakingScore =
    15 +
    Math.min(20, historyMsgCount * 5) +
    checklistHits * 6;
  if (askedComplaint) historyTakingScore += 12;
  if (askedExertional) historyTakingScore += 8;
  if (askedRheumatic) historyTakingScore += 12;
  if (askedMeds) historyTakingScore += 8;
  if (askedFamily) historyTakingScore += 6;
  if (askedRedFlags) historyTakingScore += 10;
  historyTakingScore = Math.min(100, historyTakingScore);

  let clinicalReasonScore =
    10 +
    completedManeuvers.length * 12 +
    Math.min(20, examMsgCount * 8) +
    Math.min(15, diagnosisMsgCount * 10);
  if (describedExam) clinicalReasonScore += 15;
  if (correctDiagnosis) clinicalReasonScore += 35;
  else if (partialDiagnosis) clinicalReasonScore += 16;
  if (gaveManagement) clinicalReasonScore += 12;
  clinicalReasonScore = Math.min(100, clinicalReasonScore);

  const organizationScore = Math.min(
    100,
    18 +
      stagesCovered * 10 +
      Math.min(20, historyMsgCount * 4) +
      (askedIntroduction ? 12 : 0) +
      (askedComplaint ? 10 : 0) +
      completedManeuvers.length * 6
  );
  const closingScore = Math.min(
    100,
    12 +
      Math.min(25, diagnosisMsgCount * 12) +
      Math.min(15, Math.floor(diagnosisText.length / 40)) +
      (correctDiagnosis ? 40 : partialDiagnosis ? 18 : 0) +
      (gaveManagement ? 18 : 0)
  );

  const totalScore = Math.round(
    communicationScore * 0.2 +
      historyTakingScore * 0.3 +
      clinicalReasonScore * 0.25 +
      organizationScore * 0.15 +
      closingScore * 0.1
  );

  const strengths: string[] = [];
  if (askedIntroduction) {
    strengths.push(
      pickLang('Opened with a professional introduction.', 'بدأ بمقدمة مهنية واضحة.', lang)
    );
  }
  if (askedComplaint) {
    strengths.push(
      pickLang('Explored the presenting complaint.', 'استكشف الشكوى الرئيسية.', lang)
    );
  }
  if (askedRheumatic) {
    strengths.push(
      pickLang(
        'Asked about rheumatic fever history — key for this case.',
        'سأل عن تاريخ الحمى الروماتيزمية — مهم جداً في الحالة دي.',
        lang
      )
    );
  }
  if (askedExertional) {
    strengths.push(
      pickLang(
        'Explored exertional symptoms appropriately.',
        'استكشف أعراض المجهود بشكل مناسب.',
        lang
      )
    );
  }
  if (describedExam) {
    strengths.push(
      pickLang(
        'Provided examination findings during the viva.',
        'قدّم ملاحظات فحص سريري أثناء الـ viva.',
        lang
      )
    );
  }
  if (correctDiagnosis) {
    strengths.push(
      pickLang(
        `Correctly identified the diagnosis (${caseData.finalDiagnosis}).`,
        `حدّد التشخيص بشكل صحيح (${caseData.finalDiagnosis}).`,
        lang
      )
    );
  }
  if (strengths.length === 0) {
    strengths.push(
      pickLang(
        'Engaged with the simulated patient and attempted the station.',
        'تفاعل مع المريض المحاكى وحاول إكمال المحطة.',
        lang
      )
    );
  }

  const weaknesses: string[] = [];
  if (!askedIntroduction) {
    weaknesses.push(
      pickLang(
        'Did not clearly introduce themselves or establish rapport.',
        'لم يقدّم نفسه بوضوح أو يبني rapport مع المريض.',
        lang
      )
    );
  }
  if (!askedRheumatic) {
    weaknesses.push(
      pickLang(
        'Did not explore history of rheumatic fever — critical for this case.',
        'لم يسأل عن تاريخ الحمى الروماتيزمية — نقطة حاسمة في الحالة دي.',
        lang
      )
    );
  }
  if (!askedMeds) {
    weaknesses.push(
      pickLang(
        'Insufficient exploration of medication history / penicillin prophylaxis.',
        'استكشاف غير كافٍ لتاريخ الأدوية / البروفيلاكس بالبنسلين.',
        lang
      )
    );
  }
  if (!askedRedFlags) {
    weaknesses.push(
      pickLang(
        'Missed important red-flag screening questions.',
        'فاتته أسئلة مهمّة عن red flags.',
        lang
      )
    );
  }
  if (!describedExam) {
    weaknesses.push(
      pickLang(
        'Limited or no structured examination findings documented.',
        'ملاحظات الفحص السريري محدودة أو غير منظمة.',
        lang
      )
    );
  }
  if (!correctDiagnosis && !partialDiagnosis) {
    weaknesses.push(
      pickLang(
        'Final diagnosis was absent or not clinically supported.',
        'التشخيص النهائي غائب أو غير مدعوم سريرياً.',
        lang
      )
    );
  }
  if (weaknesses.length === 0) {
    weaknesses.push(
      pickLang(
        'Minor refinements needed in systematic coverage and closing summary.',
        'محتاج تحسينات بسيطة في التغطية المنهجية والملخص الختامي.',
        lang
      )
    );
  }

  const missed: string[] = [];
  if (!askedRheumatic) {
    missed.push(
      pickLang(
        'History of rheumatic fever and penicillin prophylaxis compliance',
        'تاريخ الحمى الروماتيزمية والالتزام بالبروفيلاكس بالبنسلين',
        lang
      )
    );
  }
  if (!askedExertional) {
    missed.push(
      pickLang(
        'Exertional dyspnea progression and functional limitation',
        'تطور ضيق النفس مع المجهود والقصور الوظيفي',
        lang
      )
    );
  }
  if (!askedRedFlags) {
    missed.push(
      pickLang('Syncope, palpitations, orthopnea/PND', 'الإغماء، الخفقان، orthopnea/PND', lang)
    );
  }
  if (!askedFamily) {
    missed.push(
      pickLang('Relevant family cardiac history', 'التاريخ العائلي القلبي relevant', lang)
    );
  }
  if (missed.length === 0) {
    missed.push(
      pickLang(
        'Consider deeper exploration of differential diagnoses and investigation planning.',
        'فكّر في استكشاف أعمق للتشخيصات التفاضلية وخطة التحاليل.',
        lang
      )
    );
  }

  const errors: string[] = [];
  if (!correctDiagnosis && diagnosisText.length > 0) {
    errors.push(
      pickLang(
        `Submitted diagnosis did not match the expected: ${caseData.finalDiagnosis}.`,
        `التشخيص المقدّم لا يطابق المتوقع: ${caseData.finalDiagnosis}.`,
        lang
      )
    );
  }
  if (!askedMeds && /penicillin|prophylaxis/i.test(caseData.medicationHistory)) {
    errors.push(
      pickLang(
        'Did not assess penicillin prophylaxis adherence despite it being relevant to the case.',
        'لم يقيّم الالتزام بالبروفيلاكس بالبنسلين رغم أهميته في الحالة.',
        lang
      )
    );
  }
  if (errors.length === 0) {
    errors.push(
      pickLang(
        'No major clinical safety errors identified from the transcript.',
        'لم تُرصد أخطاء سريرية خطيرة في المحادثة.',
        lang
      )
    );
  }

  const caseTitle = lang === 'AR' ? caseData.titleAr || caseData.titleEn : caseData.titleEn;
  const reportTitle = pickLang('OSCE Evaluation Report', 'تقرير تقييم OSCE', lang);
  const perfSummary = pickLang('Performance Summary', 'ملخص الأداء', lang);
  const strengthsTitle = pickLang('Strengths', 'نقاط القوة', lang);
  const improveTitle = pickLang('Areas for Improvement', 'مجالات التحسين', lang);
  const missedTitle = pickLang('Missed Key Questions', 'أسئلة مهمة فاتت', lang);
  const errorsTitle = pickLang('Clinical Errors', 'أخطاء سريرية', lang);
  const commLabel = pickLang('Communication', 'التواصل', lang);
  const histLabel = pickLang('History Taking', 'أخذ التاريخ', lang);
  const reasonLabel = pickLang('Clinical Reasoning', 'التفكير السريري', lang);
  const orgLabel = pickLang('Organization', 'التنظيم', lang);
  const closeLabel = pickLang('Closing', 'الختام', lang);
  const studentMsgsLabel = pickLang('Student messages analyzed', 'رسائل الطالب المحلّلة', lang);
  const overallLabel = pickLang('Overall Score', 'الدرجة الإجمالية', lang);
  const caseLabel = pickLang('Case', 'الحالة', lang);
  const reportFooter = pickLang(
    `Report generated from full session transcript (${messages.length} messages).`,
    `التقرير مُولَّد من محادثة الجلسة الكاملة (${messages.length} رسالة).`,
    lang
  );

  return {
    totalScore,
    communicationScore,
    historyTakingScore,
    clinicalReasonScore,
    organizationScore,
    closingScore,
    strengths: strengths.join(lang === 'AR' ? ' ' : ' '),
    weaknesses: weaknesses.join(lang === 'AR' ? ' ' : ' '),
    missedQuestions: missed.join(lang === 'AR' ? '؛ ' : '; '),
    clinicalErrors: errors.join(lang === 'AR' ? ' ' : ' '),
    recommendations: pickLang(
      'Review systematic cardiac history (SOCRATES + red flags), rheumatic heart disease features, and structured OSCE closing with diagnosis and management plan.',
      'راجع أخذ التاريخ القلبي المنهجي (SOCRATES + red flags)، وسمات مرض القلب الروماتيزمي، وختام OSCE منظم بالتشخيص وخطة الإدارة.',
      lang
    ),
    idealApproach: pickLang(
      `Introduce yourself, confirm identity, explore ${caseData.chiefComplaint} using SOCRATES with exertional symptoms, ask about rheumatic fever and penicillin prophylaxis, complete examination with murmur description, then state ${caseData.finalDiagnosis} with echo referral and management plan.`,
      `قدّم نفسك، تأكد من الهوية، استكشف ${caseData.chiefComplaint} بـ SOCRATES مع أعراض المجهود، اسأل عن الحمى الروماتيزمية والبروفيلاكس بالبنسلين، أكمل الفحص مع وصف الـ murmur، ثم اذكر ${caseData.finalDiagnosis} مع إحالة echo وخطة إدارة.`,
      lang
    ),
    fullReport: `## ${reportTitle}\n\n**${caseLabel}:** ${caseTitle}\n**${studentMsgsLabel}:** ${studentMessages.length}\n**${overallLabel}:** ${totalScore}/100\n\n### ${perfSummary}\n- ${commLabel}: ${communicationScore}/100\n- ${histLabel}: ${historyTakingScore}/100\n- ${reasonLabel}: ${clinicalReasonScore}/100\n- ${orgLabel}: ${organizationScore}/100\n- ${closeLabel}: ${closingScore}/100\n\n### ${strengthsTitle}\n${strengths.map((s) => `- ${s}`).join('\n')}\n\n### ${improveTitle}\n${weaknesses.map((w) => `- ${w}`).join('\n')}\n\n### ${missedTitle}\n${missed.map((m) => `- ${m}`).join('\n')}\n\n### ${errorsTitle}\n${errors.map((e) => `- ${e}`).join('\n')}\n\n---\n*${reportFooter}*`,
  };
}

export async function getExaminerEvaluation(
  caseData: Case,
  messages: SessionMessage[],
  lang: 'AR' | 'EN' = 'EN',
  context: EvaluationSessionContext = {}
): Promise<EvaluationResult> {
  const transcript = buildSessionTranscript(caseData, messages);
  const mockResult = mockExaminerEvaluation(caseData, messages, lang, context);
  const settings = await getAISettings();
  const provider = process.env.AI_PROVIDER || settings.provider;

  if (provider === 'mock' || provider === 'demo') {
    return mockResult;
  }

  const knowledgeContext = await getCategoryKnowledgeContext(caseData.categoryId);
  const systemPrompt = buildExaminerEvaluationPrompt(caseData, knowledgeContext, lang);
  const chatMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content:
        lang === 'AR'
          ? `قيّم جلسة OSCE الكاملة التالية. حلّل كل رسالة STUDENT قبل وضع الدرجات. اكتب كل الحقول النصية بالعربية فقط:\n\n${transcript}`
          : `Evaluate this complete OSCE session. Analyze every STUDENT message before scoring:\n\n${transcript}`,
    },
  ];

  const raw = await callOpenAISafe(
    chatMessages,
    settings.examinerModel,
    0.3,
    4096,
    () => JSON.stringify(mockResult)
  );

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Partial<EvaluationResult>;
      const normalized = normalizeEvaluation(parsed, mockResult);
      const withContentScores = {
        ...normalized,
        totalScore: mockResult.totalScore,
        communicationScore: mockResult.communicationScore,
        historyTakingScore: mockResult.historyTakingScore,
        clinicalReasonScore: mockResult.clinicalReasonScore,
        organizationScore: mockResult.organizationScore,
        closingScore: mockResult.closingScore,
      };
      return mergeEvaluationWithLanguage(withContentScores, mockResult, lang);
    }
  } catch {
    // fall through to mock
  }

  return mockResult;
}

export async function getPatientResponse(
  caseData: Case,
  history: { role: string; content: string }[],
  userMessage: string,
  language: Language
): Promise<string> {
  const deterministic = getDeterministicPatientResponse(caseData, userMessage, language, history);
  if (deterministic !== null) {
    return deterministic;
  }

  const settings = await getAISettings();
  const provider = process.env.AI_PROVIDER || settings.provider;

  if (provider === 'mock' || provider === 'demo') {
    return mockPatientResponse(caseData, userMessage, language, history);
  }

  const knowledgeContext = await getCategoryKnowledgeContext(caseData.categoryId);
  const systemPrompt = buildPatientSystemPrompt(caseData, language, knowledgeContext);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({
      role: (m.role === 'STUDENT' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const raw = await callOpenAISafe(
    messages,
    settings.patientModel,
    Math.min(settings.temperature, 0.4),
    settings.maxTokens,
    () => mockPatientResponse(caseData, userMessage, language, history)
  );

  return sanitizePatientResponse(caseData, userMessage, raw, language);
}

export async function getExaminerVivaResponse(
  caseData: Case,
  question: string,
  history: { role: string; content: string }[]
): Promise<string> {
  const settings = await getAISettings();
  const provider = process.env.AI_PROVIDER || settings.provider;

  if (provider === 'mock' || provider === 'demo') {
    return `Good attempt. For this case (${caseData.titleEn}), consider also discussing differential diagnoses and next investigation steps.`;
  }

  const knowledgeContext = await getCategoryKnowledgeContext(caseData.categoryId);
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are an OSCE examiner conducting a viva for case: ${caseData.titleEn}. Diagnosis: ${caseData.finalDiagnosis}. Ask follow-up questions and provide brief constructive feedback. Do not reveal full answers immediately.${knowledgeContext}`,
    },
    ...history.map((m) => ({
      role: (m.role === 'STUDENT' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: question },
  ];

  return callOpenAISafe(
    messages,
    settings.examinerModel,
    settings.temperature,
    settings.maxTokens,
    () => `Good attempt. For this case (${caseData.titleEn}), consider also discussing differential diagnoses and next investigation steps.`
  );
}

const MANEUVER_LABELS: Record<string, { en: string; ar: string }> = {
  inspection: { en: 'Inspection', ar: 'الفحص البصري' },
  palpation: { en: 'Palpation', ar: 'الجس' },
  percussion: { en: 'Percussion', ar: 'النقر' },
  auscultation: { en: 'Auscultation', ar: 'الاستماع' },
};

function maneuverLabel(maneuverId: string, isArabic: boolean) {
  const label = MANEUVER_LABELS[maneuverId];
  if (!label) return maneuverId;
  return isArabic ? label.ar : label.en;
}

export function getManeuverOpeningMessage(
  caseData: Case,
  maneuverId: string,
  language: Language
): string {
  const isArabic = language === 'AR';
  const name = maneuverLabel(maneuverId, isArabic);

  if (isArabic) {
    return `أنا بقيّم ${name} السريري. راجع الصور/العرض السريري بعناية. اذكر ملاحظاتك بشكل منظم واشرح ماذا تبحث عنه أثناء ${name}، واذكر أي scar أو deformity أو finding واضح.`;
  }

  return `I am evaluating your clinical ${name}. Take a close look at the clinical presentation and images provided. Describe your findings systematically and explain what you would look for during ${name}, including any scars, deformities, or visible abnormalities.`;
}

export async function getManeuverExaminerResponse(
  caseData: Case,
  maneuverId: string,
  question: string,
  history: { role: string; content: string }[],
  language: Language
): Promise<string> {
  const settings = await getAISettings();
  const provider = process.env.AI_PROVIDER || settings.provider;
  const isArabic = language === 'AR' || /[\u0600-\u06FF]/.test(question);
  const name = maneuverLabel(maneuverId, isArabic);

  if (provider === 'mock' || provider === 'demo') {
    return isArabic
      ? `محاولة جيدة في ${name}. فكّر في differential diagnosis والخطوة التالية في الفحص.`
      : `Good attempt on ${name}. Consider differential diagnoses and the next examination step.`;
  }

  const knowledgeContext = await getCategoryKnowledgeContext(caseData.categoryId);
  const langNote = isArabic
    ? 'Respond in Arabic (Egyptian medical Arabic).'
    : 'Respond in English unless the student writes in Arabic.';

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a MUST senior OSCE clinical examiner conducting an oral viva for the "${name}" step of the physical examination.

CASE: ${caseData.titleEn}
DIAGNOSIS (hidden from student): ${caseData.finalDiagnosis}
PHYSICAL EXAM DATA: ${caseData.physicalExam}

RULES:
1. Evaluate the student's spoken findings for ${name} only.
2. Ask one focused follow-up question OR give brief constructive feedback (2-4 sentences).
3. Do NOT reveal the full diagnosis immediately.
4. Probe technique, expected findings, and clinical reasoning.
5. ${langNote}${knowledgeContext}`,
    },
    ...history.map((m) => ({
      role: (m.role === 'STUDENT' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: question },
  ];

  return callOpenAISafe(
    messages,
    settings.examinerModel,
    settings.temperature,
    settings.maxTokens,
    () =>
      isArabic
        ? `محاولة جيدة في ${name}. فكّر في differential diagnosis والخطوة التالية في الفحص.`
        : `Good attempt on ${name}. Consider differential diagnoses and the next examination step.`
  );
}
