/**
 * Examiner history viva — evaluate answers before advancing.
 * Run: npx tsx scripts/test-examiner-viva.ts
 */
import type { Case } from '@prisma/client';
import {
  buildExaminerVivaOpening,
  getCurrentVivaQuestionNumber,
  pickVivaQuestionsForSession,
  respondToHistoryVivaAnswer,
  studentGaveUp,
  VIVA_QUESTIONS_PER_SESSION,
} from '../src/services/examinerVivaService.js';

const tarekCase = {
  id: 'case-tarek',
  titleEn: 'Rheumatic Valvular Heart Disease',
  finalDiagnosis: 'severe aortic stenosis',
} as Case;

const samiraCase = {
  id: 'case-samira',
  titleEn: 'Acute Heart Failure — Dilated Cardiomyopathy',
  finalDiagnosis: 'Acute decompensated heart failure',
} as Case;

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('\n=== Examiner viva service ===\n');

const sessionA = 'session-aaa-111';
const sessionB = 'session-bbb-222';

const qA = pickVivaQuestionsForSession(sessionA, tarekCase);
const qB = pickVivaQuestionsForSession(sessionB, tarekCase);
const qA2 = pickVivaQuestionsForSession(sessionA, tarekCase);

assert(qA.length === VIVA_QUESTIONS_PER_SESSION, 'picks 5 questions', String(qA.length));
assert(JSON.stringify(qA) === JSON.stringify(qA2), 'same session gets same questions');
assert(JSON.stringify(qA) !== JSON.stringify(qB), 'different sessions get different questions');

const opening = buildExaminerVivaOpening(sessionA, tarekCase);
assert(/Question 1 of 5/i.test(opening), 'opening in English with Q1', opening);
assert(opening.includes(qA[0].question), 'opening uses first picked question');

const stage = 'history:examiner';
const baseMessages = [
  { role: 'EXAMINER', stage, content: opening },
];

assert(getCurrentVivaQuestionNumber(baseMessages, stage) === 1, 'tracks question 1 after opening');

assert(studentGaveUp("I don't know doctor"), 'detects English give-up');
assert(studentGaveUp("don't know"), 'detects bare "don\'t know"');
assert(studentGaveUp('مش عارف يا دكتور'), 'detects Arabic give-up');

const penicillinQ =
  qA.find((q) => q.question.toLowerCase().includes('penicillin'))?.question ??
  'What is the purpose of penicillin prophylaxis after rheumatic fever?';

const wrongReply = await respondToHistoryVivaAnswer(
  sessionA,
  tarekCase,
  baseMessages,
  stage,
  'i think with CBC',
);
assert(!/Question 2 of 5/i.test(wrongReply), 'wrong answer does not advance', wrongReply);
assert(/not quite|try again|brief/i.test(wrongReply.toLowerCase()), 'wrong answer gives feedback', wrongReply);

const giveUpReply = await respondToHistoryVivaAnswer(
  sessionA,
  tarekCase,
  baseMessages,
  stage,
  "don't know",
);
assert(/Question 2 of 5/i.test(giveUpReply), 'bare give-up advances to Q2', giveUpReply);

const giveUpReply2 = await respondToHistoryVivaAnswer(
  sessionA,
  tarekCase,
  baseMessages,
  stage,
  "I don't know",
);
assert(/Question 2 of 5/i.test(giveUpReply2), 'give-up advances to Q2', giveUpReply2);

let messages = [...baseMessages];
for (let i = 0; i < VIVA_QUESTIONS_PER_SESSION - 1; i += 1) {
  const reply = await respondToHistoryVivaAnswer(
    sessionA,
    tarekCase,
    messages,
    stage,
    "I don't know",
  );
  messages = [
    ...messages,
    { role: 'STUDENT', stage, content: 'student answer' },
    { role: 'EXAMINER', stage, content: reply },
  ];
}

const closingReply = await respondToHistoryVivaAnswer(
  sessionA,
  tarekCase,
  messages,
  stage,
  "I don't know",
);
assert(/completes the examiner viva/i.test(closingReply), 'closes after Q5', closingReply);

const samiraQ = pickVivaQuestionsForSession(sessionA, samiraCase);
assert(samiraQ[0].question !== qA[0].question || samiraQ[1].question !== qA[1].question, 'different case pool changes questions');

const shuntSampleAnswer = `Causes of a left-to-right shunt include:
- Ventricular septal defect (VSD).
- Atrial septal defect (ASD).
- Patent ductus arteriosus (PDA).`;

const vsdCase = {
  id: 'case-vsd',
  titleEn: 'VSD (Ventricular Septal Defect)',
  finalDiagnosis: 'Ventricular septal defect',
  examinerQuestions: JSON.stringify(
    Array.from({ length: 5 }, (_, index) => ({
      id: `q${index + 1}`,
      question: 'What are the causes of a left-to-right shunt?',
      sampleAnswer: shuntSampleAnswer,
    })),
  ),
} as Case;

