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
