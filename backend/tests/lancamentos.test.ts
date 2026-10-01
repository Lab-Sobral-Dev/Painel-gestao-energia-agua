import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { criarFornecedor, criarPonto, novoAmbiente } from './helpers';

const contar = (db: import('better-sqlite3').Database, t: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;

describe('lançamentos de energia', () => {
  it('grava valores por fornecedor e consumo e devolve totais calculados', async () => {
    const { app, db } = novoAmbiente();
    const p = criarPonto(db, 'BENTO LEÃO 25', 'energia');
    const f1 = criarFornecedor(db, 'EQUATORIAL');
    const f2 = criarFornecedor(db, 'RENOVAVEIS');
    const put = (url: string, body: object) => request(app).put(url).send(body);
    expect((await put('/api/lancamentos/valor', { pontoId: p, ano: 2026, mes: 5, fornecedorId: f1, valorRs: 10871.41 })).status).toBe(204);
    await put('/api/lancamentos/valor', { pontoId: p, ano: 2026, mes: 5, fornecedorId: f2, valorRs: 4265.54 });
    await put('/api/lancamentos/consumo', { pontoId: p, ano: 2026, mes: 5, quantidade: 19.59 });

    const r = await request(app).get('/api/lancamentos?ano=2026&tipo=energia');
    expect(r.status).toBe(200);
    expect(r.body.fornecedores.map((f: { nome: string }) => f.nome)).toEqual(['EQUATORIAL', 'RENOVAVEIS']);
    const linha = r.body.linhas[0];
    expect(linha.nome).toBe('BENTO LEÃO 25');
    expect(linha.valores[0].meses[4]).toBe(10871.41);
    expect(linha.totalValor[4]).toBe(15136.95);
    expect(linha.totalValor[0]).toBeNull();
    expect(linha.consumo[4]).toBe(19.59);
    expect(r.body.totalGeralValor[4]).toBe(15136.95);
    expect(r.body.totalGeralConsumo[4]).toBe(19.59);
  });

  it('exige fornecedor para energia', async () => {
    const { app, db } = novoAmbiente();
    const p = criarPonto(db, 'P', 'energia');
    const r = await request(app).put('/api/lancamentos/valor').send({ pontoId: p, ano: 2026, mes: 1, fornecedorId: null, valorRs: 5 });
    expect(r.status).toBe(400);
    expect(r.body.campos.fornecedorId).toBeTruthy();
  });
});

describe('lançamentos de água', () => {
  it('grava sem fornecedor e rejeita fornecedor', async () => {
    const { app, db } = novoAmbiente();
    const p = criarPonto(db, 'ADM/CQ', 'agua');
    const f = criarFornecedor(db, 'F');
    const ok = await request(app).put('/api/lancamentos/valor').send({ pontoId: p, ano: 2026, mes: 3, fornecedorId: null, valorRs: 943.37 });
    expect(ok.status).toBe(204);
    const ruim = await request(app).put('/api/lancamentos/valor').send({ pontoId: p, ano: 2026, mes: 3, fornecedorId: f, valorRs: 1 });
    expect(ruim.status).toBe(400);
    const t = await request(app).get('/api/lancamentos?ano=2026&tipo=agua');
    expect(t.body.linhas[0].valores).toHaveLength(1);
    expect(t.body.linhas[0].valores[0].meses[2]).toBe(943.37);
  });
});

describe('regras de gravação', () => {
  it('regravar a mesma célula atualiza sem duplicar', async () => {
    const { app, db } = novoAmbiente();
    const p = criarPonto(db, 'P', 'agua');
    const corpo = { pontoId: p, ano: 2026, mes: 1, fornecedorId: null };
    await request(app).put('/api/lancamentos/valor').send({ ...corpo, valorRs: 10 });
    await request(app).put('/api/lancamentos/valor').send({ ...corpo, valorRs: 20 });
    expect(contar(db, 'lancamento_valor')).toBe(1);
    const t = await request(app).get('/api/lancamentos?ano=2026&tipo=agua');
    expect(t.body.linhas[0].valores[0].meses[0]).toBe(20);
  });

  it('zero é um lançamento; null remove o lançamento', async () => {
    const { app, db } = novoAmbiente();
    const p = criarPonto(db, 'P', 'agua');
    const corpo = { pontoId: p, ano: 2026, mes: 1, fornecedorId: null };
    await request(app).put('/api/lancamentos/valor').send({ ...corpo, valorRs: 0 });
    let t = await request(app).get('/api/lancamentos?ano=2026&tipo=agua');
    expect(t.body.linhas[0].totalValor[0]).toBe(0);
    await request(app).put('/api/lancamentos/valor').send({ ...corpo, valorRs: null });
    t = await request(app).get('/api/lancamentos?ano=2026&tipo=agua');
    expect(t.body.linhas[0].totalValor[0]).toBeNull();
    expect(contar(db, 'lancamento_valor')).toBe(0);
  });

  it('rejeita negativo, mês inválido e ponto inexistente', async () => {
    const { app, db } = novoAmbiente();
    const p = criarPonto(db, 'P', 'agua');
    const base = { pontoId: p, ano: 2026, mes: 1, fornecedorId: null, valorRs: 1 };
    expect((await request(app).put('/api/lancamentos/valor').send({ ...base, valorRs: -1 })).status).toBe(400);
    expect((await request(app).put('/api/lancamentos/valor').send({ ...base, mes: 13 })).status).toBe(400);
    expect((await request(app).put('/api/lancamentos/valor').send({ ...base, pontoId: 999 })).status).toBe(404);
    expect((await request(app).put('/api/lancamentos/consumo').send({ pontoId: p, ano: 2026, mes: 1, quantidade: -3 })).status).toBe(400);
  });

  it('GET exige ano e tipo válidos', async () => {
    const { app } = novoAmbiente();
    expect((await request(app).get('/api/lancamentos?ano=abc&tipo=agua')).status).toBe(400);
    expect((await request(app).get('/api/lancamentos?ano=2026&tipo=gas')).status).toBe(400);
  });

  it('ponto inativo só aparece no ano em que tem dados', async () => {
    const { app, db } = novoAmbiente();
    const p = criarPonto(db, 'ANTIGO', 'agua');
    db.prepare('UPDATE ponto SET ativo = 0 WHERE id = ?').run(p);
    expect((await request(app).get('/api/lancamentos?ano=2026&tipo=agua')).body.linhas).toHaveLength(0);
    await request(app).put('/api/lancamentos/consumo').send({ pontoId: p, ano: 2026, mes: 1, quantidade: 5 });
    expect((await request(app).get('/api/lancamentos?ano=2026&tipo=agua')).body.linhas).toHaveLength(1);
    expect((await request(app).get('/api/lancamentos?ano=2025&tipo=agua')).body.linhas).toHaveLength(0);
  });
});
