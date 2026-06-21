import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import casesRoutes from './routes/cases.js';
import sessionsRoutes from './routes/sessions.js';
import adminRoutes from './routes/admin.js';
import studentRoutes from './routes/student.js';
import categoriesRoutes from './routes/categories.js';
import siteRoutes from './routes/site.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Synoza OSCE Platform',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api/ping', (_req, res) => {
  const start = Date.now();
  res.json({
    pong: true,
    latencyMs: Date.now() - start,
    serverTime: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/site', siteRoutes);

const clientPublicExam = path.join(__dirname, '../../client/public/exam');
app.use('/exam', express.static(clientPublicExam));

const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Synoza server running on http://localhost:${PORT}`);
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Close the other Synoza server or run:`);
    console.error(`  Get-NetTCPConnection -LocalPort ${PORT} -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
    process.exit(1);
  }
  throw err;
});

export default app;
