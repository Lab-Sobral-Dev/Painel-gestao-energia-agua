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
