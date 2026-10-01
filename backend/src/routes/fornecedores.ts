import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { AppError, idDe } from '../errors';

const schema = z.object({ nome: z.string().trim().min(1, 'Obrigatório') });

interface Linha {
  id: number;
  nome: string;
}

function buscar(db: Database.Database, id: number): Linha {
  const r = db.prepare('SELECT id, nome FROM fornecedor WHERE id = ?').get(id) as Linha | undefined;
  if (!r) throw new AppError(404, 'Fornecedor não encontrado');
  return r;
}

export function fornecedoresRouter(db: Database.Database) {
  const r = Router();

  r.get('/', (_req, res) => {
    res.json(db.prepare('SELECT id, nome FROM fornecedor ORDER BY id').all());
  });

  r.post('/', (req, res) => {
    const { nome } = schema.parse(req.body);
    const info = db.prepare('INSERT INTO fornecedor (nome) VALUES (?)').run(nome);
    res.status(201).json(buscar(db, Number(info.lastInsertRowid)));
  });

  r.put('/:id', (req, res) => {
    const id = idDe(req.params.id);
    buscar(db, id);
    const { nome } = schema.parse(req.body);
    db.prepare('UPDATE fornecedor SET nome = ? WHERE id = ?').run(nome, id);
    res.json(buscar(db, id));
  });

  r.delete('/:id', (req, res) => {
    const id = idDe(req.params.id);
    buscar(db, id);
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM lancamento_valor WHERE fornecedor_id = ?').get(id) as { n: number };
    if (n > 0) throw new AppError(409, 'Este fornecedor possui lançamentos e não pode ser excluído.');
    db.prepare('DELETE FROM fornecedor WHERE id = ?').run(id);
    res.status(204).end();
  });

  return r;
}
