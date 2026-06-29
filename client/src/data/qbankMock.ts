export type QbankModule = {
  id: string;
  nameEn: string;
  nameAr: string;
  specialtyEn: string;
  specialtyAr: string;
  subjects: string[];
  locked: boolean;
  owned?: boolean;
  priceEgp?: number;
};

export type QbankTerm = {
  id: string;
  titleEn: string;
  titleAr: string;
  modules: number;
  questions: number;
};

export const QBANK_TERMS: QbankTerm[] = [
  { id: '401', titleEn: 'Fourth Year — First Semester', titleAr: 'الفرقة الرابعة — ترم أول', modules: 8, questions: 1248 },
  { id: '402', titleEn: 'Fourth Year — Second Semester', titleAr: 'الفرقة الرابعة — ترم تاني', modules: 7, questions: 1375 },
  { id: '501', titleEn: 'Fifth Year — First Semester', titleAr: 'الفرقة الخامسة — ترم أول', modules: 9, questions: 3412 },
  { id: '502', titleEn: 'Fifth Year — Second Semester', titleAr: 'الفرقة الخامسة — ترم تاني', modules: 8, questions: 1510 },
];

export const QBANK_MODULES_401: QbankModule[] = [
  {
    id: 'med-1',
    nameEn: 'Med 1',
    nameAr: 'Med 1',
    specialtyEn: 'Internal Medicine',
    specialtyAr: 'Internal Medicine',
    subjects: ['GIT', 'Hepatology'],
    locked: false,
  },
  {
    id: 'med-2',
    nameEn: 'Med 2',
    nameAr: 'Med 2',
    specialtyEn: 'Internal Medicine',
    specialtyAr: 'Internal Medicine',
    subjects: ['Chest', 'Cardiology'],
    locked: true,
    priceEgp: 50,
  },
  {
    id: 'sur-1',
    nameEn: 'Sur 1',
    nameAr: 'Sur 1',
    specialtyEn: 'Surgery',
    specialtyAr: 'Surgery',
    subjects: ['GIT'],
    locked: true,
    priceEgp: 50,
  },
  {
    id: 'sur-2',
    nameEn: 'Sur 2',
    nameAr: 'Sur 2',
    specialtyEn: 'Surgery',
    specialtyAr: 'Surgery',
    subjects: ['Cardio Thoracic'],
    locked: true,
    priceEgp: 50,
  },
  {
    id: 'oncology',
    nameEn: 'Oncology',
    nameAr: 'Oncology',
    specialtyEn: 'Oncology',
    specialtyAr: 'Oncology',
    subjects: [],
    locked: true,
    priceEgp: 50,
  },
  {
    id: 'lab',
    nameEn: 'LAB',
    nameAr: 'LAB',
    specialtyEn: 'Laboratory',
    specialtyAr: 'Laboratory',
    subjects: [],
    locked: false,
    owned: true,
  },
  {
    id: 'nutrition',
    nameEn: 'Nutrition',
    nameAr: 'Nutrition',
    specialtyEn: 'Nutrition',
    specialtyAr: 'Nutrition',
    subjects: [],
    locked: true,
    priceEgp: 50,
  },
  {
    id: 'anaesthesia',
    nameEn: 'Anaesthesia',
    nameAr: 'Anaesthesia',
    specialtyEn: 'Anaesthesia',
    specialtyAr: 'Anaesthesia',
    subjects: [],
    locked: true,
    priceEgp: 50,
  },
];

export const QBANK_CHAPTERS = [
  'Esophagus',
  'Stomach',
  'Small Intestine',
  'Colon',
  'Hepatitis',
  'Cirrhosis',
  'Portal Hypertension',
] as const;

export const QBANK_REFERENCES = [
  'Lang',
  'Bailey & Love',
  'Ain Shams',
  'Kasr Al Ainy',
  'El Zatona',
  'Previous Years',
  'Cairo University',
  'Alex University',
] as const;

export const QBANK_QUESTION_COUNTS = [10, 20, 30, 50, 'all'] as const;

/** Deterministic mock count per chapter × source pair */
export function getQuestionCountForPair(chapter: string, source: string): number {
  let h = 0;
  const key = `${chapter}|${source}`;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) % 10000;
  }
  return 8 + (h % 18);
}

