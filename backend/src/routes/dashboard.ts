import { Router } from 'express';
import type Database from 'better-sqlite3';
import { consultaSchema } from '../schemas';
import { resumir } from '../services/dashboard';
import { montarTabela } from '../services/tabela';

export function dashboardRouter(db: Database.Database) {
  const r = Router();
  r.get('/', (req, res) => {
    const { ano, tipo } = consultaSchema.parse(req.query);
    res.json(resumir(montarTabela(db, ano, tipo)));
  });
  return r;
}
