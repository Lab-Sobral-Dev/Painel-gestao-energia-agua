# Painel Energia e Água 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a planilha `ENERGIA E ÁGUA 2026.xlsx` por um sistema web interno (sem login) para lançar, consultar e visualizar consumo e custo de energia e água.

**Architecture:** Monorepo npm workspaces. `backend/` = Express + TypeScript + SQLite (`better-sqlite3`) com validação Zod; toda lógica de cálculo fica em funções puras e em serviços testáveis com SQLite em memória. `frontend/` = React + Vite + Tailwind + Recharts, que só exibe e edita; totais vêm sempre do servidor. Em produção o Express serve o `frontend/dist`: um único processo (`npm start`).

**Tech Stack:** Node 18+, Express 4, better-sqlite3, Zod 3, ExcelJS (importação), Vitest + Supertest (backend), React 18, Vite, Tailwind 3, Recharts 2, Vitest + Testing Library (frontend).

**Spec:** `docs/superpowers/specs/2026-10-01-painel-energia-agua-design.md`

## Global Constraints

- Sem autenticação, sem usuários, sem JWT, sem Docker, sem PostgreSQL.
- Banco = arquivo SQLite único (`backend/dados.sqlite`, sobrescrevível por `DB_PATH`). Backup = `npm run backup`.
- Servidor escuta em `0.0.0.0`, porta `PORT` (padrão 3000). Sem CORS (mesma origem; em dev o Vite faz proxy de `/api`).
- Totais, médias e custo médio são **calculados na consulta e nunca gravados**.
- Célula vazia = "sem lançamento" (`null`), diferente de `0`. Valores negativos são rejeitados.
- Média mensal = média dos meses **que têm lançamento** (não divide por 12).
- Mensagens de erro e textos de UI em português. Formato de erro da API: `{ "erro": string, "campos"?: Record<string,string> }`.
- Unidade de consumo de energia fica numa constante única (`UNIDADE_ENERGIA = 'MWh'`, em `frontend/src/format.ts`), **a confirmar com o usuário**; água = `m³`.
- Tipos de ponto: `'energia' | 'agua'`. Meses: inteiros 1–12.
- Excluir ponto/fornecedor com lançamentos é bloqueado (409); ponto pode ser inativado.
- O projeto não é um repositório git hoje; a Task 1 faz `git init`.

## Review Focus

1. **Zero vs. vazio:** gravar `0` deve persistir como `0`; limpar a célula (`null`) remove o lançamento e o total mostra `null`, não `0` (Task 4).
2. **Número digitado em pt-BR:** `1.234,56`, `R$ 1.234,56`, `10577,1`, `1.234`, vazio, `-5` e `abc` precisam ser interpretados ou rejeitados corretamente (Task 8).
3. **Reimportar a planilha:** rodar o importador duas vezes não pode duplicar nem alterar totais (Task 7).
4. **Excluir/alterar ponto com histórico:** excluir com lançamentos é 409 e o `tipo` do ponto não pode mudar depois de criado (Task 3).
5. **Ano sem dados:** dashboard de ano vazio devolve `null` (não `NaN`, nem divisão por zero) e a UI mostra "—" (Tasks 5 e 9).

---

## File Structure

```
package.json                          (modify) workspaces + scripts
.gitignore                            (create)
backend/
  package.json, tsconfig.json, vitest.config.ts
  src/
    schema.ts        DDL SQLite (string)
    db.ts            openDb(file)
    calc.ts          funções puras: somar, media, custoMedio
    errors.ts        AppError, idDe, errorHandler
    schemas.ts       schemas Zod compartilhados (consulta ano/tipo)
    app.ts           createApp(db, {staticDir?})
    index.ts         servidor
    routes/pontos.ts, fornecedores.ts, lancamentos.ts, dashboard.ts
    services/gravar.ts      gravarValor / gravarConsumo (upsert manual)
    services/tabela.ts      montarTabela(db, ano, tipo)
    services/dashboard.ts   resumir(tabela)
    importar/lerPlanilha.ts  lê workbook ExcelJS -> DadosImportados (puro)
    importar/gravarDados.ts  DadosImportados -> SQLite (idempotente)
    importar/cli.ts          npm run importar
  scripts/backup.ts
  tests/*.test.ts
frontend/
  package.json, tsconfig.json, vite.config.ts, index.html,
  tailwind.config.cjs, postcss.config.cjs
  src/main.tsx, index.css, App.tsx, types.ts, api.ts, format.ts (+ .test.ts)
  src/components/CelulaEditavel.tsx (+ .test.tsx)
  src/pages/Dashboard.tsx, Lancamentos.tsx, Cadastros.tsx
```

---

### Task 1: Scaffold do monorepo, git e banco SQLite

**Files:**
- Modify: `package.json`
- Create: `.gitignore`, `backend/package.json`, `backend/tsconfig.json`, `backend/vitest.config.ts`
- Create: `backend/src/schema.ts`, `backend/src/db.ts`
- Test: `backend/tests/db.test.ts`

**Interfaces:**
- Produces: `openDb(file: string): Database.Database` (cria tabelas, `foreign_keys = ON`); `SCHEMA: string`.

- [ ] **Step 1: Inicializar git e arquivos de configuração**

Run: `git init` (na raiz do projeto).

`.gitignore`:
```
node_modules/
dist/
*.sqlite
backend/backups/
.env
```

`package.json` (raiz) — substituir o conteúdo:
```json
{
  "name": "energia-agua-painel",
  "version": "1.0.0",
  "description": "Painel interno de energia e água",
  "private": true,
  "workspaces": ["backend"],
  "scripts": {
    "dev": "concurrently \"npm run dev -w backend\" \"npm run dev -w frontend\"",
    "build": "npm run build -w backend && npm run build -w frontend",
    "start": "npm start -w backend",
    "test": "npm test -w backend",
    "importar": "npm run importar -w backend --",
    "backup": "npm run backup -w backend"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

`backend/package.json`:
```json
{
  "name": "backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "importar": "tsx src/importar/cli.ts",
    "backup": "tsx scripts/backup.ts"
  }
}
```

`backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`backend/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
```

- [ ] **Step 2: Instalar dependências**

Run:
```
npm install -w backend express@4 better-sqlite3 zod@3 exceljs
npm install -w backend -D typescript tsx vitest supertest @types/node @types/express@4 @types/supertest @types/better-sqlite3
npm install -D concurrently
```
Expected: instala sem erro. Se `better-sqlite3` falhar por falta de binário pré-compilado para a versão do Node (`node -v`), usar um Node LTS (20 ou 22).

- [ ] **Step 3: Escrever o teste que falha**

`backend/tests/db.test.ts`:
```ts
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
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm test -w backend`
Expected: FAIL — `Cannot find module '../src/db'`.

- [ ] **Step 5: Implementar**

`backend/src/schema.ts`:
```ts
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS ponto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('energia', 'agua')),
  matricula TEXT,
  hidrometro TEXT,
  localizacao TEXT,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  UNIQUE (nome, tipo)
);

CREATE TABLE IF NOT EXISTS fornecedor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS lancamento_valor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ponto_id INTEGER NOT NULL REFERENCES ponto(id),
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  fornecedor_id INTEGER REFERENCES fornecedor(id),
  valor_rs REAL NOT NULL CHECK (valor_rs >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lancamento_valor
  ON lancamento_valor (ponto_id, ano, mes, COALESCE(fornecedor_id, 0));

CREATE TABLE IF NOT EXISTS lancamento_consumo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ponto_id INTEGER NOT NULL REFERENCES ponto(id),
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  quantidade REAL NOT NULL CHECK (quantidade >= 0),
  UNIQUE (ponto_id, ano, mes)
);
`;
```

`backend/src/db.ts`:
```ts
import Database from 'better-sqlite3';
import { SCHEMA } from './schema';

export function openDb(file: string): Database.Database {
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -w backend`
Expected: 4 testes PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold do monorepo, schema SQLite e openDb"
```

---

### Task 2: Cálculos puros

**Files:**
- Create: `backend/src/calc.ts`
- Test: `backend/tests/calc.test.ts`

**Interfaces:**
- Produces:
  - `type Celula = number | null`
  - `arredondar(n: number): number` (2 casas)
  - `somar(v: Celula[]): Celula` — ignora `null`; `null` se todos `null`
  - `media(v: Celula[]): Celula` — média dos não-nulos; `null` se nenhum
  - `custoMedio(totalRs: Celula, consumo: Celula): Celula` — `null` se algum for `null` ou consumo `0`

- [ ] **Step 1: Teste que falha**

`backend/tests/calc.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { custoMedio, media, somar } from '../src/calc';

describe('somar', () => {
  it('ignora nulos', () => expect(somar([1, null, 2])).toBe(3));
  it('devolve null quando não há nenhum valor', () => expect(somar([null, null])).toBeNull());
  it('trata 0 como valor, não como vazio', () => expect(somar([0, null])).toBe(0));
  it('evita erro de ponto flutuante', () => expect(somar([1.1, 2.2])).toBe(3.3));
});

describe('media', () => {
  it('divide só pelos meses com lançamento', () => expect(media([10, null, 20])).toBe(15));
  it('devolve null sem valores', () => expect(media([null, null])).toBeNull());
});

describe('custoMedio', () => {
  it('reproduz o valor da planilha (85.085,22 / 914,76 = 93,01)', () =>
    expect(custoMedio(85085.22, 914.76)).toBe(93.01));
  it('devolve null com consumo zero', () => expect(custoMedio(100, 0)).toBeNull());
  it('devolve null com algum lado vazio', () => {
    expect(custoMedio(null, 5)).toBeNull();
    expect(custoMedio(5, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w backend -- calc`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

`backend/src/calc.ts`:
```ts
export type Celula = number | null;

export const arredondar = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function presentes(v: Celula[]): number[] {
  return v.filter((x): x is number => x !== null);
}

export function somar(v: Celula[]): Celula {
  const n = presentes(v);
  return n.length ? arredondar(n.reduce((a, b) => a + b, 0)) : null;
}

export function media(v: Celula[]): Celula {
  const n = presentes(v);
  return n.length ? arredondar(n.reduce((a, b) => a + b, 0) / n.length) : null;
}

export function custoMedio(totalRs: Celula, consumo: Celula): Celula {
  if (totalRs === null || consumo === null || consumo === 0) return null;
  return arredondar(totalRs / consumo);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -w backend -- calc`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend && git commit -m "feat: calculos puros (somar, media, custoMedio)"
```

---

### Task 3: App Express, erros e CRUD de pontos e fornecedores

**Files:**
- Create: `backend/src/errors.ts`, `backend/src/app.ts`, `backend/src/routes/pontos.ts`, `backend/src/routes/fornecedores.ts`
- Test: `backend/tests/helpers.ts`, `backend/tests/pontos.test.ts`, `backend/tests/fornecedores.test.ts`

**Interfaces:**
- Consumes: `openDb` (Task 1).
- Produces:
  - `class AppError(status: number, message: string, campos?: Record<string,string>)`
  - `idDe(p: string): number` (lança `AppError 400`)
  - `errorHandler` (Express)
  - `createApp(db: Database.Database, opts?: { staticDir?: string }): Express`
  - Rotas `/api/pontos` e `/api/fornecedores` (JSON). Ponto na API: `{ id, nome, tipo, matricula, hidrometro, localizacao, ativo: boolean }`. Fornecedor: `{ id, nome }`.
  - Helpers de teste: `novoAmbiente()`, `criarPonto(db, nome, tipo)`, `criarFornecedor(db, nome)`.

- [ ] **Step 1: Helpers e testes que falham**

`backend/tests/helpers.ts`:
```ts
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
```

`backend/tests/pontos.test.ts`:
```ts
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
```

`backend/tests/fornecedores.test.ts`:
```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w backend -- pontos fornecedores`
Expected: FAIL — `../src/app` não existe.

- [ ] **Step 3: Implementar erros e app**

`backend/src/errors.ts`:
```ts
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public campos?: Record<string, string>,
  ) {
    super(message);
  }
}

