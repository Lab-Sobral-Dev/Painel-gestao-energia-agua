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
