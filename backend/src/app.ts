import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type Database from 'better-sqlite3';
import { errorHandler } from './errors';
import { pontosRouter } from './routes/pontos';
import { fornecedoresRouter } from './routes/fornecedores';

export function createApp(db: Database.Database, opts: { staticDir?: string } = {}) {
  const app = express();
  app.use(express.json());

  app.use('/api/pontos', pontosRouter(db));
  app.use('/api/fornecedores', fornecedoresRouter(db));
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
