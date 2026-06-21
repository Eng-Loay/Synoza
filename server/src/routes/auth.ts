import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

function signToken(user: { id: string; email: string; role: string }) {
  const secret = process.env.JWT_SECRET!;
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, {
    expiresIn: '7d',
  });
}

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, firstName, lastName, phone, university } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, firstName, lastName, phone, university },
    });

    await prisma.subscription.create({ data: { userId: user.id } });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        university: user.university,
      },
    });
  }
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        university: user.university,
      },
    });
  }
);

router.post('/forgot-password', [body('email').isEmail().normalizeEmail()], async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000);
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetExpires },
    });
    // In production: send email with reset link
    if (process.env.NODE_ENV === 'development') {
      return res.json({ message: 'Reset token generated', resetToken });
    }
  }

  res.json({ message: 'If the email exists, a reset link has been sent' });
});

router.post(
  '/reset-password',
  [body('token').notEmpty(), body('password').isLength({ min: 6 })],
  async (req: Request, res: Response) => {
    const { token, password } = req.body;
    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetExpires: { gt: new Date() } },
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetExpires: null },
    });

    res.json({ message: 'Password reset successful' });
  }
);

router.get('/me', authenticate, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      university: true,
      avatarUrl: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Session expired' });
  }
  const { isActive: _isActive, ...publicUser } = user;
  res.json({ user: publicUser });
});

router.put('/profile', authenticate, async (req: Request, res: Response) => {
  const { firstName, lastName, phone, university, avatarUrl } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { firstName, lastName, phone, university, avatarUrl },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      university: true,
      avatarUrl: true,
      role: true,
    },
  });
  res.json({ user });
});

router.put('/change-password', authenticate, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.json({ message: 'Password updated' });
});

export default router;