export function idDe(valor: string): number {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'Id inválido');
  return id;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const campos: Record<string, string> = {};
    for (const i of err.issues) campos[i.path.join('.') || '_'] = i.message;
    res.status(400).json({ erro: 'Dados inválidos', campos });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ erro: err.message, campos: err.campos });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ erro: 'JSON inválido' });
    return;
  }
  if (typeof err?.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT_UNIQUE')) {
    res.status(409).json({ erro: 'Já existe um registro com esses dados' });
    return;
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
};
```

`backend/src/app.ts`:
```ts
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type Database from 'better-sqlite3';
import { errorHandler } from './errors';
import { pontosRouter } from './routes/pontos';
import { fornecedoresRouter } from './routes/fornecedores';

export function createApp(db: Database.Database, opts: { staticDir?: string } = {}) {
  const app = express();
  app.use(express.json());

  app.use('/api/pontos', pontosRouter(db));
  app.use('/api/fornecedores', fornecedoresRouter(db));
  app.use('/api', (_req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' });
  });

  if (opts.staticDir && fs.existsSync(opts.staticDir)) {
    app.use(express.static(opts.staticDir));
    app.get('*', (_req, res) => res.sendFile(path.join(opts.staticDir!, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 4: Implementar rotas**

`backend/src/routes/pontos.ts`:
```ts
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
```

`backend/src/routes/fornecedores.ts`:
```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { AppError, idDe } from '../errors';

const schema = z.object({ nome: z.string().trim().min(1, 'Obrigatório') });

interface Linha {
  id: number;
  nome: string;
}

function buscar(db: Database.Database, id: number): Linha {
  const r = db.prepare('SELECT id, nome FROM fornecedor WHERE id = ?').get(id) as Linha | undefined;
  if (!r) throw new AppError(404, 'Fornecedor não encontrado');
  return r;
}

export function fornecedoresRouter(db: Database.Database) {
  const r = Router();

  r.get('/', (_req, res) => {
    res.json(db.prepare('SELECT id, nome FROM fornecedor ORDER BY id').all());
  });

  r.post('/', (req, res) => {
    const { nome } = schema.parse(req.body);
    const info = db.prepare('INSERT INTO fornecedor (nome) VALUES (?)').run(nome);
    res.status(201).json(buscar(db, Number(info.lastInsertRowid)));
  });

  r.put('/:id', (req, res) => {
    const id = idDe(req.params.id);
    buscar(db, id);
    const { nome } = schema.parse(req.body);
    db.prepare('UPDATE fornecedor SET nome = ? WHERE id = ?').run(nome, id);
    res.json(buscar(db, id));
  });

  r.delete('/:id', (req, res) => {
    const id = idDe(req.params.id);
    buscar(db, id);
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM lancamento_valor WHERE fornecedor_id = ?').get(id) as { n: number };
    if (n > 0) throw new AppError(409, 'Este fornecedor possui lançamentos e não pode ser excluído.');
    db.prepare('DELETE FROM fornecedor WHERE id = ?').run(id);
    res.status(204).end();
  });

  return r;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -w backend`
Expected: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add backend && git commit -m "feat: app Express, tratamento de erros e CRUD de pontos e fornecedores"
```

---

### Task 4: Lançamentos (gravação, tabela e totais)

**Files:**
- Create: `backend/src/schemas.ts`, `backend/src/services/gravar.ts`, `backend/src/services/tabela.ts`, `backend/src/routes/lancamentos.ts`
- Modify: `backend/src/app.ts` (registrar `/api/lancamentos`)
- Test: `backend/tests/lancamentos.test.ts`

**Interfaces:**
- Consumes: `Celula`, `somar` (Task 2); `AppError` (Task 3); helpers de teste (Task 3).
- Produces:
  - `consultaSchema` (Zod): `{ ano: number(2000–2100), tipo: 'energia'|'agua' }`
  - `type Resultado = 'criado'|'atualizado'|'removido'|'nada'`
  - `gravarValor(db, { pontoId, ano, mes, fornecedorId: number|null, valorRs: number|null }): Resultado`
  - `gravarConsumo(db, { pontoId, ano, mes, quantidade: number|null }): Resultado`
  - `type Tipo = 'energia'|'agua'`
  - `interface LinhaTabela { pontoId:number; nome:string; ativo:boolean; valores:{fornecedorId:number|null; meses:Celula[]}[]; consumo:Celula[]; totalValor:Celula[] }`
  - `interface Tabela { ano:number; tipo:Tipo; fornecedores:{id:number;nome:string}[]; linhas:LinhaTabela[]; totalGeralValor:Celula[]; totalGeralConsumo:Celula[] }` (todos os arrays têm 12 posições)
  - `montarTabela(db, ano, tipo): Tabela`
  - `GET /api/lancamentos?ano=&tipo=` → `Tabela`; `PUT /api/lancamentos/valor` e `PUT /api/lancamentos/consumo` → 204.

- [ ] **Step 1: Testes que falham**

`backend/tests/lancamentos.test.ts`:
```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w backend -- lancamentos`
Expected: FAIL — rotas 404 / módulos ausentes.

- [ ] **Step 3: Implementar schemas e serviços**

`backend/src/schemas.ts`:
```ts
import { z } from 'zod';

export const consultaSchema = z.object({
  ano: z.coerce.number().int().min(2000).max(2100),
  tipo: z.enum(['energia', 'agua']),
});
```

`backend/src/services/gravar.ts`:
```ts
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
```

`backend/src/services/tabela.ts`:
```ts
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
```

- [ ] **Step 4: Implementar rotas e registrar**

`backend/src/routes/lancamentos.ts`:
```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { AppError } from '../errors';
import { consultaSchema } from '../schemas';
import { gravarConsumo, gravarValor } from '../services/gravar';
import { montarTabela } from '../services/tabela';

const base = {
  pontoId: z.number().int(),
  ano: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
};
const valorSchema = z.object({
  ...base,
  fornecedorId: z.number().int().nullable(),
  valorRs: z.number().min(0, 'Não pode ser negativo').max(1e9).nullable(),
});
const consumoSchema = z.object({
  ...base,
  quantidade: z.number().min(0, 'Não pode ser negativo').max(1e9).nullable(),
});

function tipoDoPonto(db: Database.Database, id: number): 'energia' | 'agua' {
  const p = db.prepare('SELECT tipo FROM ponto WHERE id = ?').get(id) as { tipo: 'energia' | 'agua' } | undefined;
  if (!p) throw new AppError(404, 'Ponto não encontrado');
  return p.tipo;
}

export function lancamentosRouter(db: Database.Database) {
  const r = Router();

  r.get('/', (req, res) => {
    const { ano, tipo } = consultaSchema.parse(req.query);
    res.json(montarTabela(db, ano, tipo));
  });

  r.put('/valor', (req, res) => {
    const d = valorSchema.parse(req.body);
    const tipo = tipoDoPonto(db, d.pontoId);
    if (tipo === 'energia' && d.fornecedorId === null) {
      throw new AppError(400, 'Dados inválidos', { fornecedorId: 'Informe o fornecedor para lançamentos de energia' });
    }
    if (tipo === 'agua' && d.fornecedorId !== null) {
      throw new AppError(400, 'Dados inválidos', { fornecedorId: 'Lançamentos de água não têm fornecedor' });
    }
    if (d.fornecedorId !== null) {
      const f = db.prepare('SELECT id FROM fornecedor WHERE id = ?').get(d.fornecedorId);
      if (!f) throw new AppError(404, 'Fornecedor não encontrado');
    }
    gravarValor(db, d);
    res.status(204).end();
  });

  r.put('/consumo', (req, res) => {
    const d = consumoSchema.parse(req.body);
    tipoDoPonto(db, d.pontoId);
    gravarConsumo(db, d);
    res.status(204).end();
  });

  return r;
}
```

Em `backend/src/app.ts`, adicionar o import `import { lancamentosRouter } from './routes/lancamentos';` e, junto às outras rotas (antes do 404 de `/api`):
```ts
  app.use('/api/lancamentos', lancamentosRouter(db));
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -w backend`
Expected: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add backend && git commit -m "feat: lancamentos de valor e consumo com tabela e totais calculados"
```

---

### Task 5: Dashboard

**Files:**
- Create: `backend/src/services/dashboard.ts`, `backend/src/routes/dashboard.ts`
- Modify: `backend/src/app.ts` (registrar `/api/dashboard`)
- Test: `backend/tests/dashboard.test.ts`

**Interfaces:**
- Consumes: `Tabela`, `montarTabela` (Task 4); `somar`, `media`, `custoMedio`, `arredondar`, `Celula` (Task 2); `consultaSchema` (Task 4).
- Produces:
```ts
interface Dashboard {
  ano: number; tipo: Tipo;
  mensal: { mes: number; valor: Celula; consumo: Celula; custoMedio: Celula }[];   // 12 itens
  totalAnualValor: Celula; mediaMensalValor: Celula; totalAnualConsumo: Celula;
  ultimoMes: { mes: number; valor: number; variacaoPct: Celula } | null;
  porPonto: { pontoId: number; nome: string; totalValor: Celula; totalConsumo: Celula }[];
}
resumir(t: Tabela): Dashboard
GET /api/dashboard?ano=&tipo=  -> Dashboard
```

- [ ] **Step 1: Testes que falham**

`backend/tests/dashboard.test.ts`:
```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -w backend -- dashboard`
Expected: FAIL — módulos ausentes.

- [ ] **Step 3: Implementar**

`backend/src/services/dashboard.ts`:
```ts
import { arredondar, custoMedio, media, somar, type Celula } from '../calc';
import type { Tabela, Tipo } from './tabela';

export interface Dashboard {
  ano: number;
  tipo: Tipo;
  mensal: { mes: number; valor: Celula; consumo: Celula; custoMedio: Celula }[];
  totalAnualValor: Celula;
  mediaMensalValor: Celula;
  totalAnualConsumo: Celula;
  ultimoMes: { mes: number; valor: number; variacaoPct: Celula } | null;
  porPonto: { pontoId: number; nome: string; totalValor: Celula; totalConsumo: Celula }[];
}

export function resumir(t: Tabela): Dashboard {
  const mensal = t.totalGeralValor.map((valor, i) => ({
    mes: i + 1,
    valor,
    consumo: t.totalGeralConsumo[i],
    custoMedio: custoMedio(valor, t.totalGeralConsumo[i]),
  }));

  let ultimoMes: Dashboard['ultimoMes'] = null;
  for (let i = t.totalGeralValor.length - 1; i >= 0; i--) {
    const valor = t.totalGeralValor[i];
    if (valor === null) continue;
    const anterior = i > 0 ? t.totalGeralValor[i - 1] : null;
    ultimoMes = {
      mes: i + 1,
      valor,
      variacaoPct: anterior !== null && anterior !== 0 ? arredondar(((valor - anterior) / anterior) * 100) : null,
    };
    break;
  }

  return {
    ano: t.ano,
    tipo: t.tipo,
    mensal,
    totalAnualValor: somar(t.totalGeralValor),
    mediaMensalValor: media(t.totalGeralValor),
    totalAnualConsumo: somar(t.totalGeralConsumo),
    ultimoMes,
    porPonto: t.linhas.map((l) => ({
      pontoId: l.pontoId,
      nome: l.nome,
      totalValor: somar(l.totalValor),
      totalConsumo: somar(l.consumo),
    })),
  };
}
```

`backend/src/routes/dashboard.ts`:
```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { consultaSchema } from '../schemas';
import { resumir } from '../services/dashboard';
import { montarTabela } from '../services/tabela';

export function dashboardRouter(db: Database.Database) {
  const r = Router();
  r.get('/', (req, res) => {
    const { ano, tipo } = consultaSchema.parse(req.query);
    res.json(resumir(montarTabela(db, ano, tipo)));
  });
  return r;
}
```

Em `backend/src/app.ts`: `import { dashboardRouter } from './routes/dashboard';` e `app.use('/api/dashboard', dashboardRouter(db));` junto às outras rotas.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -w backend`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add backend && git commit -m "feat: endpoint de dashboard com totais, media e variacao"
```

---

### Task 6: Servidor, arquivos estáticos e backup

**Files:**
- Create: `backend/src/index.ts`, `backend/scripts/backup.ts`
- Test: `backend/tests/static.test.ts`

**Interfaces:**
- Consumes: `createApp(db, { staticDir })` (Task 3), `openDb` (Task 1).
- Produces: `npm start -w backend` (serve API + `frontend/dist`), `npm run backup` (cria `backend/backups/dados-AAAA-MM-DD.sqlite`).

- [ ] **Step 1: Teste que falha**

`backend/tests/static.test.ts`:
```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { openDb } from '../src/db';

describe('arquivos estáticos', () => {
  it('serve o index.html do front e mantém /api em JSON', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<html>painel</html>');
    const app = createApp(openDb(':memory:'), { staticDir: dir });
    const home = await request(app).get('/');
    expect(home.status).toBe(200);
    expect(home.text).toContain('painel');
    const rota = await request(app).get('/qualquer/rota');
    expect(rota.text).toContain('painel');
    const api = await request(app).get('/api/nada');
    expect(api.status).toBe(404);
    expect(api.body.erro).toBeTruthy();
  });

  it('ignora staticDir inexistente', async () => {
    const app = createApp(openDb(':memory:'), { staticDir: path.join(os.tmpdir(), 'nao-existe-xyz') });
    expect((await request(app).get('/')).status).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar**

Run: `npm test -w backend -- static`
Expected: PASS já com o `createApp` da Task 3 (o teste fixa o comportamento). Se falhar, corrigir `app.ts`.

- [ ] **Step 3: Implementar servidor e backup**

`backend/src/index.ts`:
```ts
import path from 'node:path';
import { createApp } from './app';
import { openDb } from './db';

const porta = Number(process.env.PORT ?? 3000);
const arquivo = process.env.DB_PATH ?? path.resolve(__dirname, '..', 'dados.sqlite');

const db = openDb(arquivo);
const app = createApp(db, { staticDir: path.resolve(__dirname, '../../frontend/dist') });

app.listen(porta, '0.0.0.0', () => {
  console.log(`Painel Energia e Água em http://localhost:${porta} (banco: ${arquivo})`);
});
```

`backend/scripts/backup.ts`:
```ts
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const origem = process.env.DB_PATH ?? path.resolve(__dirname, '..', 'dados.sqlite');
const pasta = path.resolve(__dirname, '..', 'backups');
fs.mkdirSync(pasta, { recursive: true });
const destino = path.join(pasta, `dados-${new Date().toISOString().slice(0, 10)}.sqlite`);

const db = new Database(origem, { fileMustExist: true });
db.backup(destino).then(() => {
  console.log('Backup criado em', destino);
  db.close();
});
```

- [ ] **Step 4: Verificação manual**

Run (terminal 1): `npm run dev -w backend`
Run (terminal 2): `curl -X POST http://localhost:3000/api/pontos -H "Content-Type: application/json" -d "{\"nome\":\"TESTE\",\"tipo\":\"agua\"}"` e depois `curl http://localhost:3000/api/pontos`
Expected: 201 com o ponto criado; a listagem mostra `TESTE`. Parar o servidor e rodar `npm run backup`; Expected: "Backup criado em ...backups\dados-<data>.sqlite". Apagar `backend/dados.sqlite` e `backend/backups/` ao terminar (dados de teste).

- [ ] **Step 5: Commit**

```bash
git add backend && git commit -m "feat: servidor com estaticos do front e script de backup"
```

---

### Task 7: Importação da planilha

**Files:**
- Create: `backend/src/importar/lerPlanilha.ts`, `backend/src/importar/gravarDados.ts`, `backend/src/importar/cli.ts`
- Test: `backend/tests/importar.test.ts`

**Interfaces:**
- Consumes: `gravarValor`, `gravarConsumo` (Task 4); `openDb` (Task 1).
- Produces:
```ts
export interface DadosImportados {
  pontos: { nome: string; tipo: 'energia' | 'agua' }[];
  fornecedores: string[];
  valores: { ponto: string; tipo: 'energia' | 'agua'; mes: number; fornecedor: string | null; valorRs: number }[];
  consumos: { ponto: string; tipo: 'energia' | 'agua'; mes: number; quantidade: number }[];
  medidores: { matricula: string; hidrometro: string; localizacao: string }[];
  avisos: string[];
}
norm(s: unknown): string                        // sem acento, trim, maiúsculas
numero(v: unknown): number | null               // aceita number e texto pt-BR
lerPlanilha(wb: ExcelJS.Workbook, opts: { abaEnergia: string; abaAgua: string }): DadosImportados
gravarDados(db, ano: number, dados: DadosImportados): ResumoImportacao
CLI: npm run importar -- <arquivo.xlsx> [--ano 2026] [--aba-energia "ENERGIA 2026- LIVRE"] [--aba-agua "ÁGUA 2026"]
```
- Layout reconhecido (derivado dos prints): **Energia** — título do mês (JANEIRO…DEZEMBRO) numa célula (possivelmente mesclada); a linha logo abaixo tem os nomes dos fornecedores e depois `TOTAL` e `CONSUMO`; a coluna à esquerda do título tem os nomes das unidades; as linhas terminam em `TOTAL`. **Água** — título `CONSUMO (M³)` ou `VALOR`, linha seguinte com `LOCAL DE ABASTECIMENTO` + meses abreviados (JAN, FEV, …, JULHO, AGOS …; só as 3 primeiras letras contam), linhas até `TOTAL` ou linha em branco; tabela `MATRICULA | HIDROMETRO | LOCALIZAÇÃO` separada.

- [ ] **Step 1: Inspecionar a planilha real antes de codar**

Criar um script descartável no scratchpad (não entra no projeto) que imprime, para cada aba, as células não vazias das primeiras 40 linhas (`ws.eachRow` + `cell.address` + `cell.value`), e rodar com `npx tsx` a partir de `backend/`:

```ts
import ExcelJS from 'exceljs';
(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(process.argv[2]);
  for (const ws of wb.worksheets) {
    console.log('=== ABA:', JSON.stringify(ws.name), ws.rowCount, 'x', ws.columnCount);
    ws.eachRow((row, r) => {
      if (r > 40) return;
      row.eachCell((cell, c) => console.log(cell.address, JSON.stringify(cell.value)));
    });
  }
})();
```
Expected: lista as abas e confirma o layout descrito acima. Se o arquivo der "Acesso negado" (aberto no Excel ou em Exibição Protegida), copiar para outra pasta e tentar de novo. **Se o layout real diferir da descrição** (título do mês em outra posição, abreviações diferentes, valores como texto, nomes de fornecedor divergentes entre blocos), ajustar `lerPlanilha.ts` e os fixtures do teste ao layout real antes de seguir.

- [ ] **Step 2: Testes que falham**

`backend/tests/importar.test.ts`:
```ts
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { gravarDados } from '../src/importar/gravarDados';
import { lerPlanilha, norm, numero } from '../src/importar/lerPlanilha';
import { openDb } from '../src/db';

function planilha(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();

  const e = wb.addWorksheet('ENERGIA 2026- LIVRE');
  const bloco = (linha: number, mes: string, dados: [string, number, number | string, number][]) => {
    e.getCell(linha, 2).value = mes;
    e.mergeCells(linha, 2, linha, 3); // título mesclado B:C
    e.getCell(linha, 4).value = 'TOTAL';
    e.mergeCells(linha, 4, linha + 1, 4);
    e.getCell(linha, 5).value = 'CONSUMO';
    e.mergeCells(linha, 5, linha + 1, 5);
    e.getCell(linha + 1, 2).value = 'EQUATORIAL';
    e.getCell(linha + 1, 3).value = 'RENOVAVEIS';
    dados.forEach(([nome, v1, v2, cons], i) => {
      const r = linha + 2 + i;
      e.getCell(r, 1).value = nome;
      e.getCell(r, 2).value = v1;
      e.getCell(r, 3).value = v2;
      e.getCell(r, 4).value = { formula: 'SUM(B:C)', result: 999 }; // total da planilha é ignorado
      e.getCell(r, 5).value = cons;
    });
    e.getCell(linha + 2 + dados.length, 1).value = 'TOTAL';
    e.getCell(linha + 3 + dados.length, 1).value = 'KWH';
  };
  bloco(2, 'MAIO', [
    ['AREOLINO DE ABREU', 10906.52, 4265.21, 19.62],
    ['BENTO LEÃO 25', 10784.49, 'R$ 4.623,81', 17.54],
  ]);
  bloco(12, 'JUNHO', [['AREOLINO DE ABREU', 11664.61, 4414.85, 19.8]]);

  const a = wb.addWorksheet('ÁGUA 2026');
  a.getCell('A1').value = 'CONSUMO (M³)';
  a.mergeCells('A1:D1');
  ['LOCAL DE ABASTECIMENTO', 'JAN', 'FEV', 'AGOS'].forEach((t, i) => (a.getCell(2, i + 1).value = t));
  a.getCell('A3').value = 'PRODUÇÃO/STA';
  a.getCell('B3').value = 276;
  a.getCell('D3').value = 345;
  a.getCell('A4').value = 'ADM/CQ';
  a.getCell('B4').value = 56;
  a.getCell('C4').value = 46;
  a.getCell('A7').value = 'VALOR';
  a.mergeCells('A7:D7');
  ['LOCAL DE ABASTECIMENTO', 'JAN', 'FEV', 'AGOS'].forEach((t, i) => (a.getCell(8, i + 1).value = t));
  a.getCell('A9').value = 'PRODUÇÃO/STA';
  a.getCell('B9').value = 5885.3;
  a.getCell('A10').value = 'ADM/CQ';
  a.getCell('B10').value = 1096.59;
  a.getCell('A11').value = 'TOTAL';
  a.getCell('B11').value = 6981.89;
  ['MATRICULA', 'HIDROMETRO', 'LOCALIZAÇÃO'].forEach((t, i) => (a.getCell(13, i + 1).value = t));
  ['227378497-4', 'A22FA0234889', '01-600-10-500-0155'].forEach((t, i) => (a.getCell(14, i + 1).value = t));
  return wb;
}

const opts = { abaEnergia: 'ENERGIA 2026- LIVRE', abaAgua: 'ÁGUA 2026' };

describe('norm e numero', () => {
  it('normaliza acentos, espaços e caixa', () => expect(norm('  Localização ')).toBe('LOCALIZACAO'));
  it('lê números pt-BR e números nativos', () => {
    expect(numero(12.5)).toBe(12.5);
    expect(numero('R$ 1.234,56')).toBe(1234.56);
    expect(numero('10577,1')).toBe(10577.1);
    expect(numero('')).toBeNull();
    expect(numero('-')).toBeNull();
    expect(numero('abc')).toBeNull();
    expect(numero(null)).toBeNull();
  });
});

describe('lerPlanilha', () => {
  const dados = lerPlanilha(planilha(), opts);

  it('lê energia: fornecedores, valores e consumo por mês', () => {
    expect(dados.fornecedores.sort()).toEqual(['EQUATORIAL', 'RENOVAVEIS']);
    const v = dados.valores.filter((x) => x.tipo === 'energia');
    expect(v).toContainEqual({ ponto: 'AREOLINO DE ABREU', tipo: 'energia', mes: 5, fornecedor: 'EQUATORIAL', valorRs: 10906.52 });
    expect(v).toContainEqual({ ponto: 'BENTO LEÃO 25', tipo: 'energia', mes: 5, fornecedor: 'RENOVAVEIS', valorRs: 4623.81 });
    expect(v).toContainEqual({ ponto: 'AREOLINO DE ABREU', tipo: 'energia', mes: 6, fornecedor: 'EQUATORIAL', valorRs: 11664.61 });
    expect(dados.consumos).toContainEqual({ ponto: 'BENTO LEÃO 25', tipo: 'energia', mes: 5, quantidade: 17.54 });
  });

  it('ignora a linha TOTAL e o total calculado da planilha', () => {
    expect(dados.pontos.map((p) => p.nome)).not.toContain('TOTAL');
    expect(dados.valores.some((x) => x.valorRs === 999)).toBe(false);
  });

  it('lê água: consumo e valor por local e mês (JULHO/AGOS pelas 3 primeiras letras)', () => {
    expect(dados.consumos).toContainEqual({ ponto: 'PRODUÇÃO/STA', tipo: 'agua', mes: 1, quantidade: 276 });
    expect(dados.consumos).toContainEqual({ ponto: 'PRODUÇÃO/STA', tipo: 'agua', mes: 8, quantidade: 345 });
    expect(dados.consumos).toContainEqual({ ponto: 'ADM/CQ', tipo: 'agua', mes: 2, quantidade: 46 });
    expect(dados.valores).toContainEqual({ ponto: 'ADM/CQ', tipo: 'agua', mes: 1, fornecedor: null, valorRs: 1096.59 });
    expect(dados.pontos.filter((p) => p.tipo === 'agua').map((p) => p.nome).sort()).toEqual(['ADM/CQ', 'PRODUÇÃO/STA']);
  });

  it('lê a tabela de medidores', () => {
    expect(dados.medidores).toEqual([{ matricula: '227378497-4', hidrometro: 'A22FA0234889', localizacao: '01-600-10-500-0155' }]);
  });

  it('falha com mensagem útil quando a aba não existe', () => {
    expect(() => lerPlanilha(planilha(), { ...opts, abaAgua: 'NAO EXISTE' })).toThrow(/Abas disponíveis/);
  });
});

describe('gravarDados', () => {
  it('é idempotente: importar duas vezes não duplica nem muda totais', () => {
    const db = openDb(':memory:');
    const dados = lerPlanilha(planilha(), opts);
    const r1 = gravarDados(db, 2026, dados);
    const contar = () => ({
      v: (db.prepare('SELECT COUNT(*) AS n FROM lancamento_valor').get() as { n: number }).n,
      c: (db.prepare('SELECT COUNT(*) AS n FROM lancamento_consumo').get() as { n: number }).n,
      p: (db.prepare('SELECT COUNT(*) AS n FROM ponto').get() as { n: number }).n,
      f: (db.prepare('SELECT COUNT(*) AS n FROM fornecedor').get() as { n: number }).n,
    });
    const antes = contar();
    expect(r1.valoresCriados).toBe(antes.v);
    const r2 = gravarDados(db, 2026, dados);
    expect(contar()).toEqual(antes);
    expect(r2.valoresCriados).toBe(0);
    expect(r2.valoresAtualizados).toBe(antes.v);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -w backend -- importar`
Expected: FAIL — módulos ausentes.

- [ ] **Step 4: Implementar o leitor**

`backend/src/importar/lerPlanilha.ts`:
```ts
import type { Cell, Workbook, Worksheet } from 'exceljs';

export interface DadosImportados {
  pontos: { nome: string; tipo: 'energia' | 'agua' }[];
  fornecedores: string[];
  valores: { ponto: string; tipo: 'energia' | 'agua'; mes: number; fornecedor: string | null; valorRs: number }[];
  consumos: { ponto: string; tipo: 'energia' | 'agua'; mes: number; quantidade: number }[];
  medidores: { matricula: string; hidrometro: string; localizacao: string }[];
  avisos: string[];
}

const MESES_COMPLETOS = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
const MESES_ABREV = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

export const norm = (s: unknown): string =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

function bruto(cell: Cell): unknown {
  const v = cell.value as unknown;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('result' in o) return o.result;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join('');
    if ('text' in o) return o.text;
  }
  return v;
}

const texto = (cell: Cell): string => String(bruto(cell) ?? '').replace(/\s+/g, ' ').trim();

export function numero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const limpo = v.replace(/R\$/g, '').replace(/\s/g, '');
  if (limpo === '' || limpo === '-') return null;
  const n = limpo.includes(',') ? Number(limpo.replace(/\./g, '').replace(',', '.')) : Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function celulasComTexto(ws: Worksheet, filtro: (t: string) => boolean): { linha: number; col: number; cell: Cell }[] {
  const achadas: { linha: number; col: number; cell: Cell }[] = [];
  ws.eachRow((row, linha) =>
    row.eachCell((cell, col) => {
      if (cell.isMerged && cell.master.address !== cell.address) return; // só a célula-mestre
      if (filtro(norm(bruto(cell)))) achadas.push({ linha, col, cell });
    }),
  );
  return achadas;
}

function lerEnergia(ws: Worksheet, d: DadosImportados): void {
  const ancoras = celulasComTexto(ws, (t) => MESES_COMPLETOS.includes(t));
  for (const a of ancoras) {
    const mes = MESES_COMPLETOS.indexOf(norm(bruto(a.cell))) + 1;
    const cab = a.linha + 1;
    let colTotal = -1;
    for (const l of [cab, a.linha]) {
      for (let c = a.col; c <= a.col + 20 && colTotal < 0; c++) if (norm(texto(ws.getCell(l, c))) === 'TOTAL') colTotal = c;
      if (colTotal > 0) break;
    }
    if (colTotal < 0) {
      d.avisos.push(`Energia: bloco "${norm(bruto(a.cell))}" em ${a.cell.address} sem coluna TOTAL; ignorado.`);
      continue;
    }
    const colConsumo = colTotal + 1;
    const temConsumo = norm(texto(ws.getCell(cab, colConsumo))) === 'CONSUMO' || norm(texto(ws.getCell(a.linha, colConsumo))) === 'CONSUMO';
    if (!temConsumo) d.avisos.push(`Energia: bloco em ${a.cell.address} sem coluna CONSUMO.`);

    const fornecedoresCol: { col: number; nome: string }[] = [];
    for (let c = a.col; c < colTotal; c++) {
      const nome = texto(ws.getCell(cab, c));
      if (nome) fornecedoresCol.push({ col: c, nome });
    }
    fornecedoresCol.forEach((f) => !d.fornecedores.includes(f.nome) && d.fornecedores.push(f.nome));

    for (let r = cab + 1; r <= cab + 60; r++) {
      const nome = texto(ws.getCell(r, a.col - 1));
      if (!nome || norm(nome) === 'TOTAL') break;
      if (!d.pontos.some((p) => p.nome === nome && p.tipo === 'energia')) d.pontos.push({ nome, tipo: 'energia' });
      for (const f of fornecedoresCol) {
        const v = numero(bruto(ws.getCell(r, f.col)));
        if (v !== null) d.valores.push({ ponto: nome, tipo: 'energia', mes, fornecedor: f.nome, valorRs: v });
      }
      if (temConsumo) {
        const q = numero(bruto(ws.getCell(r, colConsumo)));
        if (q !== null) d.consumos.push({ ponto: nome, tipo: 'energia', mes, quantidade: q });
      }
    }
  }
}

function lerAgua(ws: Worksheet, d: DadosImportados): void {
  for (const h of celulasComTexto(ws, (t) => t === 'LOCAL DE ABASTECIMENTO')) {
    let titulo = '';
    ws.getRow(h.linha - 1).eachCell((cell) => (titulo += ' ' + norm(bruto(cell))));
    const secao = titulo.includes('CONSUMO') ? 'consumo' : titulo.includes('VALOR') ? 'valor' : null;
    if (!secao) {
      d.avisos.push(`Água: tabela em ${h.cell.address} sem título CONSUMO/VALOR; ignorada.`);
      continue;
    }
    const colunas: { col: number; mes: number }[] = [];
    ws.getRow(h.linha).eachCell((cell, col) => {
      if (col <= h.col) return;
      const i = MESES_ABREV.indexOf(norm(bruto(cell)).slice(0, 3));
      if (i >= 0) colunas.push({ col, mes: i + 1 });
    });
    for (let r = h.linha + 1; r <= h.linha + 60; r++) {
      const nome = texto(ws.getCell(r, h.col));
      if (!nome || norm(nome) === 'TOTAL') break;
      if (!d.pontos.some((p) => p.nome === nome && p.tipo === 'agua')) d.pontos.push({ nome, tipo: 'agua' });
      for (const c of colunas) {
        const v = numero(bruto(ws.getCell(r, c.col)));
        if (v === null) continue;
        if (secao === 'consumo') d.consumos.push({ ponto: nome, tipo: 'agua', mes: c.mes, quantidade: v });
        else d.valores.push({ ponto: nome, tipo: 'agua', mes: c.mes, fornecedor: null, valorRs: v });
      }
    }
  }

  for (const m of celulasComTexto(ws, (t) => t === 'MATRICULA')) {
    if (norm(texto(ws.getCell(m.linha, m.col + 1))) !== 'HIDROMETRO') continue;
    for (let r = m.linha + 1; r <= m.linha + 60; r++) {
      const matricula = texto(ws.getCell(r, m.col));
      if (!matricula) break;
      d.medidores.push({
        matricula,
        hidrometro: texto(ws.getCell(r, m.col + 1)),
        localizacao: texto(ws.getCell(r, m.col + 2)),
      });
    }
  }
}

function aba(wb: Workbook, nome: string): Worksheet {
  const ws = wb.worksheets.find((w) => norm(w.name) === norm(nome));
  if (!ws) throw new Error(`Aba "${nome}" não encontrada. Abas disponíveis: ${wb.worksheets.map((w) => `"${w.name}"`).join(', ')}`);
  return ws;
}

export function lerPlanilha(wb: Workbook, opts: { abaEnergia: string; abaAgua: string }): DadosImportados {
  const d: DadosImportados = { pontos: [], fornecedores: [], valores: [], consumos: [], medidores: [], avisos: [] };
  lerEnergia(aba(wb, opts.abaEnergia), d);
  lerAgua(aba(wb, opts.abaAgua), d);
  return d;
}
```

- [ ] **Step 5: Implementar gravação e CLI**

`backend/src/importar/gravarDados.ts`:
```ts
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
    for (const p of dados.pontos) pontoId(p.nome, p.tipo);
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
```

`backend/src/importar/cli.ts`:
```ts
import path from 'node:path';
import ExcelJS from 'exceljs';
import { openDb } from '../db';
import { gravarDados } from './gravarDados';
import { lerPlanilha } from './lerPlanilha';

function opcao(nome: string, padrao: string): string {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

async function main() {
  const arquivo = process.argv[2];
  if (!arquivo || arquivo.startsWith('--')) {
    console.error('Uso: npm run importar -- <arquivo.xlsx> [--ano 2026] [--aba-energia "ENERGIA 2026- LIVRE"] [--aba-agua "ÁGUA 2026"]');
    process.exit(1);
  }
  const ano = Number(opcao('ano', '2026'));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arquivo);
  const dados = lerPlanilha(wb, {
    abaEnergia: opcao('aba-energia', 'ENERGIA 2026- LIVRE'),
    abaAgua: opcao('aba-agua', 'ÁGUA 2026'),
  });

  const db = openDb(process.env.DB_PATH ?? path.resolve(__dirname, '..', '..', 'dados.sqlite'));
  const resumo = gravarDados(db, ano, dados);

  console.log('Importação concluída:', resumo);
  console.log('Fornecedores encontrados:', dados.fornecedores);
  console.log('Pontos encontrados:', dados.pontos.map((p) => `${p.tipo}:${p.nome}`));
  if (dados.medidores.length) {
    console.log('Medidores de água encontrados (associe-os aos pontos na tela Cadastros):');
    console.table(dados.medidores);
  }
  if (dados.avisos.length) console.warn('Avisos:\n- ' + dados.avisos.join('\n- '));
}

main().catch((e) => {
  console.error('Falha na importação:', e instanceof Error ? e.message : e);
  process.exit(1);
});
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm test -w backend`
Expected: todos PASS.

- [ ] **Step 7: Importar a planilha real e conferir**

Run: `npm run importar -- "..\ENERGIA E ÁGUA 2026.xlsx"` (ajustar o caminho; a partir da raiz).
Expected: resumo com pontos, fornecedores e valores criados; lista de fornecedores/pontos. Conferir contra a planilha: **atenção a nomes de fornecedor divergentes entre meses** (ex.: "EQUTORIAL RENOVAVEIS…" com erro de digitação num bloco e "EQUATORIAL RENOVAVEIS…" em outro virariam dois fornecedores; se aparecer, corrigir a planilha de origem ou renomear/mesclar antes de seguir). Apagar `backend/dados.sqlite` e reimportar se precisar recomeçar. Rodar o importador uma segunda vez e confirmar `valoresCriados: 0`.

- [ ] **Step 8: Commit**

```bash
git add backend && git commit -m "feat: importacao da planilha de 2026 (energia e agua), idempotente"
```

---

### Task 8: Scaffold do frontend, formatação e célula editável

**Files:**
- Modify: `package.json` (workspaces + scripts)
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/tailwind.config.cjs`, `frontend/postcss.config.cjs`, `frontend/src/main.tsx`, `frontend/src/index.css`
- Create: `frontend/src/types.ts`, `frontend/src/api.ts`, `frontend/src/format.ts`, `frontend/src/components/CelulaEditavel.tsx`
- Test: `frontend/src/format.test.ts`, `frontend/src/components/CelulaEditavel.test.tsx`

**Interfaces:**
- Consumes: API do backend (Tasks 3–5).
- Produces:
  - `parseNumeroBR(texto: string): number | null | 'invalido'`; `formatInput(n: number|null): string`; `formatBRL(n: number|null): string` (`'—'` se null); `formatNumero(n: number|null): string`; `MESES_ABREV: string[]`; `UNIDADE_ENERGIA = 'MWh'`.
  - `<CelulaEditavel valor rotulo onSalvar />` com `onSalvar: (v: number|null) => Promise<void>`.
  - `api` (objeto): `pontos.listar(tipo?)`, `pontos.criar(d)`, `pontos.atualizar(id, d)`, `pontos.excluir(id)`, `fornecedores.listar/criar/atualizar/excluir`, `tabela(ano, tipo)`, `salvarValor(d)`, `salvarConsumo(d)`, `dashboard(ano, tipo)`.
  - Tipos (`types.ts`): `Tipo`, `Celula`, `Ponto`, `Fornecedor`, `LinhaTabela`, `Tabela`, `Dashboard` (espelham o backend).

- [ ] **Step 1: Configurar workspace e instalar**

Em `package.json` (raiz) trocar `"workspaces": ["backend"]` por `"workspaces": ["backend", "frontend"]` e `"test"` por `"npm test -w backend && npm test -w frontend"`.

`frontend/package.json`:
```json
{
  "name": "frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

Run:
```
npm install -w frontend react@18 react-dom@18 recharts@2
npm install -w frontend -D vite @vitejs/plugin-react typescript vitest jsdom @testing-library/react@16 @testing-library/dom @testing-library/user-event @types/react@18 @types/react-dom@18 tailwindcss@3 postcss autoprefixer
```

`frontend/vite.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
  test: { environment: 'jsdom', globals: true },
});
```

`frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`frontend/index.html`:
```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Painel Energia e Água</title>
  </head>
  <body class="bg-slate-50 text-slate-900">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/tailwind.config.cjs`:
```js
module.exports = { content: ['./index.html', './src/**/*.{ts,tsx}'], theme: { extend: {} }, plugins: [] };
```

`frontend/postcss.config.cjs`:
```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

`frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`frontend/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

(`App.tsx` é criado na Task 11; até lá `npm run build -w frontend` não é executado.)

- [ ] **Step 2: Testes que falham**

`frontend/src/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatBRL, formatInput, formatNumero, parseNumeroBR } from './format';

describe('parseNumeroBR', () => {
  it('lê formatos pt-BR', () => {
    expect(parseNumeroBR('1.234,56')).toBe(1234.56);
    expect(parseNumeroBR('R$ 1.234,56')).toBe(1234.56);
    expect(parseNumeroBR('10577,1')).toBe(10577.1);
    expect(parseNumeroBR('943,37')).toBe(943.37);
  });
  it('trata ponto sem vírgula', () => {
    expect(parseNumeroBR('1.234')).toBe(1234);
    expect(parseNumeroBR('12.5')).toBe(12.5);
    expect(parseNumeroBR('276')).toBe(276);
  });
  it('vazio vira null (sem lançamento) e zero continua zero', () => {
    expect(parseNumeroBR('')).toBeNull();
    expect(parseNumeroBR('   ')).toBeNull();
    expect(parseNumeroBR('0')).toBe(0);
  });
  it('rejeita negativo e texto', () => {
    expect(parseNumeroBR('-5')).toBe('invalido');
    expect(parseNumeroBR('abc')).toBe('invalido');
    expect(parseNumeroBR('1,2,3')).toBe('invalido');
  });
});

describe('formatação', () => {
  it('formatInput usa vírgula e vazio para null', () => {
    expect(formatInput(10577.1)).toBe('10577,1');
    expect(formatInput(null)).toBe('');
    expect(formatInput(0)).toBe('0');
  });
  it('formatBRL e formatNumero mostram traço para null', () => {
    expect(formatBRL(null)).toBe('—');
    expect(formatNumero(null)).toBe('—');
    expect(formatBRL(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
    expect(formatNumero(1234.5)).toBe('1.234,50');
  });
});
```

`frontend/src/components/CelulaEditavel.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CelulaEditavel } from './CelulaEditavel';

describe('CelulaEditavel', () => {
  it('salva o número interpretado ao sair do campo', async () => {
    const onSalvar = vi.fn().mockResolvedValue(undefined);
    render(<CelulaEditavel valor={null} rotulo="mar" onSalvar={onSalvar} />);
    const campo = screen.getByLabelText('mar');
    await userEvent.type(campo, '1.234,56');
    await userEvent.tab();
    expect(onSalvar).toHaveBeenCalledWith(1234.56);
  });

  it('esvaziar o campo salva null', async () => {
    const onSalvar = vi.fn().mockResolvedValue(undefined);
    render(<CelulaEditavel valor={10} rotulo="mar" onSalvar={onSalvar} />);
    const campo = screen.getByLabelText('mar');
    await userEvent.clear(campo);
    await userEvent.tab();
    expect(onSalvar).toHaveBeenCalledWith(null);
  });

  it('não salva quando nada mudou', async () => {
    const onSalvar = vi.fn();
    render(<CelulaEditavel valor={10.5} rotulo="mar" onSalvar={onSalvar} />);
    await userEvent.click(screen.getByLabelText('mar'));
    await userEvent.tab();
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it('entrada inválida não salva e marca erro', async () => {
    const onSalvar = vi.fn();
    render(<CelulaEditavel valor={null} rotulo="mar" onSalvar={onSalvar} />);
    const campo = screen.getByLabelText('mar');
    await userEvent.type(campo, 'abc');
    await userEvent.tab();
    expect(onSalvar).not.toHaveBeenCalled();
    expect(campo.getAttribute('aria-invalid')).toBe('true');
  });

  it('falha ao salvar marca erro e preserva o texto digitado', async () => {
    const onSalvar = vi.fn().mockRejectedValue(new Error('Não pode ser negativo'));
    render(<CelulaEditavel valor={null} rotulo="mar" onSalvar={onSalvar} />);
    const campo = screen.getByLabelText('mar') as HTMLInputElement;
    await userEvent.type(campo, '50');
    await userEvent.tab();
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.title).toBe('Não pode ser negativo');
    expect(campo.value).toBe('50');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -w frontend`
Expected: FAIL — módulos ausentes.

- [ ] **Step 4: Implementar format, tipos, api e célula**

`frontend/src/format.ts`:
```ts
export const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Unidade do consumo de energia. A confirmar com o usuário (os dados da planilha indicam MWh).
export const UNIDADE_ENERGIA = 'MWh';

export function parseNumeroBR(texto: string): number | null | 'invalido' {
  const limpo = texto.replace(/R\$/g, '').replace(/\s/g, '');
  if (limpo === '') return null;
  let normalizado: string;
  if (limpo.includes(',')) normalizado = limpo.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) normalizado = limpo.replace(/\./g, '');
  else normalizado = limpo;
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return 'invalido';
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 'invalido';
}

export const formatInput = (n: number | null): string => (n === null ? '' : String(n).replace('.', ','));

export const formatBRL = (n: number | null): string =>
  n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatNumero = (n: number | null): string =>
  n === null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
```

`frontend/src/types.ts`:
```ts
export type Tipo = 'energia' | 'agua';
export type Celula = number | null;

export interface Ponto {
  id: number;
  nome: string;
  tipo: Tipo;
  matricula: string | null;
  hidrometro: string | null;
  localizacao: string | null;
  ativo: boolean;
}
export interface Fornecedor {
  id: number;
  nome: string;
}
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
  fornecedores: Fornecedor[];
  linhas: LinhaTabela[];
  totalGeralValor: Celula[];
  totalGeralConsumo: Celula[];
}
export interface Dashboard {
  ano: number;
  tipo: Tipo;
  mensal: { mes: number; valor: Celula; consumo: Celula; custoMedio: Celula }[];
  totalAnualValor: Celula;
  mediaMensalValor: Celula;
  totalAnualConsumo: Celula;
  ultimoMes: { mes: number; valor: number; variacaoPct: Celula } | null;
  porPonto: { pontoId: number; nome: string; totalValor: Celula; totalConsumo: Celula }[];
}
```

`frontend/src/api.ts`:
```ts
import type { Dashboard, Fornecedor, Ponto, Tabela, Tipo } from './types';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (r.status === 204) return undefined as T;
  const corpo = await r.json().catch(() => null);
  if (!r.ok) {
    const campos = corpo?.campos ? ' ' + Object.values(corpo.campos).join('; ') : '';
    throw new Error((corpo?.erro ?? `Erro ${r.status}`) + (corpo?.campos ? ':' + campos : ''));
  }
  return corpo as T;
}

const json = (metodo: string, corpo: unknown): RequestInit => ({ method: metodo, body: JSON.stringify(corpo) });

export interface DadosPonto {
  nome: string;
  tipo: Tipo;
  matricula?: string | null;
  hidrometro?: string | null;
  localizacao?: string | null;
}

export const api = {
  pontos: {
    listar: (tipo?: Tipo) => req<Ponto[]>(`/api/pontos${tipo ? `?tipo=${tipo}` : ''}`),
    criar: (d: DadosPonto) => req<Ponto>('/api/pontos', json('POST', d)),
    atualizar: (id: number, d: Partial<Omit<DadosPonto, 'tipo'>> & { ativo?: boolean }) =>
      req<Ponto>(`/api/pontos/${id}`, json('PUT', d)),
    excluir: (id: number) => req<void>(`/api/pontos/${id}`, { method: 'DELETE' }),
  },
  fornecedores: {
    listar: () => req<Fornecedor[]>('/api/fornecedores'),
    criar: (nome: string) => req<Fornecedor>('/api/fornecedores', json('POST', { nome })),
    atualizar: (id: number, nome: string) => req<Fornecedor>(`/api/fornecedores/${id}`, json('PUT', { nome })),
    excluir: (id: number) => req<void>(`/api/fornecedores/${id}`, { method: 'DELETE' }),
  },
  tabela: (ano: number, tipo: Tipo) => req<Tabela>(`/api/lancamentos?ano=${ano}&tipo=${tipo}`),
  salvarValor: (d: { pontoId: number; ano: number; mes: number; fornecedorId: number | null; valorRs: number | null }) =>
    req<void>('/api/lancamentos/valor', json('PUT', d)),
  salvarConsumo: (d: { pontoId: number; ano: number; mes: number; quantidade: number | null }) =>
    req<void>('/api/lancamentos/consumo', json('PUT', d)),
  dashboard: (ano: number, tipo: Tipo) => req<Dashboard>(`/api/dashboard?ano=${ano}&tipo=${tipo}`),
};
```

`frontend/src/components/CelulaEditavel.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { formatInput, parseNumeroBR } from '../format';

interface Props {
  valor: number | null;
  rotulo: string;
  onSalvar: (valor: number | null) => Promise<void>;
}

export function CelulaEditavel({ valor, rotulo, onSalvar }: Props) {
  const [texto, setTexto] = useState(formatInput(valor));
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setTexto(formatInput(valor)), [valor]);

  async function aoSair() {
    const n = parseNumeroBR(texto);
    if (n === 'invalido') {
      setErro('Número inválido');
      return;
    }
    if (n === valor) {
      setErro(null);
      return;
    }
    try {
      await onSalvar(n);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    }
  }

  return (
    <input
      aria-label={rotulo}
      aria-invalid={erro !== null}
      title={erro ?? undefined}
      value={texto}
      inputMode="decimal"
      onChange={(e) => setTexto(e.target.value)}
      onBlur={aoSair}
      className={`w-24 rounded border px-1 py-0.5 text-right text-sm ${
        erro ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'
      }`}
    />
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -w frontend`
Expected: PASS (format + CelulaEditavel).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(frontend): scaffold, formatacao pt-BR, api client e celula editavel"
```

---

### Task 9: Tela Dashboard

**Files:**
- Create: `frontend/src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: `api.dashboard`, `formatBRL`, `formatNumero`, `MESES_ABREV`, `UNIDADE_ENERGIA`, tipos `Dashboard`, `Tipo` (Task 8).
- Produces: `export function Dashboard()` (componente sem props).

- [ ] **Step 1: Implementar**

`frontend/src/pages/Dashboard.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import { MESES_ABREV, UNIDADE_ENERGIA, formatBRL, formatNumero } from '../format';
import type { Dashboard as Dados, Tipo } from '../types';

export function Dashboard() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [tipo, setTipo] = useState<Tipo>('energia');
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api
      .dashboard(ano, tipo)
      .then((d) => ativo && (setDados(d), setErro(null)))
      .catch((e) => ativo && setErro(e instanceof Error ? e.message : 'Erro ao carregar'));
    return () => {
      ativo = false;
    };
  }, [ano, tipo]);

  const unidade = tipo === 'energia' ? UNIDADE_ENERGIA : 'm³';
  const serieMensal = dados?.mensal.map((m) => ({ mes: MESES_ABREV[m.mes - 1], valor: m.valor, consumo: m.consumo })) ?? [];
  const serieAnual = dados?.porPonto.map((p) => ({ nome: p.nome, valor: p.totalValor ?? 0 })) ?? [];
  const semDados = dados !== null && dados.totalAnualValor === null && dados.totalAnualConsumo === null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <TipoToggle tipo={tipo} onChange={setTipo} />
        <label className="text-sm">
          Ano{' '}
          <input
            type="number"
            value={ano}
            min={2000}
            max={2100}
            onChange={(e) => setAno(Number(e.target.value))}
            className="w-24 rounded border border-slate-300 px-2 py-1"
          />
        </label>
      </div>

      {erro && <p className="rounded bg-red-50 p-3 text-red-700">{erro}</p>}
      {semDados && <p className="rounded bg-amber-50 p-3 text-amber-800">Sem lançamentos para {ano}. Use a aba Lançamentos ou importe a planilha.</p>}

      {dados && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Cartao titulo="Total do ano" valor={formatBRL(dados.totalAnualValor)} detalhe={`${formatNumero(dados.totalAnualConsumo)} ${unidade}`} />
            <Cartao titulo="Média mensal" valor={formatBRL(dados.mediaMensalValor)} detalhe="meses com lançamento" />
            <Cartao
              titulo="Último mês lançado"
              valor={dados.ultimoMes ? formatBRL(dados.ultimoMes.valor) : '—'}
              detalhe={
                dados.ultimoMes
                  ? `${MESES_ABREV[dados.ultimoMes.mes - 1]}${dados.ultimoMes.variacaoPct !== null ? ` · ${dados.ultimoMes.variacaoPct > 0 ? '+' : ''}${formatNumero(dados.ultimoMes.variacaoPct)}% vs. mês anterior` : ''}`
                  : ''
              }
            />
          </div>

          <section className="rounded bg-white p-4 shadow">
            <h2 className="mb-2 font-semibold">Evolução mensal (R$)</h2>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={serieMensal}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="valor" name="Valor (R$)" stroke="#2563eb" connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded bg-white p-4 shadow">
            <h2 className="mb-2 font-semibold">Total do ano por ponto (R$)</h2>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={serieAnual}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="valor" name="Valor (R$)" fill="#0d9488" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export function TipoToggle({ tipo, onChange }: { tipo: Tipo; onChange: (t: Tipo) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-slate-300">
      {(['energia', 'agua'] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-1 text-sm ${tipo === t ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-100'}`}
        >
          {t === 'energia' ? 'Energia' : 'Água'}
        </button>
      ))}
    </div>
  );
}

