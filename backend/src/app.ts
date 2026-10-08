import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type Database from 'better-sqlite3';
import './zod-pt';
import { errorHandler } from './errors';
import { pontosRouter } from './routes/pontos';
import { fornecedoresRouter } from './routes/fornecedores';
import { lancamentosRouter } from './routes/lancamentos';
import { dashboardRouter } from './routes/dashboard';
import { authRouter, cabecalhoFrame, exigirSessao, type ConfigAcoplamento } from './acoplamento';

export function createApp(
  db: Database.Database,
  opts: { staticDir?: string; acoplamento?: ConfigAcoplamento } = {},
) {
  const app = express();
  app.use(express.json());

  // Acoplamento ao Gestão SBR: só liga quando o index.ts passa a config (testes e uso local ficam abertos).
  if (opts.acoplamento) {
    app.use(cabecalhoFrame(opts.acoplamento));
    app.use('/api/auth', authRouter(opts.acoplamento));
    app.use('/api', exigirSessao(opts.acoplamento));
  }

  app.use('/api/pontos', pontosRouter(db));
  app.use('/api/fornecedores', fornecedoresRouter(db));
  app.use('/api/lancamentos', lancamentosRouter(db));
  app.use('/api/dashboard', dashboardRouter(db));
  app.use('/api', (_req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' });
  });

  if (opts.staticDir && fs.existsSync(opts.staticDir)) {
    app.use(express.static(opts.staticDir));
    app.get('*', (_req, res) => res.sendFile(path.join(opts.staticDir!, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
