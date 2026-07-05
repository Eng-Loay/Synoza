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
assert(opening.includes(qA[0]), 'opening uses first picked question');

const stage = 'history:examiner';
const baseMessages = [
  { role: 'EXAMINER', stage, content: opening },
];

assert(getCurrentVivaQuestionNumber(baseMessages, stage) === 1, 'tracks question 1 after opening');

assert(studentGaveUp("I don't know doctor"), 'detects English give-up');
assert(studentGaveUp("don't know"), 'detects bare "don\'t know"');
assert(studentGaveUp('مش عارف يا دكتور'), 'detects Arabic give-up');

const penicillinQ =
  qA.find((q) => q.toLowerCase().includes('penicillin')) ??
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
assert(samiraQ[0] !== qA[0] || samiraQ[1] !== qA[1], 'different case pool changes questions');

console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);
console.log('\nAll examiner viva tests passed.\n');
