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
