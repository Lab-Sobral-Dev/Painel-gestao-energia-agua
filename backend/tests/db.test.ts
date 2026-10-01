import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db';

function ponto(db: ReturnType<typeof openDb>) {
  return Number(db.prepare("INSERT INTO ponto (nome, tipo) VALUES ('P', 'agua')").run().lastInsertRowid);
}

describe('openDb', () => {
  it('cria as tabelas', () => {
    const db = openDb(':memory:');
    const nomes = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name);
    expect(nomes).toEqual(expect.arrayContaining(['ponto', 'fornecedor', 'lancamento_valor', 'lancamento_consumo']));
  });

  it('rejeita valor negativo', () => {
    const db = openDb(':memory:');
    const id = ponto(db);
    expect(() =>
      db.prepare('INSERT INTO lancamento_valor (ponto_id, ano, mes, fornecedor_id, valor_rs) VALUES (?, 2026, 1, NULL, -5)').run(id),
    ).toThrow();
  });

  it('rejeita mês fora de 1-12', () => {
    const db = openDb(':memory:');
    const id = ponto(db);
    expect(() =>
      db.prepare('INSERT INTO lancamento_valor (ponto_id, ano, mes, fornecedor_id, valor_rs) VALUES (?, 2026, 13, NULL, 5)').run(id),
    ).toThrow();
  });

  it('impede lançamento duplicado mesmo com fornecedor nulo (água)', () => {
    const db = openDb(':memory:');
    const id = ponto(db);
    const ins = db.prepare('INSERT INTO lancamento_valor (ponto_id, ano, mes, fornecedor_id, valor_rs) VALUES (?, 2026, 1, NULL, 10)');
    ins.run(id);
    expect(() => ins.run(id)).toThrow();
  });
});
