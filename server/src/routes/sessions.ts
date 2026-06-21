import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import {
  getPatientResponse,
  getExaminerEvaluation,
  getExaminerVivaResponse,
  getManeuverOpeningMessage,
  getManeuverExaminerResponse,
  resolveEvaluationLanguage,
} from '../services/aiService.js';
import { Language, MessageRole } from '@prisma/client';

const router = Router();

const EXAM_MANEUVER_ORDER = ['inspection', 'palpation', 'percussion', 'auscultation'] as const;

function parseCompletedManeuvers(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function maneuverStage(maneuverId: string) {
  return `examination:${maneuverId}`;
}

function canStartManeuver(maneuverId: string, completed: string[]) {
  const index = EXAM_MANEUVER_ORDER.indexOf(maneuverId as (typeof EXAM_MANEUVER_ORDER)[number]);
  if (index <= 0) return true;
  return completed.includes(EXAM_MANEUVER_ORDER[index - 1]);
}

router.use(authenticate);

router.post('/start', async (req, res) => {
  const { caseId, language = 'AUTO' } = req.body;

  const caseData = await prisma.case.findUnique({ where: { id: caseId, isPublished: true } });
  if (!caseData) return res.status(404).json({ error: 'Case not found' });

  const session = await prisma.session.create({
    data: {
      userId: req.user!.id,
      caseId,
      language: language as Language,
    },
    include: {
      case: { include: { specialty: true, difficulty: true } },
    },
  });

  const isArabic = language === 'AR';
  const openingLine = caseData.chiefComplaint.split('.')[0].trim();
  const openingContent = isArabic
    ? `السلام عليكم دكتور، أنا ${caseData.patientName}. ${openingLine}.`
    : `Hello doctor, I'm ${caseData.patientName}. ${openingLine}.`;

  await prisma.message.create({
    data: {
      sessionId: session.id,
      role: MessageRole.PATIENT,
      content: openingContent,
      stage: 'history',
    },
  });

  const fullSession = await prisma.session.findUnique({
    where: { id: session.id },
    include: {
      case: { include: { specialty: true, difficulty: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  res.status(201).json({ session: fullSession });
});

router.get('/my', async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.user!.id },
    include: {
      case: { include: { specialty: true, difficulty: true } },
      result: true,
    },
    orderBy: { startedAt: 'desc' },
  });
  res.json({ sessions });
});

router.get('/:id', async (req, res) => {
  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: {
      case: { include: { specialty: true, difficulty: true } },
      messages: { orderBy: { createdAt: 'asc' } },
      result: true,
    },
  });

  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ session });
});

router.post('/:id/maneuver/start', async (req, res) => {
  const { maneuverId } = req.body;
  if (!maneuverId || !EXAM_MANEUVER_ORDER.includes(maneuverId)) {
    return res.status(400).json({ error: 'Invalid maneuver' });
  }

  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
    include: { case: true, messages: true },
  });
  if (!session) return res.status(404).json({ error: 'Active session not found' });

  const completed = parseCompletedManeuvers(session.completedManeuvers);
  if (!canStartManeuver(maneuverId, completed)) {
    return res.status(400).json({ error: 'Complete the previous examination step first' });
  }

  const stage = maneuverStage(maneuverId);
  const existing = session.messages.filter((m) => m.stage === stage);
  let openingMessage = existing.find((m) => m.role === MessageRole.EXAMINER);

  if (!openingMessage) {
    openingMessage = await prisma.message.create({
      data: {
        sessionId: session.id,
        role: MessageRole.EXAMINER,
        content: getManeuverOpeningMessage(session.case, maneuverId, session.language),
        stage,
      },
    });
  }

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { activeManeuver: maneuverId, currentStage: 'examination' },
  });

  res.json({ session: updated, message: openingMessage });
});

router.post('/:id/maneuver/complete', async (req, res) => {
  const { maneuverId } = req.body;
  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
  });
  if (!session) return res.status(404).json({ error: 'Active session not found' });

  const completed = parseCompletedManeuvers(session.completedManeuvers);
  if (!completed.includes(maneuverId)) completed.push(maneuverId);

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { completedManeuvers: JSON.stringify(completed), activeManeuver: null },
  });

  res.json({ session: updated, completedManeuvers: completed });
});

