import type { Dashboard, Fornecedor, Ponto, Tabela, Tipo } from './types';

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (r.status === 204) return undefined as T;
  const corpo = await r.json().catch(() => null);
  if (!r.ok) {
    const detalhe = corpo?.campos ? ': ' + Object.values(corpo.campos).join('; ') : '';
    throw new Error((corpo?.erro ?? `Erro ${r.status}`) + detalhe);
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
