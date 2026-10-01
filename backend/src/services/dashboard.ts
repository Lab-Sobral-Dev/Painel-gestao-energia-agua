import { arredondar, custoMedio, media, somar, type Celula } from '../calc';
import type { Tabela, Tipo } from './tabela';

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

export function resumir(t: Tabela): Dashboard {
  const mensal = t.totalGeralValor.map((valor, i) => ({
    mes: i + 1,
    valor,
    consumo: t.totalGeralConsumo[i],
    custoMedio: custoMedio(valor, t.totalGeralConsumo[i]),
  }));

  let ultimoMes: Dashboard['ultimoMes'] = null;
  for (let i = t.totalGeralValor.length - 1; i >= 0; i--) {
    const valor = t.totalGeralValor[i];
    if (valor === null) continue;
    const anterior = i > 0 ? t.totalGeralValor[i - 1] : null;
    ultimoMes = {
      mes: i + 1,
      valor,
      variacaoPct: anterior !== null && anterior !== 0 ? arredondar(((valor - anterior) / anterior) * 100) : null,
    };
    break;
  }

  return {
    ano: t.ano,
    tipo: t.tipo,
    mensal,
    totalAnualValor: somar(t.totalGeralValor),
    mediaMensalValor: media(t.totalGeralValor),
    totalAnualConsumo: somar(t.totalGeralConsumo),
    ultimoMes,
    porPonto: t.linhas.map((l) => ({
      pontoId: l.pontoId,
      nome: l.nome,
      totalValor: somar(l.totalValor),
      totalConsumo: somar(l.consumo),
    })),
  };
}
