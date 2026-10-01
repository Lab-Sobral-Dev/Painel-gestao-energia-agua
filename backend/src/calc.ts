export type Celula = number | null;

export const arredondar = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function presentes(v: Celula[]): number[] {
  return v.filter((x): x is number => x !== null);
}

export function somar(v: Celula[]): Celula {
  const n = presentes(v);
  return n.length ? arredondar(n.reduce((a, b) => a + b, 0)) : null;
}

export function media(v: Celula[]): Celula {
  const n = presentes(v);
  return n.length ? arredondar(n.reduce((a, b) => a + b, 0) / n.length) : null;
}

export function custoMedio(totalRs: Celula, consumo: Celula): Celula {
  if (totalRs === null || consumo === null || consumo === 0) return null;
  return arredondar(totalRs / consumo);
}
