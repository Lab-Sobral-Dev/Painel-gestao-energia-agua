import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { criarPonto, novoAmbiente } from './helpers';

describe('/api/pontos', () => {
  it('cria e lista, filtrando por tipo', async () => {
    const { app } = novoAmbiente();
    const r = await request(app).post('/api/pontos').send({ nome: 'ADM/CQ', tipo: 'agua', matricula: '123' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ nome: 'ADM/CQ', tipo: 'agua', matricula: '123', hidrometro: null, ativo: true });
    await request(app).post('/api/pontos').send({ nome: 'BENTO LEÃO 25', tipo: 'energia' });
    const todos = await request(app).get('/api/pontos');
    expect(todos.body).toHaveLength(2);
    const so = await request(app).get('/api/pontos?tipo=energia');
    expect(so.body.map((p: { nome: string }) => p.nome)).toEqual(['BENTO LEÃO 25']);
  });

  it('rejeita nome vazio com mensagem por campo', async () => {
    const { app } = novoAmbiente();
    const r = await request(app).post('/api/pontos').send({ nome: '  ', tipo: 'agua' });
    expect(r.status).toBe(400);
    expect(r.body.campos.nome).toBeTruthy();
  });

  it('rejeita nome duplicado no mesmo tipo (409)', async () => {
    const { app } = novoAmbiente();
    await request(app).post('/api/pontos').send({ nome: 'X', tipo: 'agua' });
    const r = await request(app).post('/api/pontos').send({ nome: 'X', tipo: 'agua' });
    expect(r.status).toBe(409);
  });

  it('atualiza dados e inativa, mas não troca o tipo', async () => {
    const { app } = novoAmbiente();
    const { body } = await request(app).post('/api/pontos').send({ nome: 'X', tipo: 'agua' });
    const r = await request(app).put(`/api/pontos/${body.id}`).send({ hidrometro: 'A22', ativo: false, tipo: 'energia' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ hidrometro: 'A22', ativo: false, tipo: 'agua' });
  });

  it('devolve 404 para id inexistente e 400 para id inválido', async () => {
    const { app } = novoAmbiente();
    expect((await request(app).put('/api/pontos/999').send({ nome: 'Y' })).status).toBe(404);
    expect((await request(app).delete('/api/pontos/abc')).status).toBe(400);
  });

  it('exclui ponto sem lançamentos (204)', async () => {
    const { app } = novoAmbiente();
    const { body } = await request(app).post('/api/pontos').send({ nome: 'X', tipo: 'agua' });
    expect((await request(app).delete(`/api/pontos/${body.id}`)).status).toBe(204);
    expect((await request(app).get('/api/pontos')).body).toHaveLength(0);
  });

  it('bloqueia exclusão de ponto com lançamentos (409)', async () => {
    const { app, db } = novoAmbiente();
    const id = criarPonto(db, 'X', 'agua');
    db.prepare('INSERT INTO lancamento_consumo (ponto_id, ano, mes, quantidade) VALUES (?, 2026, 1, 5)').run(id);
    const r = await request(app).delete(`/api/pontos/${id}`);
    expect(r.status).toBe(409);
    expect(r.body.erro).toMatch(/inativ/i);
  });

  it('devolve 404 em JSON para rota de API desconhecida', async () => {
    const { app } = novoAmbiente();
    const r = await request(app).get('/api/nada');
    expect(r.status).toBe(404);
    expect(r.body.erro).toBeTruthy();
  });

  it('devolve 400 para JSON malformado', async () => {
    const { app } = novoAmbiente();
    const r = await request(app).post('/api/pontos').set('Content-Type', 'application/json').send('{ruim');
    expect(r.status).toBe(400);
  });
});
