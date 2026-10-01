import { describe, expect, it } from 'vitest';
import { custoMedio, media, somar } from '../src/calc';

describe('somar', () => {
  it('ignora nulos', () => expect(somar([1, null, 2])).toBe(3));
  it('devolve null quando não há nenhum valor', () => expect(somar([null, null])).toBeNull());
  it('trata 0 como valor, não como vazio', () => expect(somar([0, null])).toBe(0));
  it('evita erro de ponto flutuante', () => expect(somar([1.1, 2.2])).toBe(3.3));
});

describe('media', () => {
  it('divide só pelos meses com lançamento', () => expect(media([10, null, 20])).toBe(15));
  it('devolve null sem valores', () => expect(media([null, null])).toBeNull());
});

describe('custoMedio', () => {
  it('reproduz o valor da planilha (85.085,22 / 914,76 = 93,01)', () =>
    expect(custoMedio(85085.22, 914.76)).toBe(93.01));
  it('devolve null com consumo zero', () => expect(custoMedio(100, 0)).toBeNull());
  it('devolve null com algum lado vazio', () => {
    expect(custoMedio(null, 5)).toBeNull();
    expect(custoMedio(5, null)).toBeNull();
  });
});
