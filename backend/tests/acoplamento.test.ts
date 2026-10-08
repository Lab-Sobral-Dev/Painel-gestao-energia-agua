import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { PRODUTO, verificarToken, type ConfigAcoplamento } from '../src/acoplamento';
import { openDb } from '../src/db';

const cfg: ConfigAcoplamento = {
  dockingSecret: 'segredo-de-teste',
  cookieSecure: false,
  frameAncestors: "'self' http://gestao.labsobralnet.ind",
};

function jwt(corpo: Record<string, unknown>, segredo = cfg.dockingSecret!, alg = 'HS256') {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const h = b64({ alg, typ: 'JWT' });
  const p = b64(corpo);
  const s = crypto.createHmac('sha256', segredo).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

const exp = () => Math.floor(Date.now() / 1000) + 60;
const valido = () => jwt({ sub: 'hclaudio', produto: PRODUTO, exp: exp() });
const novoApp = (c: ConfigAcoplamento | undefined = cfg) => createApp(openDb(':memory:'), { acoplamento: c });

describe('verificarToken', () => {
  it('aceita token válido e devolve o login', () => {
    expect(verificarToken(valido(), cfg)).toBe('hclaudio');
  });
  it.each([
    ['assinatura de outro segredo', () => jwt({ sub: 'x', produto: PRODUTO, exp: exp() }, 'outro')],
    ['expirado', () => jwt({ sub: 'x', produto: PRODUTO, exp: Math.floor(Date.now() / 1000) - 1 })],
    ['produto errado', () => jwt({ sub: 'x', produto: 'sbr-kpis', exp: exp() })],
    ['sem sub', () => jwt({ produto: PRODUTO, exp: exp() })],
    ['alg diferente de HS256', () => jwt({ sub: 'x', produto: PRODUTO, exp: exp() }, cfg.dockingSecret, 'none')],
    ['lixo', () => 'a.b.c'],
  ])('rejeita %s', (_nome, fazer) => {
    expect(verificarToken(fazer(), cfg)).toBeNull();
  });
});

describe('GET /api/auth/sso', () => {
  it('sem token → 400', async () => {
    expect((await request(novoApp()).get('/api/auth/sso')).status).toBe(400);
  });
  it('token inválido → 401', async () => {
    expect((await request(novoApp()).get('/api/auth/sso?token=x.y.z')).status).toBe(401);
  });
  it('sem DOCKING_SECRET → 503', async () => {
    const res = await request(novoApp({ ...cfg, dockingSecret: undefined })).get('/api/auth/sso?token=x');
    expect(res.status).toBe(503);
  });
  it('token válido → 302 para / com cookie host-only HttpOnly Lax', async () => {
    const res = await request(novoApp()).get(`/api/auth/sso?token=${valido()}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Domain=');
    expect(cookie).not.toContain('Secure');
  });
  it('SESSION_COOKIE_SECURE liga Secure', async () => {
    const res = await request(novoApp({ ...cfg, cookieSecure: true })).get(`/api/auth/sso?token=${valido()}`);
    expect(String(res.headers['set-cookie'])).toContain('Secure');
  });
  it('respeita next interno e ignora next externo', async () => {
    const app = novoApp();
    const a = await request(app).get(`/api/auth/sso?token=${valido()}&next=${encodeURIComponent('/lancamentos')}`);
    expect(a.headers.location).toBe('/lancamentos');
    for (const ruim of ['https://evil.com', '//evil.com', '/\\evil.com']) {
      const b = await request(app).get(`/api/auth/sso?token=${valido()}&next=${encodeURIComponent(ruim)}`);
      expect(b.headers.location).toBe('/');
    }
  });
});

describe('sessão nas rotas /api', () => {
  it('sem sessão → 401', async () => {
    expect((await request(novoApp()).get('/api/pontos')).status).toBe(401);
  });
  it('cookie forjado → 401', async () => {
    const forjado = `${Buffer.from(JSON.stringify({ sub: 'x', exp: 9999999999 })).toString('base64url')}.AAAA`;
    const res = await request(novoApp()).get('/api/pontos').set('Cookie', `painel_sessao=${forjado}`);
    expect(res.status).toBe(401);
  });
  it('depois do SSO, o cookie libera a API', async () => {
    const app = novoApp();
    const sso = await request(app).get(`/api/auth/sso?token=${valido()}`);
    const cookie = String(sso.headers['set-cookie']).split(';')[0];
    const res = await request(app).get('/api/pontos').set('Cookie', cookie);
    expect(res.status).toBe(200);
  });
  it('sem DOCKING_SECRET, a API segue aberta (uso local)', async () => {
    const res = await request(novoApp({ ...cfg, dockingSecret: undefined })).get('/api/pontos');
    expect(res.status).toBe(200);
  });
  it('sem acoplamento configurado, comportamento antigo (aberto)', async () => {
    expect((await request(createApp(openDb(':memory:'))).get('/api/pontos')).status).toBe(200);
  });
});

describe('CSP frame-ancestors', () => {
  it('é enviado nas respostas', async () => {
    const res = await request(novoApp()).get('/api/pontos');
    expect(res.headers['content-security-policy']).toBe("frame-ancestors 'self' http://gestao.labsobralnet.ind");
  });
});
