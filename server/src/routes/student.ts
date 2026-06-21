import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/overview', async (req, res) => {
  const userId = req.user!.id;

  const [totalSessions, completedSessions, results, recentSessions] = await Promise.all([
    prisma.session.count({ where: { userId } }),
    prisma.session.count({ where: { userId, status: 'COMPLETED' } }),
    prisma.result.findMany({
      where: { session: { userId } },
      select: { totalScore: true, historyTakingScore: true, communicationScore: true },
    }),
    prisma.session.findMany({
      where: { userId },
      take: 5,
      orderBy: { startedAt: 'desc' },
      include: {
        case: { select: { titleEn: true, titleAr: true } },
        result: { select: { totalScore: true } },
      },
    }),
  ]);

  const avgScore =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.totalScore, 0) / results.length
      : 0;

  const avgHistory =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.historyTakingScore, 0) / results.length
      : 0;

  const avgCommunication =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.communicationScore, 0) / results.length
      : 0;

  res.json({
    stats: {
      totalSessions,
      completedSessions,
      averageScore: Math.round(avgScore * 10) / 10,
      averageHistoryTaking: Math.round(avgHistory * 10) / 10,
      averageCommunication: Math.round(avgCommunication * 10) / 10,
    },
    recentSessions,
  });
});

router.get('/results', async (req, res) => {
  const results = await prisma.result.findMany({
    where: { session: { userId: req.user!.id } },
    include: {
      session: {
        include: {
          case: { include: { specialty: true, difficulty: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ results });
});

router.get('/results/:sessionId', async (req, res) => {
  const result = await prisma.result.findFirst({
    where: {
      sessionId: req.params.sessionId,
      session: { userId: req.user!.id },
    },
    include: {
      session: {
        include: {
          case: true,
          messages: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });

  if (!result) return res.status(404).json({ error: 'Result not found' });
  res.json({ result });
});

export default router;
