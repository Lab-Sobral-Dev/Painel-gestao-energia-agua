import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { Celula } from '../src/calc';
import { resumir } from '../src/services/dashboard';
import type { Tabela } from '../src/services/tabela';
import { criarPonto, novoAmbiente } from './helpers';

const doze = (parcial: Record<number, number>): Celula[] =>
  Array.from({ length: 12 }, (_, i) => (parcial[i] !== undefined ? parcial[i] : null));

function tabela(valor: Celula[], consumo: Celula[]): Tabela {
  return {
    ano: 2026,
    tipo: 'energia',
    fornecedores: [],
    linhas: [{ pontoId: 1, nome: 'A', ativo: true, valores: [], consumo, totalValor: valor }],
    totalGeralValor: valor,
    totalGeralConsumo: consumo,
  };
}

describe('resumir', () => {
  it('calcula totais, média, custo médio, último mês e variação', () => {
    const d = resumir(tabela(doze({ 0: 100, 1: 200, 2: 300 }), doze({ 0: 10, 1: 10, 2: 20 })));
    expect(d.totalAnualValor).toBe(600);
    expect(d.mediaMensalValor).toBe(200);
    expect(d.totalAnualConsumo).toBe(40);
    expect(d.mensal[2]).toEqual({ mes: 3, valor: 300, consumo: 20, custoMedio: 15 });
    expect(d.mensal[5]).toEqual({ mes: 6, valor: null, consumo: null, custoMedio: null });
    expect(d.ultimoMes).toEqual({ mes: 3, valor: 300, variacaoPct: 50 });
    expect(d.porPonto[0]).toMatchObject({ nome: 'A', totalValor: 600, totalConsumo: 40 });
  });

  it('sem dados devolve null em tudo (sem NaN)', () => {
    const d = resumir(tabela(doze({}), doze({})));
    expect(d.totalAnualValor).toBeNull();
    expect(d.mediaMensalValor).toBeNull();
    expect(d.ultimoMes).toBeNull();
    expect(JSON.stringify(d)).not.toMatch(/NaN|Infinity/);
  });

  it('variação é null quando o mês anterior não existe ou é zero', () => {
    expect(resumir(tabela(doze({ 2: 300 }), doze({}))).ultimoMes?.variacaoPct).toBeNull();
    expect(resumir(tabela(doze({ 0: 0, 1: 50 }), doze({}))).ultimoMes?.variacaoPct).toBeNull();
  });
});

describe('GET /api/dashboard', () => {
  it('responde para um ano sem nenhum cadastro', async () => {
    const { app } = novoAmbiente();
    const r = await request(app).get('/api/dashboard?ano=2026&tipo=agua');
    expect(r.status).toBe(200);
    expect(r.body.mensal).toHaveLength(12);
    expect(r.body.totalAnualValor).toBeNull();
  });

  it('reflete lançamentos gravados', async () => {
    const { app, db } = novoAmbiente();
    const p = criarPonto(db, 'P', 'agua');
    await request(app).put('/api/lancamentos/valor').send({ pontoId: p, ano: 2026, mes: 1, fornecedorId: null, valorRs: 80 });
    await request(app).put('/api/lancamentos/valor').send({ pontoId: p, ano: 2026, mes: 2, fornecedorId: null, valorRs: 100 });
    const r = await request(app).get('/api/dashboard?ano=2026&tipo=agua');
    expect(r.body.totalAnualValor).toBe(180);
    expect(r.body.ultimoMes).toEqual({ mes: 2, valor: 100, variacaoPct: 25 });
  });
});
