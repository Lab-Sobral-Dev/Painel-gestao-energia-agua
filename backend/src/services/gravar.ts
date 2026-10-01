import type Database from 'better-sqlite3';

export type Resultado = 'criado' | 'atualizado' | 'removido' | 'nada';

export function gravarValor(
  db: Database.Database,
  a: { pontoId: number; ano: number; mes: number; fornecedorId: number | null; valorRs: number | null },
): Resultado {
  const ex = db
    .prepare('SELECT id FROM lancamento_valor WHERE ponto_id = ? AND ano = ? AND mes = ? AND fornecedor_id IS ?')
    .get(a.pontoId, a.ano, a.mes, a.fornecedorId) as { id: number } | undefined;
  if (a.valorRs === null) {
    if (!ex) return 'nada';
    db.prepare('DELETE FROM lancamento_valor WHERE id = ?').run(ex.id);
    return 'removido';
  }
  if (ex) {
    db.prepare('UPDATE lancamento_valor SET valor_rs = ? WHERE id = ?').run(a.valorRs, ex.id);
    return 'atualizado';
  }
  db.prepare('INSERT INTO lancamento_valor (ponto_id, ano, mes, fornecedor_id, valor_rs) VALUES (?, ?, ?, ?, ?)').run(
    a.pontoId,
    a.ano,
    a.mes,
    a.fornecedorId,
    a.valorRs,
  );
  return 'criado';
}

export function gravarConsumo(
  db: Database.Database,
  a: { pontoId: number; ano: number; mes: number; quantidade: number | null },
): Resultado {
  const ex = db
    .prepare('SELECT id FROM lancamento_consumo WHERE ponto_id = ? AND ano = ? AND mes = ?')
    .get(a.pontoId, a.ano, a.mes) as { id: number } | undefined;
  if (a.quantidade === null) {
    if (!ex) return 'nada';
    db.prepare('DELETE FROM lancamento_consumo WHERE id = ?').run(ex.id);
    return 'removido';
  }
  if (ex) {
    db.prepare('UPDATE lancamento_consumo SET quantidade = ? WHERE id = ?').run(a.quantidade, ex.id);
    return 'atualizado';
  }
  db.prepare('INSERT INTO lancamento_consumo (ponto_id, ano, mes, quantidade) VALUES (?, ?, ?, ?)').run(
    a.pontoId,
    a.ano,
    a.mes,
    a.quantidade,
  );
  return 'criado';
}
