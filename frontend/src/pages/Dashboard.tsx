import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import { MESES_ABREV, UNIDADE_ENERGIA, formatBRL, formatNumero } from '../format';
import type { Dashboard as Dados, Tipo } from '../types';

export function Dashboard() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [tipo, setTipo] = useState<Tipo>('energia');
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api
      .dashboard(ano, tipo)
      .then((d) => ativo && (setDados(d), setErro(null)))
      .catch((e) => ativo && setErro(e instanceof Error ? e.message : 'Erro ao carregar'));
    return () => {
      ativo = false;
    };
  }, [ano, tipo]);

  const unidade = tipo === 'energia' ? UNIDADE_ENERGIA : 'm³';
  const serieMensal = dados?.mensal.map((m) => ({ mes: MESES_ABREV[m.mes - 1], valor: m.valor, consumo: m.consumo })) ?? [];
  const serieAnual = dados?.porPonto.map((p) => ({ nome: p.nome, valor: p.totalValor ?? 0 })) ?? [];
  const semDados = dados !== null && dados.totalAnualValor === null && dados.totalAnualConsumo === null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <TipoToggle tipo={tipo} onChange={setTipo} />
        <label className="text-sm">
          Ano{' '}
          <input
            type="number"
            value={ano}
            min={2000}
            max={2100}
            onChange={(e) => setAno(Number(e.target.value))}
            className="w-24 rounded border border-slate-300 px-2 py-1"
          />
        </label>
      </div>

      {erro && <p className="rounded bg-red-50 p-3 text-red-700">{erro}</p>}
      {semDados && <p className="rounded bg-amber-50 p-3 text-amber-800">Sem lançamentos para {ano}. Use a aba Lançamentos ou importe a planilha.</p>}

      {dados && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Cartao titulo="Total do ano" valor={formatBRL(dados.totalAnualValor)} detalhe={`${formatNumero(dados.totalAnualConsumo)} ${unidade}`} />
            <Cartao titulo="Média mensal" valor={formatBRL(dados.mediaMensalValor)} detalhe="meses com lançamento" />
            <Cartao
              titulo="Último mês lançado"
              valor={dados.ultimoMes ? formatBRL(dados.ultimoMes.valor) : '—'}
              detalhe={
                dados.ultimoMes
                  ? `${MESES_ABREV[dados.ultimoMes.mes - 1]}${dados.ultimoMes.variacaoPct !== null ? ` · ${dados.ultimoMes.variacaoPct > 0 ? '+' : ''}${formatNumero(dados.ultimoMes.variacaoPct)}% vs. mês anterior` : ''}`
                  : ''
              }
            />
          </div>

          <section className="rounded bg-white p-4 shadow">
            <h2 className="mb-2 font-semibold">Evolução mensal (R$)</h2>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={serieMensal}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="valor" name="Valor (R$)" stroke="#2563eb" connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded bg-white p-4 shadow">
            <h2 className="mb-2 font-semibold">Total do ano por ponto (R$)</h2>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={serieAnual}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="valor" name="Valor (R$)" fill="#0d9488" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export function TipoToggle({ tipo, onChange }: { tipo: Tipo; onChange: (t: Tipo) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-slate-300">
      {(['energia', 'agua'] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-1 text-sm ${tipo === t ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-100'}`}
        >
          {t === 'energia' ? 'Energia' : 'Água'}
        </button>
      ))}
    </div>
  );
}

function Cartao({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <div className="rounded bg-white p-4 shadow">
      <p className="text-sm text-slate-500">{titulo}</p>
      <p className="text-2xl font-semibold">{valor}</p>
      <p className="text-sm text-slate-500">{detalhe}</p>
    </div>
  );
}
