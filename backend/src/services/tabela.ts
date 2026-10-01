import type Database from 'better-sqlite3';
import { somar, type Celula } from '../calc';

export type Tipo = 'energia' | 'agua';

export interface LinhaTabela {
  pontoId: number;
  nome: string;
  ativo: boolean;
  valores: { fornecedorId: number | null; meses: Celula[] }[];
  consumo: Celula[];
  totalValor: Celula[];
}

export interface Tabela {
  ano: number;
  tipo: Tipo;
  fornecedores: { id: number; nome: string }[];
  linhas: LinhaTabela[];
  totalGeralValor: Celula[];
  totalGeralConsumo: Celula[];
}

const vazio = (): Celula[] => Array<Celula>(12).fill(null);
const porMes = (f: (i: number) => Celula): Celula[] => Array.from({ length: 12 }, (_, i) => f(i));

export function montarTabela(db: Database.Database, ano: number, tipo: Tipo): Tabela {
  const fornecedores =
    tipo === 'energia' ? (db.prepare('SELECT id, nome FROM fornecedor ORDER BY id').all() as { id: number; nome: string }[]) : [];

  const pontos = db
    .prepare(
      `SELECT id, nome, ativo FROM ponto
       WHERE tipo = ? AND (ativo = 1 OR id IN (
         SELECT ponto_id FROM lancamento_valor WHERE ano = ?
         UNION SELECT ponto_id FROM lancamento_consumo WHERE ano = ?))
       ORDER BY nome`,
    )
    .all(tipo, ano, ano) as { id: number; nome: string; ativo: number }[];

  const valores = db
    .prepare('SELECT ponto_id, mes, fornecedor_id, valor_rs FROM lancamento_valor WHERE ano = ?')
    .all(ano) as { ponto_id: number; mes: number; fornecedor_id: number | null; valor_rs: number }[];
  const consumos = db
    .prepare('SELECT ponto_id, mes, quantidade FROM lancamento_consumo WHERE ano = ?')
    .all(ano) as { ponto_id: number; mes: number; quantidade: number }[];

  const linhas: LinhaTabela[] = pontos.map((p) => {
    const colunas = tipo === 'energia' ? fornecedores.map((f) => f.id) : [null];
    const vals = colunas.map((fornecedorId) => ({ fornecedorId, meses: vazio() }));
    for (const v of valores) {
      if (v.ponto_id !== p.id) continue;
      const col = vals.find((c) => c.fornecedorId === v.fornecedor_id);
      if (col) col.meses[v.mes - 1] = v.valor_rs;
    }
    const consumo = vazio();
    for (const c of consumos) if (c.ponto_id === p.id) consumo[c.mes - 1] = c.quantidade;
    return {
      pontoId: p.id,
      nome: p.nome,
      ativo: p.ativo === 1,
      valores: vals,
      consumo,
      totalValor: porMes((i) => somar(vals.map((c) => c.meses[i]))),
    };
  });

  return {
    ano,
    tipo,
    fornecedores,
    linhas,
    totalGeralValor: porMes((i) => somar(linhas.map((l) => l.totalValor[i]))),
    totalGeralConsumo: porMes((i) => somar(linhas.map((l) => l.consumo[i]))),
  };
}
