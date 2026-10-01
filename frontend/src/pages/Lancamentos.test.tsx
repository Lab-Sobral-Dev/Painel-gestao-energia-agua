import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Tabela } from '../types';

vi.mock('../api', () => ({ api: { tabela: vi.fn(), salvarValor: vi.fn(), salvarConsumo: vi.fn() } }));
import { api } from '../api';
import { Lancamentos } from './Lancamentos';

const doze = () => Array(12).fill(null);
const tabela = (nome: string, tipo: 'energia' | 'agua'): Tabela => ({
  ano: 2026,
  tipo,
  fornecedores: [],
  linhas: [{ pontoId: 1, nome, ativo: true, valores: [{ fornecedorId: null, meses: doze() }], consumo: doze(), totalValor: doze() }],
  totalGeralValor: doze(),
  totalGeralConsumo: doze(),
});

describe('Lancamentos', () => {
  it('ignora a resposta atrasada de uma consulta anterior', async () => {
    let liberarAntiga!: (t: Tabela) => void;
    vi.mocked(api.tabela).mockImplementationOnce(() => new Promise<Tabela>((res) => (liberarAntiga = res)));
    vi.mocked(api.tabela).mockImplementationOnce(async () => tabela('PONTO NOVO', 'agua'));
    render(<Lancamentos />);
    await userEvent.click(screen.getByRole('button', { name: 'Água' }));
    expect(await screen.findByText('PONTO NOVO')).toBeTruthy();
    await act(async () => {
      liberarAntiga(tabela('PONTO VELHO', 'energia'));
    });
    expect(screen.queryByText('PONTO VELHO')).toBeNull();
    expect(screen.getByText('PONTO NOVO')).toBeTruthy();
  });
});
