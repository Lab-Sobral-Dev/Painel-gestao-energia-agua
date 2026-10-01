import type Database from 'better-sqlite3';
import { gravarConsumo, gravarValor } from '../services/gravar';
import type { DadosImportados } from './lerPlanilha';

export interface ResumoImportacao {
  pontosCriados: number;
  fornecedoresCriados: number;
  valoresCriados: number;
  valoresAtualizados: number;
  consumosCriados: number;
  consumosAtualizados: number;
}

export function gravarDados(db: Database.Database, ano: number, dados: DadosImportados): ResumoImportacao {
  const resumo: ResumoImportacao = {
    pontosCriados: 0,
    fornecedoresCriados: 0,
    valoresCriados: 0,
    valoresAtualizados: 0,
    consumosCriados: 0,
    consumosAtualizados: 0,
  };

  const pontoId = (nome: string, tipo: 'energia' | 'agua'): number => {
    const ex = db.prepare('SELECT id FROM ponto WHERE nome = ? AND tipo = ?').get(nome, tipo) as { id: number } | undefined;
    if (ex) return ex.id;
    resumo.pontosCriados++;
    return Number(db.prepare('INSERT INTO ponto (nome, tipo) VALUES (?, ?)').run(nome, tipo).lastInsertRowid);
  };
  const fornecedorId = (nome: string): number => {
    const ex = db.prepare('SELECT id FROM fornecedor WHERE nome = ?').get(nome) as { id: number } | undefined;
    if (ex) return ex.id;
    resumo.fornecedoresCriados++;
    return Number(db.prepare('INSERT INTO fornecedor (nome) VALUES (?)').run(nome).lastInsertRowid);
  };

  db.transaction(() => {
    for (const f of dados.fornecedores) fornecedorId(f);
    for (const p of dados.pontos) {
      const id = pontoId(p.nome, p.tipo);
      if (p.tipo === 'agua' && p.hidrometro) {
        const medidor = dados.medidores.find((m) => m.hidrometro === p.hidrometro);
        // COALESCE: nunca sobrescreve o que já foi preenchido (inclusive manualmente na tela Cadastros)
        db.prepare(
          'UPDATE ponto SET hidrometro = COALESCE(hidrometro, ?), matricula = COALESCE(matricula, ?), localizacao = COALESCE(localizacao, ?) WHERE id = ?',
        ).run(p.hidrometro, medidor?.matricula ?? null, medidor?.localizacao ?? null, id);
      }
    }
    for (const v of dados.valores) {
      const r = gravarValor(db, {
        pontoId: pontoId(v.ponto, v.tipo),
        ano,
        mes: v.mes,
        fornecedorId: v.fornecedor === null ? null : fornecedorId(v.fornecedor),
        valorRs: v.valorRs,
      });
      if (r === 'criado') resumo.valoresCriados++;
      if (r === 'atualizado') resumo.valoresAtualizados++;
    }
    for (const c of dados.consumos) {
      const r = gravarConsumo(db, { pontoId: pontoId(c.ponto, c.tipo), ano, mes: c.mes, quantidade: c.quantidade });
      if (r === 'criado') resumo.consumosCriados++;
      if (r === 'atualizado') resumo.consumosAtualizados++;
    }
  })();

  return resumo;
}