router.post('/:id/chat', async (req, res) => {
  try {
    const { message, stage = 'history' } = req.body;

    const session = await prisma.session.findFirst({
      where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
      include: { case: true, messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!session) return res.status(404).json({ error: 'Active session not found' });

    await prisma.message.create({
      data: {
        sessionId: session.id,
        role: MessageRole.STUDENT,
        content: message,
        stage,
      },
    });

    const stageHistory = session.messages
      .filter((m) => m.stage === stage)
      .map((m) => ({ role: m.role, content: m.content }));

    const patientReply = await getPatientResponse(
      session.case,
      stageHistory,
      message,
      session.language
    );

    const patientMessage = await prisma.message.create({
      data: {
        sessionId: session.id,
        role: MessageRole.PATIENT,
        content: patientReply,
        stage,
      },
    });

    res.json({ message: patientMessage });
  } catch (error) {
    console.error('[chat]', error);
    res.status(500).json({ error: 'Failed to get patient response' });
  }
});

router.post('/:id/examiner', async (req, res) => {
  try {
    const { message, stage = 'history', maneuverId } = req.body;

  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.user!.id, status: 'IN_PROGRESS' },
    include: { case: true, messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!session) return res.status(404).json({ error: 'Active session not found' });

  const effectiveStage = maneuverId ? maneuverStage(maneuverId) : stage;

  await prisma.message.create({
    data: {
      sessionId: session.id,
      role: MessageRole.STUDENT,
      content: message,
      stage: effectiveStage,
    },
  });

  const stageMessages = session.messages.filter((m) => m.stage === effectiveStage);
  const examinerHistory = stageMessages.filter((m) => m.role !== MessageRole.PATIENT);

  const reply = maneuverId
    ? await getManeuverExaminerResponse(
        session.case,
        maneuverId,
        message,
        examinerHistory.map((m) => ({ role: m.role, content: m.content })),
        session.language
      )
    : await getExaminerVivaResponse(
        session.case,
        message,
        examinerHistory.map((m) => ({ role: m.role, content: m.content }))
      );

  const examinerMessage = await prisma.message.create({
    data: {
      sessionId: session.id,
      role: MessageRole.EXAMINER,
      content: reply,
      stage: effectiveStage,
    },
  });

  res.json({ message: examinerMessage });
  } catch (error) {
    console.error('[examiner]', error);
    res.status(500).json({ error: 'Failed to get examiner response' });
  }
});

router.patch('/:id/stage', async (req, res) => {
  const { stage } = req.body;
  const session = await prisma.session.updateMany({
    where: { id: req.params.id, userId: req.user!.id },
    data: { currentStage: stage },
  });

  if (session.count === 0) return res.status(404).json({ error: 'Session not found' });
  res.json({ message: 'Stage updated' });
});

router.post('/:id/complete', async (req, res) => {
  try {
  const session = await prisma.session.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { case: true, messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!session) return res.status(404).json({ error: 'Session not found' });

  if (session.messages.length === 0) {
    return res.status(400).json({ error: 'No messages in session to evaluate' });
  }

  const sessionMessages = session.messages.map((m) => ({
    role: m.role,
    content: m.content,
    stage: m.stage,
    createdAt: m.createdAt,
  }));

  const evaluationLang = resolveEvaluationLanguage(
    session.language,
    sessionMessages,
    req.body?.language
  );

  let completedManeuvers: string[] = [];
  try {
    completedManeuvers = JSON.parse(session.completedManeuvers || '[]');
  } catch {
    completedManeuvers = [];
  }

  const evaluation = await getExaminerEvaluation(
    session.case,
    sessionMessages,
    evaluationLang,
    { completedManeuvers }
  );

  const durationSeconds = Math.floor(
    (Date.now() - new Date(session.startedAt).getTime()) / 1000
  );

  await prisma.session.update({
    where: { id: session.id },
    data: { status: 'COMPLETED', completedAt: new Date(), durationSeconds },
  });

  const result = await prisma.result.upsert({
    where: { sessionId: session.id },
    create: {
      sessionId: session.id,
      ...evaluation,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      missedQuestions: evaluation.missedQuestions,
      clinicalErrors: evaluation.clinicalErrors,
      recommendations: evaluation.recommendations,
      idealApproach: evaluation.idealApproach,
      fullReport: evaluation.fullReport,
    },
    update: {
      ...evaluation,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      missedQuestions: evaluation.missedQuestions,
      clinicalErrors: evaluation.clinicalErrors,
      recommendations: evaluation.recommendations,
      idealApproach: evaluation.idealApproach,
      fullReport: evaluation.fullReport,
    },
  });

  res.json({ result });
  } catch (error) {
    console.error('[complete]', error);
    res.status(500).json({ error: 'Failed to generate session evaluation' });
  }
});

router.post('/:id/abandon', async (req, res) => {
  await prisma.session.updateMany({
    where: { id: req.params.id, userId: req.user!.id },
    data: { status: 'ABANDONED' },
  });
  res.json({ message: 'Session abandoned' });
});

export default router;
