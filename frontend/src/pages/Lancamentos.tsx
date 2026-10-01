import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { CelulaEditavel } from '../components/CelulaEditavel';
import { MESES_ABREV, UNIDADE_ENERGIA, formatBRL, formatNumero } from '../format';
import type { Tabela, Tipo } from '../types';
import { TipoToggle } from './Dashboard';

export function Lancamentos() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [tipo, setTipo] = useState<Tipo>('energia');
  const [tabela, setTabela] = useState<Tabela | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setTabela(await api.tabela(ano, tipo));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
    }
  }, [ano, tipo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const unidade = tipo === 'energia' ? UNIDADE_ENERGIA : 'm³';
  const semFornecedor = tipo === 'energia' && tabela !== null && tabela.fornecedores.length === 0;

  return (
    <div className="space-y-4">
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
      {tabela && tabela.linhas.length === 0 && (
        <p className="rounded bg-amber-50 p-3 text-amber-800">Nenhum ponto de {tipo === 'energia' ? 'energia' : 'água'} cadastrado. Use a aba Cadastros.</p>
      )}
      {semFornecedor && tabela.linhas.length > 0 && (
        <p className="rounded bg-amber-50 p-3 text-amber-800">Cadastre ao menos um fornecedor na aba Cadastros para lançar valores de energia.</p>
      )}

      {tabela && tabela.linhas.length > 0 && (
        <div className="overflow-x-auto rounded bg-white shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-2 py-2 text-left">Ponto / linha</th>
                {MESES_ABREV.map((m) => (
                  <th key={m} className="px-2 py-2 text-right">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabela.linhas.map((linha) => (
                <LinhaPonto key={linha.pontoId} linha={linha} tabela={tabela} ano={ano} unidade={unidade} aoSalvar={carregar} />
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-semibold">
              <tr>
                <td className="px-2 py-2">Total geral (R$)</td>
                {tabela.totalGeralValor.map((v, i) => (
                  <td key={i} className="px-2 py-2 text-right">
                    {formatBRL(v)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-2 py-2">Consumo total ({unidade})</td>
                {tabela.totalGeralConsumo.map((v, i) => (
                  <td key={i} className="px-2 py-2 text-right">
                    {formatNumero(v)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function LinhaPonto({
  linha,
  tabela,
  ano,
  unidade,
  aoSalvar,
}: {
  linha: Tabela['linhas'][number];
  tabela: Tabela;
  ano: number;
  unidade: string;
  aoSalvar: () => Promise<void>;
}) {
  return (
    <>
      <tr className="bg-slate-50">
        <td colSpan={13} className="px-2 py-1 font-semibold">
          {linha.nome}
          {!linha.ativo && <span className="ml-2 text-xs font-normal text-slate-500">(inativo)</span>}
        </td>
      </tr>
      {linha.valores.map((v) => {
        const nome = tabela.fornecedores.find((f) => f.id === v.fornecedorId)?.nome ?? 'Valor (R$)';
        return (
          <tr key={v.fornecedorId ?? 'agua'}>
            <td className="px-2 py-1 pl-4">{nome}</td>
            {v.meses.map((valor, i) => (
              <td key={i} className="px-1 py-1 text-right">
                <CelulaEditavel
                  valor={valor}
                  rotulo={`${linha.nome} ${nome} ${MESES_ABREV[i]}`}
                  onSalvar={async (novo) => {
                    await api.salvarValor({ pontoId: linha.pontoId, ano, mes: i + 1, fornecedorId: v.fornecedorId, valorRs: novo });
                    await aoSalvar();
                  }}
                />
              </td>
            ))}
          </tr>
        );
      })}
      <tr>
        <td className="px-2 py-1 pl-4">Consumo ({unidade})</td>
        {linha.consumo.map((q, i) => (
          <td key={i} className="px-1 py-1 text-right">
            <CelulaEditavel
              valor={q}
              rotulo={`${linha.nome} consumo ${MESES_ABREV[i]}`}
              onSalvar={async (novo) => {
                await api.salvarConsumo({ pontoId: linha.pontoId, ano, mes: i + 1, quantidade: novo });
                await aoSalvar();
              }}
            />
          </td>
        ))}
      </tr>
      <tr className="border-b font-medium">
        <td className="px-2 py-1 pl-4">Total (R$)</td>
        {linha.totalValor.map((v, i) => (
          <td key={i} className="px-2 py-1 text-right">
            {formatBRL(v)}
          </td>
        ))}
      </tr>
    </>
  );
}
