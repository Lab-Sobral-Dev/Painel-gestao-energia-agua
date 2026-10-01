import type Database from 'better-sqlite3';
import { openDb } from '../src/db';
import { createApp } from '../src/app';

export function novoAmbiente() {
  const db = openDb(':memory:');
  const app = createApp(db);
  return { db, app };
}

export function criarPonto(db: Database.Database, nome: string, tipo: 'energia' | 'agua'): number {
  return Number(db.prepare('INSERT INTO ponto (nome, tipo) VALUES (?, ?)').run(nome, tipo).lastInsertRowid);
}

export function criarFornecedor(db: Database.Database, nome: string): number {
  return Number(db.prepare('INSERT INTO fornecedor (nome) VALUES (?)').run(nome).lastInsertRowid);
}
