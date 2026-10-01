import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { criarFornecedor, criarPonto, novoAmbiente } from './helpers';

describe('/api/fornecedores', () => {
  it('cria, lista, renomeia e exclui', async () => {
    const { app } = novoAmbiente();
    const c = await request(app).post('/api/fornecedores').send({ nome: 'EQUATORIAL' });
    expect(c.status).toBe(201);
    expect(c.body).toMatchObject({ nome: 'EQUATORIAL' });
    const u = await request(app).put(`/api/fornecedores/${c.body.id}`).send({ nome: 'EQUATORIAL S.A' });
    expect(u.body.nome).toBe('EQUATORIAL S.A');
    expect((await request(app).get('/api/fornecedores')).body).toHaveLength(1);
    expect((await request(app).delete(`/api/fornecedores/${c.body.id}`)).status).toBe(204);
  });

  it('rejeita nome vazio e duplicado', async () => {
    const { app } = novoAmbiente();
    expect((await request(app).post('/api/fornecedores').send({ nome: '' })).status).toBe(400);
    await request(app).post('/api/fornecedores').send({ nome: 'A' });
    expect((await request(app).post('/api/fornecedores').send({ nome: 'A' })).status).toBe(409);
  });

  it('bloqueia exclusão de fornecedor com lançamentos', async () => {
    const { app, db } = novoAmbiente();
    const p = criarPonto(db, 'P', 'energia');
    const f = criarFornecedor(db, 'F');
    db.prepare('INSERT INTO lancamento_valor (ponto_id, ano, mes, fornecedor_id, valor_rs) VALUES (?, 2026, 1, ?, 10)').run(p, f);
    expect((await request(app).delete(`/api/fornecedores/${f}`)).status).toBe(409);
  });
});
