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
