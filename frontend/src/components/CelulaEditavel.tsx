import { useEffect, useState } from 'react';
import { formatInput, parseNumeroBR } from '../format';

interface Props {
  valor: number | null;
  rotulo: string;
  onSalvar: (valor: number | null) => Promise<void>;
}

export function CelulaEditavel({ valor, rotulo, onSalvar }: Props) {
  const [texto, setTexto] = useState(formatInput(valor));
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setTexto(formatInput(valor)), [valor]);

  async function aoSair() {
    const n = parseNumeroBR(texto);
    if (n === 'invalido') {
      setErro('Número inválido');
      return;
    }
    if (n === valor) {
      setErro(null);
      return;
    }
    try {
      await onSalvar(n);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    }
  }

  return (
    <input
      aria-label={rotulo}
      aria-invalid={erro !== null}
      title={erro ?? undefined}
      value={texto}
      inputMode="decimal"
      onChange={(e) => setTexto(e.target.value)}
      onBlur={aoSair}
      className={`w-24 rounded border px-1 py-0.5 text-right text-sm ${
        erro ? 'border-red-500 bg-red-50' : 'border-slate-300 bg-white'
      }`}
    />
  );
}
