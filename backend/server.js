import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './src/config/env.js';
import { prisma } from './src/config/prisma.js';
import { authRouter } from './src/routes/auth.routes.js';
import { validationError } from './src/controllers/auth.controller.js';

const app = express();
const root = env.FRONTEND_DIR ? path.resolve(env.FRONTEND_DIR) : fileURLToPath(new URL('../', import.meta.url));
const frontendRoot = env.FRONTEND_DIR ? root : path.join(root, 'frontend');
const isProduction = env.NODE_ENV === 'production';
const requestLog = new Map();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());

app.use('/api/auth', (request, response, next) => {
  if (request.method === 'GET') return next();
  const origin = request.get('origin');
  const expected = `${isProduction ? 'https' : 'http'}://${request.get('host')}`;
  if (origin && origin !== expected) return response.status(403).json({ error: 'Origem não permitida.' });
  const key = request.ip;
  const now = Date.now();
  const attempts = (requestLog.get(key) || []).filter((time) => now - time < 15 * 60 * 1000);
  attempts.push(now);
  requestLog.set(key, attempts);
  if (attempts.length > 20) return response.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' });
  next();
});

app.use('/api/auth', authRouter);
app.get('/', (request, response) => response.sendFile(path.join(root, 'index.html')));
app.use('/frontend', express.static(frontendRoot, { index: false, dotfiles: 'deny' }));
app.use(validationError);
app.use((error, request, response, next) => {
  console.error(error);
  response.status(500).json({ error: 'Ocorreu um erro. Tente novamente.' });
});

const server = app.listen(env.PORT, () => console.log(`Hope Sobremesas: http://localhost:${env.PORT}`));

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
