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