const vsdSession = 'session-vsd-shunt';
const vsdOpening = buildExaminerVivaOpening(vsdSession, vsdCase);
const vsdMessages = [{ role: 'EXAMINER', stage, content: vsdOpening }];

const asdReply = await respondToHistoryVivaAnswer(
  vsdSession,
  vsdCase,
  vsdMessages,
  stage,
  'Atrial septal defect (ASD)',
);
assert(!/Question 2 of 5/i.test(asdReply), 'first partial point stays on Q1', asdReply);
assert(/good|correct/i.test(asdReply), 'partial point gets encouragement', asdReply);
assert(/VSD|PDA|ventricular|patent/i.test(asdReply), 'partial point hints remaining causes', asdReply);

const vsdMessages2 = [
  ...vsdMessages,
  { role: 'STUDENT', stage, content: 'Atrial septal defect (ASD)' },
  { role: 'EXAMINER', stage, content: asdReply },
];
const vsdReply = await respondToHistoryVivaAnswer(
  vsdSession,
  vsdCase,
  vsdMessages2,
  stage,
  'Ventricular septal defect (VSD)',
);
assert(!/Question 2 of 5/i.test(vsdReply), 'second partial point stays on Q1', vsdReply);
assert(/good|correct/i.test(vsdReply), 'second partial point gets encouragement', vsdReply);

const vsdMessages3 = [
  ...vsdMessages2,
  { role: 'STUDENT', stage, content: 'Ventricular septal defect (VSD)' },
  { role: 'EXAMINER', stage, content: vsdReply },
];
const pdaReply = await respondToHistoryVivaAnswer(
  vsdSession,
  vsdCase,
  vsdMessages3,
  stage,
  'Patent ductus arteriosus (PDA)',
);
assert(/Question 2 of 5/i.test(pdaReply), 'all points advance to Q2', pdaReply);
assert(/correct|covered/i.test(pdaReply.toLowerCase()), 'full answer acknowledged', pdaReply);

const thrillSampleAnswer = `Causes of a thrill include:
- **Apical systolic thrill:** Mitral regurgitation.
- **Apical diastolic thrill:** Mitral stenosis.
- **Left parasternal thrill:** Ventricular septal defect.
- **Basal thrill:** Aortic stenosis.`;

const thrillEval = await import('../src/services/aiService.js').then((m) =>
  m.evaluateHistoryVivaAnswer(
    vsdCase,
    'What are the causes of a thrill in a cardiac patient?',
    2,
    'Apical systolic thrill: Mitral regurgitation',
    thrillSampleAnswer,
    'Apical systolic thrill: Mitral regurgitation',
  ),
);
assert(!thrillEval.advance, 'single thrill point does not advance', thrillEval.feedback);
assert(/apical systolic thrill/i.test(thrillEval.feedback), 'credits MR thrill point', thrillEval.feedback);
const creditedPart = thrillEval.feedback.split(/keep going|one more|still need/i)[0] ?? thrillEval.feedback;
assert(
  !/diastolic thrill|mitral stenosis/i.test(creditedPart),
  'does not falsely credit MS thrill point',
  thrillEval.feedback,
);

const ascitesSample = `- **Minimal / Earliest Ascites (< 500 mL):** Detected via Abdominal Ultrasound or by auscultating the Puddle sign.
- **Mild Ascites (500 - 1500 mL):** Detected via the Knee-Elbow percussory test.
- **Moderate Ascites (1500 - 3000 mL):** Detected via Shifting Dullness using light percussion.
- **Tense Ascites (> 3000 mL):** Easily inspected as generalized distension with full flanks and an everted umbilicus.`;

const ascitesEval = await import('../src/services/aiService.js').then((m) =>
  m.evaluateHistoryVivaAnswer(
    vsdCase,
    'How to detect ascites clinically based on fluid volume?',
    1,
    'Minimal / Earliest Ascites (< 500 mL): Detected via Abdominal Ultrasound or by auscultating the Puddle sign.',
    ascitesSample,
    'Minimal / Earliest Ascites (< 500 mL): Detected via Abdominal Ultrasound or by auscultating the Puddle sign.',
  ),
);
assert(!ascitesEval.advance, 'ascites partial does not advance', ascitesEval.feedback);
assert(/good|correct/i.test(ascitesEval.feedback), 'ascites partial gets praise', ascitesEval.feedback);
assert(
  !/knee-elbow|shifting dullness|everted umbilicus/i.test(ascitesEval.feedback),
  'ascites feedback does not reveal full remaining answers',
  ascitesEval.feedback,
);
assert(/mild|moderate|tense/i.test(ascitesEval.feedback), 'ascites hints remaining categories only', ascitesEval.feedback);

console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);
console.log('\nAll examiner viva tests passed.\n');
