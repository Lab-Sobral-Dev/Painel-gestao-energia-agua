import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { AppError, idDe } from '../errors';

const tipoSchema = z.enum(['energia', 'agua']);
const texto = z.string().trim().min(1, 'Obrigatório');
const opcional = z
  .string()
  .trim()
  .transform((s) => (s === '' ? null : s))
  .nullable()
  .optional();

const criarSchema = z.object({ nome: texto, tipo: tipoSchema, matricula: opcional, hidrometro: opcional, localizacao: opcional });
const atualizarSchema = criarSchema.omit({ tipo: true }).partial().extend({ ativo: z.boolean().optional() });

interface Linha {
  id: number;
  nome: string;
  tipo: 'energia' | 'agua';
  matricula: string | null;
  hidrometro: string | null;
  localizacao: string | null;
  ativo: number;
}

const paraApi = (r: Linha) => ({ ...r, ativo: r.ativo === 1 });

function buscar(db: Database.Database, id: number): Linha {
  const r = db.prepare('SELECT * FROM ponto WHERE id = ?').get(id) as Linha | undefined;
  if (!r) throw new AppError(404, 'Ponto não encontrado');
  return r;
}

export function pontosRouter(db: Database.Database) {
  const r = Router();

  r.get('/', (req, res) => {
    const rows = req.query.tipo
      ? db.prepare('SELECT * FROM ponto WHERE tipo = ? ORDER BY nome').all(tipoSchema.parse(req.query.tipo))
      : db.prepare('SELECT * FROM ponto ORDER BY tipo, nome').all();
    res.json((rows as Linha[]).map(paraApi));
  });

  r.post('/', (req, res) => {
    const d = criarSchema.parse(req.body);
    const info = db
      .prepare('INSERT INTO ponto (nome, tipo, matricula, hidrometro, localizacao) VALUES (?, ?, ?, ?, ?)')
      .run(d.nome, d.tipo, d.matricula ?? null, d.hidrometro ?? null, d.localizacao ?? null);
    res.status(201).json(paraApi(buscar(db, Number(info.lastInsertRowid))));
  });

  r.put('/:id', (req, res) => {
    const id = idDe(req.params.id);
    const atual = buscar(db, id);
    const d = atualizarSchema.parse(req.body);
    const novo = { ...atual };
    if (d.nome !== undefined) novo.nome = d.nome;
    if (d.matricula !== undefined) novo.matricula = d.matricula;
    if (d.hidrometro !== undefined) novo.hidrometro = d.hidrometro;
    if (d.localizacao !== undefined) novo.localizacao = d.localizacao;
    if (d.ativo !== undefined) novo.ativo = d.ativo ? 1 : 0;
    db.prepare('UPDATE ponto SET nome = ?, matricula = ?, hidrometro = ?, localizacao = ?, ativo = ? WHERE id = ?').run(
      novo.nome,
      novo.matricula,
      novo.hidrometro,
      novo.localizacao,
      novo.ativo,
      id,
    );
    res.json(paraApi(buscar(db, id)));
  });

  r.delete('/:id', (req, res) => {
    const id = idDe(req.params.id);
    buscar(db, id);
    const usos =
      (db.prepare('SELECT COUNT(*) AS n FROM lancamento_valor WHERE ponto_id = ?').get(id) as { n: number }).n +
      (db.prepare('SELECT COUNT(*) AS n FROM lancamento_consumo WHERE ponto_id = ?').get(id) as { n: number }).n;
    if (usos > 0) throw new AppError(409, 'Este ponto possui lançamentos. Inative-o em vez de excluir.');
    db.prepare('DELETE FROM ponto WHERE id = ?').run(id);
    res.status(204).end();
  });

  return r;
}