export function countAvailableQuestions(chapters: string[], references: string[]): number {
  if (chapters.length === 0 || references.length === 0) return 0;
  return chapters.reduce(
    (sum, chapter) =>
      sum + references.reduce((refSum, ref) => refSum + getQuestionCountForPair(chapter, ref), 0),
    0,
  );
}

export function resolveQuestionCount(
  value: number | 'all',
  availableTotal: number,
): number {
  if (availableTotal <= 0) return 0;
  if (value === 'all') return availableTotal;
  return Math.min(Math.max(1, value), availableTotal);
}

export function getTerm(termId: string) {
  return QBANK_TERMS.find((t) => t.id === termId);
}

export function getModulesForTerm(termId: string): QbankModule[] {
  if (termId === '401') return QBANK_MODULES_401;
  return [];
}

export function getModule(termId: string, moduleId: string) {
  return getModulesForTerm(termId).find((m) => m.id === moduleId);
}

export type QbankQuestion = {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
  chapter: string;
  source: string;
};

const SAMPLE_QUESTIONS: Omit<QbankQuestion, 'id' | 'chapter' | 'source'>[] = [
  {
    text: 'Which of the following is the most common cause of upper gastrointestinal bleeding?',
    options: ['Gastric carcinoma', 'Duodenal ulcer', 'Esophageal varices', 'Mallory-Weiss tear'],
    correctIndex: 1,
  },
  {
    text: 'A patient with chronic hepatitis B is at highest risk of developing which complication?',
    options: ['Pancreatitis', 'Hepatocellular carcinoma', 'Cholecystitis', 'Peptic ulcer disease'],
    correctIndex: 1,
  },
  {
    text: 'The most sensitive test for diagnosing H. pylori infection before treatment is:',
    options: ['Serology', 'Urea breath test', 'Stool antigen after PPI', 'Barium meal'],
    correctIndex: 1,
  },
  {
    text: 'Portal hypertension is most commonly caused by:',
    options: ['Budd-Chiari syndrome', 'Cirrhosis', 'Portal vein thrombosis', 'Right heart failure'],
    correctIndex: 1,
  },
  {
    text: 'Which finding is most specific for ascites due to cirrhosis?',
    options: ['Shifting dullness', 'Fluid thrill', 'SAAG > 1.1 g/dL', 'Hepatojugular reflux'],
    correctIndex: 2,
  },
];

export function buildMockExamQuestions(count: number): QbankQuestion[] {
  const total = Math.min(count, 50);
  return Array.from({ length: total }, (_, i) => {
    const sample = SAMPLE_QUESTIONS[i % SAMPLE_QUESTIONS.length];
    return {
      id: i + 1,
      ...sample,
      chapter: QBANK_CHAPTERS[i % QBANK_CHAPTERS.length],
      source: QBANK_REFERENCES[i % QBANK_REFERENCES.length],
    };
  });
}

export type QbankExamConfig = {
  mode: 'practice' | 'exam';
  questionCount: number;
  subjects: string[];
  chapters: string[];
  references: string[];
  /** Exam mode only — duration in minutes */
  examDurationMinutes?: number;
};

export type QbankAnswerState = {
  selected: number | null;
  marked: boolean;
  skipped: boolean;
  revealed?: boolean;
};

export type QbankExamResult = {
  config: QbankExamConfig;
  answers: QbankAnswerState[];
  questions: QbankQuestion[];
  startedAt: number;
  finishedAt: number;
  termId: string;
  moduleId: string;
};

export function scoreExamResult(result: QbankExamResult) {
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  for (let i = 0; i < result.questions.length; i += 1) {
    const a = result.answers[i];
    if (a?.selected == null && !a?.skipped) {
      unanswered += 1;
    } else if (a?.selected === result.questions[i].correctIndex) {
      correct += 1;
    } else {
      incorrect += 1;
    }
  }
  const total = result.questions.length;
  const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, incorrect, unanswered, total, scorePct };
}

export function examStorageKey(termId: string, moduleId: string) {
  return `synoza-qbank-exam-${termId}-${moduleId}`;
}
