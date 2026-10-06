import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const foco = 'focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500';

type VarianteBotao = 'primario' | 'secundario' | 'perigo';

const estilosBotao: Record<VarianteBotao, string> = {
  primario: 'bg-orange-700 text-white hover:bg-orange-800',
  secundario: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
  perigo: 'border border-slate-300 text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700',
};

export function Botao({
  variante = 'primario',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao }) {
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${estilosBotao[variante]} ${className}`}
      {...props}
    />
  );
}

export function Campo({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`rounded-md border border-slate-300 px-3 py-1.5 text-sm ${foco} ${className}`} {...props} />;
}

export function Selecao({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`rounded-md border border-slate-300 px-3 py-1.5 text-sm ${foco} ${className}`} {...props} />;
}

export function Badge({ tom, children }: { tom: 'verde' | 'cinza'; children: ReactNode }) {
  const estilos = tom === 'verde' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500';
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${estilos}`}>{children}</span>;
}

export function Cartao({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function Aviso({ tom, children }: { tom: 'erro' | 'alerta'; children: ReactNode }) {
  const estilos = tom === 'erro' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900';
  return <p className={`rounded-md border px-4 py-3 text-sm ${estilos}`}>{children}</p>;
}
