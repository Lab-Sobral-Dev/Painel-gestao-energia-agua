import { useState } from 'react';
import { Cadastros } from './pages/Cadastros';
import { Dashboard } from './pages/Dashboard';
import { Lancamentos } from './pages/Lancamentos';

const ABAS = [
  { id: 'dashboard', rotulo: 'Dashboard' },
  { id: 'lancamentos', rotulo: 'Lançamentos' },
  { id: 'cadastros', rotulo: 'Cadastros' },
] as const;

export function App() {
  const [aba, setAba] = useState<(typeof ABAS)[number]['id']>('dashboard');
  return (
    <div className="mx-auto max-w-7xl p-4 lg:p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Painel Energia e Água</h1>
        <nav className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                aba === a.id ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {a.rotulo}
            </button>
          ))}
        </nav>
      </header>
      {aba === 'dashboard' && <Dashboard />}
      {aba === 'lancamentos' && <Lancamentos />}
      {aba === 'cadastros' && <Cadastros />}
    </div>
  );
}
