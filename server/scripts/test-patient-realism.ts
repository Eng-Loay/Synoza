/**
 * Patient realism / intent tests for text chat.
 * Run: npx tsx scripts/test-patient-realism.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Case } from '@prisma/client';
import {
  getPatientResponse,
  sanitizeRealtimePatientTranscript,
} from '../src/services/aiService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const samiraCase = {
  patientName: 'Samira Abdel Rahman',
  patientAge: 58,
  patientGender: 'Female',
  patientNationality: 'Egyptian',
  chiefComplaint: 'Progressive shortness of breath and ankle swelling for 3 weeks, worse when lying flat.',
  medicalHistory: 'Hypertension for 10 years. Type 2 diabetes.',
  medicationHistory: 'Amlodipine 5mg daily',
  surgicalHistory: 'No previous cardiac surgery.',
  familyHistory: 'Father died of heart failure at age 62.',
  socialHistory: 'Retired teacher. Former smoker.',
  patientPersonality: 'Anxious older woman, breathless when speaking.',
  scenarioPrompt: '58-year-old with breathlessness and ankle swelling for 3 weeks.',
  finalDiagnosis: 'Acute decompensated heart failure',
  categoryId: null,
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

console.log('\n=== Patient realism (mock provider) ===\n');
process.env.AI_PROVIDER = 'mock';

const greeting = await getPatientResponse(samiraCase, [], 'اهلا', 'AR');
assert(greeting.length > 40, 'greeting opens with natural complaint', greeting);

const wellbeing = await getPatientResponse(samiraCase, [{ role: 'STUDENT', content: 'اهلا' }], 'عامل أي', 'AR');
assert(/تعبان|مش في أحسن حالي|والله/i.test(wellbeing), 'wellbeing is natural not one word', wellbeing);

const complaint = await getPatientResponse(
  samiraCase,
  [{ role: 'STUDENT', content: 'اهلا' }],
  'بتشتكي من أي',
  'AR',
);
assert(/تنفس|نفس|تعبان|أسابيع|تورم/i.test(complaint), 'truncated complaint question answered', complaint);

const vague = await getPatientResponse(samiraCase, [], 'أيه', 'AR');
assert(/مش فاهم|توضّح/i.test(vague), 'vague أيه asks to clarify', vague);

const helo = await getPatientResponse(samiraCase, [], 'هيلو', 'AR');
assert(!/مش فاهم|توضّح/i.test(helo), 'هيلو is greeting not clarify', helo);

const amelEh = await getPatientResponse(
  samiraCase,
  [{ role: 'STUDENT', content: 'هيلو' }],
  'عامل ايه',
  'AR',
);
assert(/تعبان|مش في أحسن حالي|والله/i.test(amelEh), 'عامل ايه wellbeing reply', amelEh);

const empathy = await getPatientResponse(samiraCase, [], 'الف مليون سلامة عليك', 'AR');
assert(/الله يسلمك|تسلم/i.test(empathy), 'empathy gets warm reply', empathy);

const empathyStt = await getPatientResponse(samiraCase, [], 'الف سلامه', 'AR');
assert(/الله يسلمك|تسلم/i.test(empathyStt), 'STT الف سلامه empathy', empathyStt);

const helloRepeat = await getPatientResponse(
  samiraCase,
  [{ role: 'STUDENT', content: 'الف سلامه' }],
  'اهلا اهلا',
  'AR',
);
assert(/أهلاً|اهلا/i.test(helloRepeat), 'اهلا اهلا gets greeting not clarify', helloRepeat);

console.log('\n=== Voice path stays brief ===\n');
const voiceWellbeing = sanitizeRealtimePatientTranscript(samiraCase, 'إيه الأخبار', 'long ai dump', 'AR');
assert(voiceWellbeing.length < 80, 'voice wellbeing stays short', voiceWellbeing);

console.log('\n=== Summary ===\n');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed > 0) process.exit(1);
console.log('\nAll patient realism tests passed.\n');