function Cartao({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <div className="rounded bg-white p-4 shadow">
      <p className="text-sm text-slate-500">{titulo}</p>
      <p className="text-2xl font-semibold">{valor}</p>
      <p className="text-sm text-slate-500">{detalhe}</p>
    </div>
  );
}
```

- [ ] **Step 2: Checagem de tipos**

Run: `npx tsc --noEmit -p frontend` (a partir da raiz). Se acusar apenas "Cannot find module './App'" vindo de `main.tsx`, é esperado até a Task 11; qualquer outro erro deve ser corrigido.

- [ ] **Step 3: Commit**

```bash
git add frontend && git commit -m "feat(frontend): tela Dashboard"
```

---

### Task 10: Tela Lançamentos

**Files:**
- Create: `frontend/src/pages/Lancamentos.tsx`

**Interfaces:**
- Consumes: `api.tabela`, `api.salvarValor`, `api.salvarConsumo`, `CelulaEditavel`, `TipoToggle` (Task 9), formatadores (Task 8), tipo `Tabela`.
- Produces: `export function Lancamentos()`.

- [ ] **Step 1: Implementar**

`frontend/src/pages/Lancamentos.tsx`:
```tsx
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { CelulaEditavel } from '../components/CelulaEditavel';
import { MESES_ABREV, UNIDADE_ENERGIA, formatBRL, formatNumero } from '../format';
import type { Tabela, Tipo } from '../types';
import { TipoToggle } from './Dashboard';

