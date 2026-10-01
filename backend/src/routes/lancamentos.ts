import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { AppError } from '../errors';
import { consultaSchema } from '../schemas';
import { gravarConsumo, gravarValor } from '../services/gravar';
import { montarTabela } from '../services/tabela';

const base = {
  pontoId: z.number().int(),
  ano: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
};
const valorSchema = z.object({
  ...base,
  fornecedorId: z.number().int().nullable(),
  valorRs: z.number().min(0, 'Não pode ser negativo').max(1e9).nullable(),
});
const consumoSchema = z.object({
  ...base,
  quantidade: z.number().min(0, 'Não pode ser negativo').max(1e9).nullable(),
});

function tipoDoPonto(db: Database.Database, id: number): 'energia' | 'agua' {
  const p = db.prepare('SELECT tipo FROM ponto WHERE id = ?').get(id) as { tipo: 'energia' | 'agua' } | undefined;
  if (!p) throw new AppError(404, 'Ponto não encontrado');
  return p.tipo;
}

export function lancamentosRouter(db: Database.Database) {
  const r = Router();

  r.get('/', (req, res) => {
    const { ano, tipo } = consultaSchema.parse(req.query);
    res.json(montarTabela(db, ano, tipo));
  });

  r.put('/valor', (req, res) => {
    const d = valorSchema.parse(req.body);
    const tipo = tipoDoPonto(db, d.pontoId);
    if (tipo === 'energia' && d.fornecedorId === null) {
      throw new AppError(400, 'Dados inválidos', { fornecedorId: 'Informe o fornecedor para lançamentos de energia' });
    }
    if (tipo === 'agua' && d.fornecedorId !== null) {
      throw new AppError(400, 'Dados inválidos', { fornecedorId: 'Lançamentos de água não têm fornecedor' });
    }
    if (d.fornecedorId !== null) {
      const f = db.prepare('SELECT id FROM fornecedor WHERE id = ?').get(d.fornecedorId);
      if (!f) throw new AppError(404, 'Fornecedor não encontrado');
    }
    gravarValor(db, d);
    res.status(204).end();
  });

  r.put('/consumo', (req, res) => {
    const d = consumoSchema.parse(req.body);
    tipoDoPonto(db, d.pontoId);
    gravarConsumo(db, d);
    res.status(204).end();
  });

  return r;
}
