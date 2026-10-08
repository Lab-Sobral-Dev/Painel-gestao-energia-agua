import crypto from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Router } from 'express';

/**
 * Acoplamento ao Gestão SBR (Protocolo de Acoplamento).
 * O Gestão autentica o usuário no AD e embute este painel num iframe, entregando um
 * token JWT HS256 de 60s em GET /api/auth/sso?token=... . Aqui o token vira uma sessão
 * em cookie, e todas as rotas /api passam a exigir essa sessão.
 *
 * Sem DOCKING_SECRET (uso local, sem Gestão) o painel continua aberto como antes.
 */

export const PRODUTO = 'painel-energia-agua';
const COOKIE = 'painel_sessao';
const VIDA_SESSAO_S = 12 * 3600;
const FRAME_ANCESTORS_PADRAO =
  "'self' http://gestao.labsobralnet.ind https://gestao.laboratoriosobral.com.br";

export interface ConfigAcoplamento {
  dockingSecret?: string;
  /** Chave de assinatura do cookie. Padrão: derivada do dockingSecret. */
  sessionSecret?: string;
  frameAncestors: string;
}

export function configDoAmbiente(env: NodeJS.ProcessEnv = process.env): ConfigAcoplamento {
  return {
    dockingSecret: env.DOCKING_SECRET || undefined,
    sessionSecret: env.SESSION_SECRET || undefined,
    frameAncestors: env.FRAME_ANCESTORS || FRAME_ANCESTORS_PADRAO,
  };
}

const b64u = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');
const hmac = (chave: string, dado: string) => crypto.createHmac('sha256', chave).update(dado).digest();

function iguais(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function chaveSessao(cfg: ConfigAcoplamento): string {
  return cfg.sessionSecret ?? hmac(cfg.dockingSecret ?? '', 'sessao').toString('hex');
}

/** Valida o JWT HS256 do Gestão. Devolve o login AD (`sub`) ou null. */
export function verificarToken(token: string, cfg: ConfigAcoplamento, agora = Date.now()): string | null {
  if (!cfg.dockingSecret) return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [h, p, s] = partes;
  try {
    const cab = JSON.parse(Buffer.from(h, 'base64url').toString());
    if (cab.alg !== 'HS256') return null;
    if (!iguais(hmac(cfg.dockingSecret, `${h}.${p}`), Buffer.from(s, 'base64url'))) return null;
    const corpo = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (corpo.produto !== PRODUTO) return null;
    if (typeof corpo.sub !== 'string' || !corpo.sub) return null;
    if (typeof corpo.exp !== 'number' || corpo.exp * 1000 <= agora) return null;
    return corpo.sub;
  } catch {
    return null;
  }
}

function assinarSessao(login: string, cfg: ConfigAcoplamento, agora = Date.now()): string {
  const corpo = b64u(JSON.stringify({ sub: login, exp: Math.floor(agora / 1000) + VIDA_SESSAO_S }));
  return `${corpo}.${b64u(hmac(chaveSessao(cfg), corpo))}`;
}

function lerSessao(cookieHeader: string | undefined, cfg: ConfigAcoplamento, agora = Date.now()): string | null {
  const bruto = cookieHeader
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!bruto) return null;
  const [corpo, assinatura] = bruto.split('.');
  if (!corpo || !assinatura) return null;
  if (!iguais(hmac(chaveSessao(cfg), corpo), Buffer.from(assinatura, 'base64url'))) return null;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    return typeof sub === 'string' && sub && exp * 1000 > agora ? sub : null;
  } catch {
    return null;
  }
}

/** `next` só é aceito como caminho interno (evita open redirect). */
function destinoSeguro(next: unknown): string {
  return typeof next === 'string' && /^\/(?![/\\])/.test(next) ? next : '/';
}

export function cabecalhoFrame(cfg: ConfigAcoplamento): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('Content-Security-Policy', `frame-ancestors ${cfg.frameAncestors}`);
    next();
  };
}

export function authRouter(cfg: ConfigAcoplamento): Router {
  const r = Router();
  r.get('/sso', (req, res) => {
    if (!cfg.dockingSecret) {
      res.status(503).json({ erro: 'Acoplamento não configurado' });
      return;
    }
    const token = req.query.token;
    if (typeof token !== 'string' || !token) {
      res.status(400).json({ erro: 'Token ausente' });
      return;
    }
    const login = verificarToken(token, cfg);
    if (!login) {
      res.status(401).json({ erro: 'Token inválido ou expirado' });
      return;
    }
    // Cookie host-only (sem Domain). O painel roda em iframe de outro site (gestao.laboratoriosobral.com.br
    // embutindo *.labsobralnet.ind): só SameSite=None; Secure persiste, e Secure exige HTTPS (vhost :443).
    const attrs = ['Path=/', 'HttpOnly', 'SameSite=None', 'Secure', `Max-Age=${VIDA_SESSAO_S}`];
    res.setHeader('Set-Cookie', `${COOKIE}=${assinarSessao(login, cfg)}; ${attrs.join('; ')}`);
    res.redirect(302, destinoSeguro(req.query.next));
  });
  return r;
}

/** Exige sessão do SSO em tudo que passa por aqui. No-op sem DOCKING_SECRET. */
export function exigirSessao(cfg: ConfigAcoplamento): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!cfg.dockingSecret) return next();
    if (lerSessao(req.headers.cookie, cfg)) return next();
    res.status(401).json({ erro: 'Sessão ausente. Abra o painel pelo Gestão SBR.' });
  };
}
