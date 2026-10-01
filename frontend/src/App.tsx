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
    <div className="mx-auto max-w-7xl p-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Painel Energia e Água</h1>
        <nav className="flex gap-1">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={`rounded px-4 py-1.5 text-sm ${aba === a.id ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-100'}`}
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
