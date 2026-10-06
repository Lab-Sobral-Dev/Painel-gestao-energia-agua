import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { CelulaEditavel } from '../components/CelulaEditavel';
import { Aviso, Campo } from '../components/ui';
import { MESES_ABREV, UNIDADE_ENERGIA, formatBRL, formatNumero } from '../format';
import type { Tabela, Tipo } from '../types';
import { TipoToggle } from './Dashboard';

export function Lancamentos() {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [tipo, setTipo] = useState<Tipo>('energia');
  const [tabela, setTabela] = useState<Tabela | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const sequencia = useRef(0);
  const carregar = useCallback(async () => {
    const minha = ++sequencia.current; // só a consulta mais recente pode atualizar a tela
    try {
      const t = await api.tabela(ano, tipo);
      if (minha !== sequencia.current) return;
      setTabela(t);
      setErro(null);
    } catch (e) {
      if (minha !== sequencia.current) return;
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
      <div className="flex flex-wrap items-center gap-4">
        <TipoToggle tipo={tipo} onChange={setTipo} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Ano
          <Campo type="number" value={ano} min={2000} max={2100} onChange={(e) => setAno(Number(e.target.value))} className="w-24" />
        </label>
      </div>

      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {tabela && tabela.linhas.length === 0 && (
        <Aviso tom="alerta">Nenhum ponto de {tipo === 'energia' ? 'energia' : 'água'} cadastrado. Use a aba Cadastros.</Aviso>
      )}
      {semFornecedor && tabela.linhas.length > 0 && (
        <Aviso tom="alerta">Cadastre ao menos um fornecedor na aba Cadastros para lançar valores de energia.</Aviso>
      )}

      {tabela && tabela.linhas.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600">Ponto / linha</th>
                {MESES_ABREV.map((m) => (
                  <th key={m} className="px-2 py-2 text-right font-medium text-slate-600">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabela.linhas.map((linha, i) => (
                <LinhaPonto key={linha.pontoId} linha={linha} tabela={tabela} ano={ano} unidade={unidade} aoSalvar={carregar} par={i % 2 === 0} />
              ))}
            </tbody>
            <tfoot className="border-t-2 border-orange-200 bg-orange-50 font-semibold text-slate-900">
              <tr>
                <td className="px-3 py-2">Total geral (R$)</td>
                {tabela.totalGeralValor.map((v, i) => (
                  <td key={i} className="px-2 py-2 text-right">
                    {formatBRL(v)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-3 py-2">Consumo total ({unidade})</td>
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
  par,
}: {
  linha: Tabela['linhas'][number];
  tabela: Tabela;
  ano: number;
  unidade: string;
  aoSalvar: () => Promise<void>;
  par: boolean;
}) {
  const fundo = par ? 'bg-white' : 'bg-slate-50/50';
  return (
    <>
      <tr className={`border-t border-slate-200 ${fundo}`}>
        <td colSpan={13} className="px-3 py-1.5 font-semibold text-slate-800">
          {linha.nome}
          {!linha.ativo && <span className="ml-2 text-xs font-normal text-slate-500">(inativo)</span>}
        </td>
      </tr>
      {linha.valores.map((v) => {
        const nome = tabela.fornecedores.find((f) => f.id === v.fornecedorId)?.nome ?? 'Valor (R$)';
        return (
          <tr key={v.fornecedorId ?? 'agua'} className={fundo}>
            <td className="px-3 py-1 pl-6 text-slate-600">{nome}</td>
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
      <tr className={fundo}>
        <td className="px-3 py-1 pl-6 text-slate-600">Consumo ({unidade})</td>
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
      <tr className={`font-medium text-slate-900 ${fundo}`}>
        <td className="px-3 py-1 pl-6">Total (R$)</td>
        {linha.totalValor.map((v, i) => (
          <td key={i} className="px-2 py-1 text-right">
            {formatBRL(v)}
          </td>
        ))}
      </tr>
    </>
  );
}
