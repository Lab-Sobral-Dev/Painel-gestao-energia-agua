import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api';
import { Aviso, Campo, Cartao } from '../components/ui';
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
      <div className="flex flex-wrap items-center gap-4">
        <TipoToggle tipo={tipo} onChange={setTipo} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Ano
          <Campo type="number" value={ano} min={2000} max={2100} onChange={(e) => setAno(Number(e.target.value))} className="w-24" />
        </label>
      </div>

      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {semDados && <Aviso tom="alerta">Sem lançamentos para {ano}. Use a aba Lançamentos ou importe a planilha.</Aviso>}

      {dados && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <CartaoMetrica titulo="Total do ano" valor={formatBRL(dados.totalAnualValor)} detalhe={`${formatNumero(dados.totalAnualConsumo)} ${unidade}`} />
            <CartaoMetrica titulo="Média mensal" valor={formatBRL(dados.mediaMensalValor)} detalhe="meses com lançamento" />
            <CartaoMetrica
              titulo="Último mês lançado"
              valor={dados.ultimoMes ? formatBRL(dados.ultimoMes.valor) : '—'}
              detalhe={dados.ultimoMes ? MESES_ABREV[dados.ultimoMes.mes - 1] : ''}
              variacaoPct={dados.ultimoMes?.variacaoPct ?? null}
            />
          </div>

          <Cartao>
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Evolução mensal (R$)</h2>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={serieMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="valor" name="Valor (R$)" stroke="#c2410c" strokeWidth={2} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Cartao>

          <Cartao>
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Total do ano por ponto (R$)</h2>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={serieAnual}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="nome" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="valor" name="Valor (R$)" fill="#c2410c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Cartao>
        </>
      )}
    </div>
  );
}

export function TipoToggle({ tipo, onChange }: { tipo: Tipo; onChange: (t: Tipo) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white">
      {(['energia', 'agua'] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-1.5 text-sm font-medium transition-colors ${
            tipo === t ? (t === 'energia' ? 'bg-orange-700 text-white' : 'bg-sky-700 text-white') : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          {t === 'energia' ? 'Energia' : 'Água'}
        </button>
      ))}
    </div>
  );
}

function CartaoMetrica({
  titulo,
  valor,
  detalhe,
  variacaoPct,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  variacaoPct?: number | null;
}) {
  return (
    <Cartao>
      <p className="text-sm font-medium text-slate-500">{titulo}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{valor}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
        {detalhe}
        {variacaoPct != null && (
          <span className={variacaoPct > 0 ? 'font-medium text-red-600' : variacaoPct < 0 ? 'font-medium text-emerald-600' : undefined}>
            · {variacaoPct > 0 ? '+' : ''}
            {formatNumero(variacaoPct)}% vs. mês anterior
          </span>
        )}
      </p>
    </Cartao>
  );
}