export function Lancamentos() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [tipo, setTipo] = useState<Tipo>('energia');
  const [tabela, setTabela] = useState<Tabela | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setTabela(await api.tabela(ano, tipo));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
    }
  }, [ano, tipo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const unidade = tipo === 'energia' ? UNIDADE_ENERGIA : 'm³';
  const semFornecedor = tipo === 'energia' && tabela !== null && tabela.fornecedores.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <TipoToggle tipo={tipo} onChange={setTipo} />
        <label className="text-sm">
          Ano{' '}
          <input
            type="number"
            value={ano}
            min={2000}
            max={2100}
            onChange={(e) => setAno(Number(e.target.value))}
            className="w-24 rounded border border-slate-300 px-2 py-1"
          />
        </label>
      </div>

      {erro && <p className="rounded bg-red-50 p-3 text-red-700">{erro}</p>}
      {tabela && tabela.linhas.length === 0 && (
        <p className="rounded bg-amber-50 p-3 text-amber-800">Nenhum ponto de {tipo === 'energia' ? 'energia' : 'água'} cadastrado. Use a aba Cadastros.</p>
      )}
      {semFornecedor && tabela.linhas.length > 0 && (
        <p className="rounded bg-amber-50 p-3 text-amber-800">Cadastre ao menos um fornecedor na aba Cadastros para lançar valores de energia.</p>
      )}

      {tabela && tabela.linhas.length > 0 && (
        <div className="overflow-x-auto rounded bg-white shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-2 py-2 text-left">Ponto / linha</th>
                {MESES_ABREV.map((m) => (
                  <th key={m} className="px-2 py-2 text-right">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabela.linhas.map((linha) => (
                <LinhaPonto key={linha.pontoId} linha={linha} tabela={tabela} ano={ano} unidade={unidade} aoSalvar={carregar} />
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-semibold">
              <tr>
                <td className="px-2 py-2">Total geral (R$)</td>
                {tabela.totalGeralValor.map((v, i) => (
                  <td key={i} className="px-2 py-2 text-right">
                    {formatBRL(v)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-2 py-2">Consumo total ({unidade})</td>
                {tabela.totalGeralConsumo.map((v, i) => (
                  <td key={i} className="px-2 py-2 text-right">
                    {formatNumero(v)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function LinhaPonto({
  linha,
  tabela,
  ano,
  unidade,
  aoSalvar,
}: {
  linha: Tabela['linhas'][number];
  tabela: Tabela;
  ano: number;
  unidade: string;
  aoSalvar: () => Promise<void>;
}) {
  return (
    <>
      <tr className="bg-slate-50">
        <td colSpan={13} className="px-2 py-1 font-semibold">
          {linha.nome}
          {!linha.ativo && <span className="ml-2 text-xs font-normal text-slate-500">(inativo)</span>}
        </td>
      </tr>
      {linha.valores.map((v) => {
        const nome = tabela.fornecedores.find((f) => f.id === v.fornecedorId)?.nome ?? 'Valor (R$)';
        return (
          <tr key={v.fornecedorId ?? 'agua'}>
            <td className="px-2 py-1 pl-4">{nome}</td>
            {v.meses.map((valor, i) => (
              <td key={i} className="px-1 py-1 text-right">
                <CelulaEditavel
                  valor={valor}
                  rotulo={`${linha.nome} ${nome} ${MESES_ABREV[i]}`}
                  onSalvar={async (novo) => {
                    await api.salvarValor({ pontoId: linha.pontoId, ano, mes: i + 1, fornecedorId: v.fornecedorId, valorRs: novo });
                    await aoSalvar();
                  }}
                />
              </td>
            ))}
          </tr>
        );
      })}
      <tr>
        <td className="px-2 py-1 pl-4">Consumo ({unidade})</td>
        {linha.consumo.map((q, i) => (
          <td key={i} className="px-1 py-1 text-right">
            <CelulaEditavel
              valor={q}
              rotulo={`${linha.nome} consumo ${MESES_ABREV[i]}`}
              onSalvar={async (novo) => {
                await api.salvarConsumo({ pontoId: linha.pontoId, ano, mes: i + 1, quantidade: novo });
                await aoSalvar();
              }}
            />
          </td>
        ))}
      </tr>
      <tr className="border-b font-medium">
        <td className="px-2 py-1 pl-4">Total (R$)</td>
        {linha.totalValor.map((v, i) => (
          <td key={i} className="px-2 py-1 text-right">
            {formatBRL(v)}
          </td>
        ))}
      </tr>
    </>
  );
}
```

- [ ] **Step 2: Commit** (a checagem de tipos completa roda na Task 11)

```bash
git add frontend && git commit -m "feat(frontend): tela Lancamentos com tabela editavel"
```

---

### Task 11: Tela Cadastros e navegação

**Files:**
- Create: `frontend/src/pages/Cadastros.tsx`, `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `api.pontos.*`, `api.fornecedores.*`, tipos `Ponto`, `Fornecedor`; `Dashboard`, `Lancamentos` (Tasks 9–10).
- Produces: `export function Cadastros()`, `export function App()`.

- [ ] **Step 1: Implementar Cadastros**

`frontend/src/pages/Cadastros.tsx`:
```tsx
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Fornecedor, Ponto, Tipo } from '../types';

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Erro inesperado');
const campo = 'rounded border border-slate-300 px-2 py-1 text-sm';
const botao = 'rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700';
const botaoSec = 'rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100';

export function Cadastros() {
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [p, f] = await Promise.all([api.pontos.listar(), api.fornecedores.listar()]);
      setPontos(p);
      setFornecedores(f);
      setErro(null);
    } catch (e) {
      setErro(msg(e));
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function executar(acao: () => Promise<unknown>) {
    try {
      await acao();
      await carregar();
    } catch (e) {
      setErro(msg(e));
    }
  }

  return (
    <div className="space-y-8">
      {erro && <p className="rounded bg-red-50 p-3 text-red-700">{erro}</p>}
      <SecaoPontos pontos={pontos} executar={executar} />
      <SecaoFornecedores fornecedores={fornecedores} executar={executar} />
    </div>
  );
}

type Executar = (acao: () => Promise<unknown>) => Promise<void>;

function SecaoPontos({ pontos, executar }: { pontos: Ponto[]; executar: Executar }) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<Tipo>('energia');
  const [editando, setEditando] = useState<number | null>(null);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Pontos de medição</h2>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          executar(async () => {
            await api.pontos.criar({ nome, tipo });
            setNome('');
          });
        }}
      >
        <input className={campo} placeholder="Nome do ponto" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
          <option value="energia">Energia</option>
          <option value="agua">Água</option>
        </select>
        <button className={botao}>Adicionar</button>
      </form>

      <div className="overflow-x-auto rounded bg-white shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-2 py-2">Nome</th>
              <th className="px-2 py-2">Tipo</th>
              <th className="px-2 py-2">Matrícula</th>
              <th className="px-2 py-2">Hidrômetro</th>
              <th className="px-2 py-2">Localização</th>
              <th className="px-2 py-2">Situação</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((p) =>
              editando === p.id ? (
                <EditarPonto key={p.id} ponto={p} aoFechar={() => setEditando(null)} executar={executar} />
              ) : (
                <tr key={p.id} className="border-t">
                  <td className="px-2 py-1">{p.nome}</td>
                  <td className="px-2 py-1">{p.tipo === 'energia' ? 'Energia' : 'Água'}</td>
                  <td className="px-2 py-1">{p.matricula ?? ''}</td>
                  <td className="px-2 py-1">{p.hidrometro ?? ''}</td>
                  <td className="px-2 py-1">{p.localizacao ?? ''}</td>
                  <td className="px-2 py-1">{p.ativo ? 'Ativo' : 'Inativo'}</td>
                  <td className="space-x-2 px-2 py-1 text-right">
                    <button className={botaoSec} onClick={() => setEditando(p.id)}>
                      Editar
                    </button>
                    <button className={botaoSec} onClick={() => executar(() => api.pontos.atualizar(p.id, { ativo: !p.ativo }))}>
                      {p.ativo ? 'Inativar' : 'Ativar'}
                    </button>
                    <button
                      className={botaoSec}
                      onClick={() => confirm(`Excluir "${p.nome}"?`) && executar(() => api.pontos.excluir(p.id))}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EditarPonto({ ponto, aoFechar, executar }: { ponto: Ponto; aoFechar: () => void; executar: Executar }) {
  const [nome, setNome] = useState(ponto.nome);
  const [matricula, setMatricula] = useState(ponto.matricula ?? '');
  const [hidrometro, setHidrometro] = useState(ponto.hidrometro ?? '');
  const [localizacao, setLocalizacao] = useState(ponto.localizacao ?? '');
  return (
    <tr className="border-t bg-blue-50">
      <td className="px-2 py-1">
        <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} />
      </td>
      <td className="px-2 py-1">{ponto.tipo === 'energia' ? 'Energia' : 'Água'}</td>
      <td className="px-2 py-1">
        <input className={campo} value={matricula} onChange={(e) => setMatricula(e.target.value)} />
      </td>
      <td className="px-2 py-1">
        <input className={campo} value={hidrometro} onChange={(e) => setHidrometro(e.target.value)} />
      </td>
      <td className="px-2 py-1">
        <input className={campo} value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} />
      </td>
      <td></td>
      <td className="space-x-2 px-2 py-1 text-right">
        <button
          className={botao}
          onClick={() =>
            executar(async () => {
              await api.pontos.atualizar(ponto.id, { nome, matricula, hidrometro, localizacao });
              aoFechar();
            })
          }
        >
          Salvar
        </button>
        <button className={botaoSec} onClick={aoFechar}>
          Cancelar
        </button>
      </td>
    </tr>
  );
}

function SecaoFornecedores({ fornecedores, executar }: { fornecedores: Fornecedor[]; executar: Executar }) {
  const [nome, setNome] = useState('');
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Fornecedores de energia</h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          executar(async () => {
            await api.fornecedores.criar(nome);
            setNome('');
          });
        }}
      >
        <input className={campo} placeholder="Nome do fornecedor" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <button className={botao}>Adicionar</button>
      </form>
      <ul className="divide-y rounded bg-white shadow">
        {fornecedores.map((f) => (
          <li key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>{f.nome}</span>
            <span className="space-x-2">
              <button
                className={botaoSec}
                onClick={() => {
                  const novo = prompt('Novo nome do fornecedor', f.nome);
                  if (novo && novo.trim()) executar(() => api.fornecedores.atualizar(f.id, novo.trim()));
                }}
              >
                Renomear
              </button>
              <button className={botaoSec} onClick={() => confirm(`Excluir "${f.nome}"?`) && executar(() => api.fornecedores.excluir(f.id))}>
                Excluir
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Implementar App**

`frontend/src/App.tsx`:
```tsx
import { useState } from 'react';
import { Cadastros } from './pages/Cadastros';
import { Dashboard } from './pages/Dashboard';
import { Lancamentos } from './pages/Lancamentos';

const ABAS = [
  { id: 'dashboard', rotulo: 'Dashboard' },
  { id: 'lancamentos', rotulo: 'Lançamentos' },
  { id: 'cadastros', rotulo: 'Cadastros' },
] as const;

export function App() {
  const [aba, setAba] = useState<(typeof ABAS)[number]['id']>('dashboard');
  return (
    <div className="mx-auto max-w-7xl p-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Painel Energia e Água</h1>
        <nav className="flex gap-1">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`rounded px-4 py-1.5 text-sm ${aba === a.id ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-100'}`}
            >
              {a.rotulo}
            </button>
          ))}
        </nav>
      </header>
      {aba === 'dashboard' && <Dashboard />}
      {aba === 'lancamentos' && <Lancamentos />}
      {aba === 'cadastros' && <Cadastros />}
    </div>
  );
}
```

- [ ] **Step 3: Checagem de tipos, testes e build**

Run: `npm test` e `npm run build`
Expected: testes de backend e frontend PASS; build gera `backend/dist` e `frontend/dist` sem erros de tipo. Corrigir qualquer erro de tipo antes de seguir.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(frontend): tela Cadastros e navegacao por abas"
```

---

### Task 12: Documentação, verificação ponta a ponta e limpeza do starter kit

**Files:**
- Modify: `README.md`
- Delete: `STARTER_KIT_SUMMARY.txt` (descreve um kit com JWT/PostgreSQL/Docker que não corresponde ao projeto)

**Interfaces:**
- Consumes: tudo acima.
- Produces: README fiel ao projeto; sistema verificado com os dados reais.

- [ ] **Step 1: Reescrever o README**

Substituir `README.md` por (ajustando só se algo divergir do implementado):
```markdown
# Painel Energia e Água 2026

Sistema interno (sem login) para lançar e acompanhar consumo e custo de energia e água. Substitui a planilha `ENERGIA E ÁGUA 2026.xlsx`.

## Requisitos
- Node.js 20 ou 22 (LTS)

## Primeiros passos
```bash
npm install
npm run dev            # API em :3000, front em http://localhost:5173
```

## Produção (um único processo)
```bash
npm run build
npm start              # http://<ip-da-maquina>:3000 na rede local
```
Variáveis opcionais: `PORT` (padrão 3000), `DB_PATH` (padrão `backend/dados.sqlite`).

## Importar a planilha de 2026
```bash
npm run importar -- "caminho/ENERGIA E ÁGUA 2026.xlsx" --ano 2026
```
Pode ser repetido sem duplicar dados. Depois, associe matrícula/hidrômetro aos pontos de água na aba **Cadastros**.

## Backup
```bash
npm run backup         # cria backend/backups/dados-AAAA-MM-DD.sqlite
```

## Testes
```bash
npm test
```

## Observações
- Não há autenticação: qualquer pessoa na rede com o endereço pode editar. Use apenas em rede interna confiável.
- Totais e médias são calculados na consulta; nunca gravados.
- Unidade de consumo de energia: ver `UNIDADE_ENERGIA` em `frontend/src/format.ts`.
```

- [ ] **Step 2: Remover o resumo do starter kit**

Run: `git rm -f STARTER_KIT_SUMMARY.txt` (se ainda não estiver rastreado, apagar o arquivo normalmente).

- [ ] **Step 3: Verificação ponta a ponta**

Run: `npm run build`, `npm run importar -- "<caminho>\ENERGIA E ÁGUA 2026.xlsx"`, `npm start`; abrir `http://localhost:3000`.
Expected, conferindo contra os prints da planilha:
- Lançamentos > Energia > 2026: maio, AREOLINO DE ABREU/Equatorial = 10.906,52; Total geral de maio = R$ 87.033,19 e consumo total = 90,76.
- Lançamentos > Água > 2026: março, total geral de valor = R$ 11.632,84; agosto = R$ 10.395,57.
- Dashboard > Energia: gráfico de linha com os meses lançados; ano sem dados mostra aviso e "—".
- Editar uma célula, sair do campo e recarregar a página: valor persiste. Digitar `abc`: célula fica vermelha e nada é salvo.
- De outro computador da rede, abrir `http://<ip>:3000` (liberar a porta 3000 no firewall do Windows se necessário).
- Anotar divergências para o usuário (ex.: consumo de abril = 836,20 na planilha, enquanto os demais meses ficam entre 17 e 100; provável erro de digitação na origem).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: README do projeto e remocao do resumo do starter kit"
```

---

## Self-Review (feito ao escrever)

**Cobertura da spec:** cadastros (T3, T11); lançamento de energia/água com totais (T4, T10); dashboard (T5, T9); importação idempotente (T7); sem login e um único processo (T1, T6); backup (T6); testes de backend e frontend (todas); README ajustado e remoção do starter kit (T12). Itens "em aberto" da spec: abas da importação viram opções de CLI com padrão `ENERGIA 2026- LIVRE` / `ÁGUA 2026` (T7); associação medidor→ponto é manual na tela Cadastros, e o importador lista os medidores encontrados (T7, T11).

**Consistência de tipos:** `Celula`, `Tabela`, `LinhaTabela`, `Dashboard` têm os mesmos campos no backend (T4, T5) e no `types.ts` do frontend (T8). `gravarValor`/`gravarConsumo` (T4) são usados pelo importador (T7) com as mesmas assinaturas.

**Riscos conhecidos:** (1) o leitor de planilha parte do layout visto nos prints; a Task 7 Step 1 manda inspecionar o arquivo real e ajustar antes de seguir. (2) `better-sqlite3` pode exigir Node LTS para obter binário pré-compilado. (3) Nomes de fornecedor com variações de digitação entre blocos viram fornecedores distintos na importação.
