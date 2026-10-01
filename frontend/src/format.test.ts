import { describe, expect, it } from 'vitest';
import { formatBRL, formatInput, formatNumero, parseNumeroBR } from './format';

describe('parseNumeroBR', () => {
  it('lê formatos pt-BR', () => {
    expect(parseNumeroBR('1.234,56')).toBe(1234.56);
    expect(parseNumeroBR('R$ 1.234,56')).toBe(1234.56);
    expect(parseNumeroBR('10577,1')).toBe(10577.1);
    expect(parseNumeroBR('943,37')).toBe(943.37);
  });
  it('trata ponto sem vírgula', () => {
    expect(parseNumeroBR('1.234')).toBe(1234);
    expect(parseNumeroBR('12.5')).toBe(12.5);
    expect(parseNumeroBR('276')).toBe(276);
  });
  it('vazio vira null (sem lançamento) e zero continua zero', () => {
    expect(parseNumeroBR('')).toBeNull();
    expect(parseNumeroBR('   ')).toBeNull();
    expect(parseNumeroBR('0')).toBe(0);
  });
  it('rejeita negativo e texto', () => {
    expect(parseNumeroBR('-5')).toBe('invalido');
    expect(parseNumeroBR('abc')).toBe('invalido');
    expect(parseNumeroBR('1,2,3')).toBe('invalido');
  });
});

describe('formatação', () => {
  it('formatInput usa vírgula e vazio para null', () => {
    expect(formatInput(10577.1)).toBe('10577,1');
    expect(formatInput(null)).toBe('');
    expect(formatInput(0)).toBe('0');
  });
  it('formatBRL e formatNumero mostram traço para null', () => {
    expect(formatBRL(null)).toBe('—');
    expect(formatNumero(null)).toBe('—');
    expect(formatBRL(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
    expect(formatNumero(1234.5)).toBe('1.234,50');
  });
});
