import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Fornecedor, Ponto, Tipo } from '../types';

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Erro inesperado');
const campo = 'rounded border border-slate-300 px-2 py-1 text-sm';
const botao = 'rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700';
const botaoSec = 'rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-100';

type Executar = (acao: () => Promise<unknown>) => Promise<void>;

export function Cadastros() {
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [p, f] = await Promise.all([api.pontos.listar(), api.fornecedores.listar()]);
      setPontos(p);
      setFornecedores(f);
      setErro(null);
    } catch (e) {
      setErro(msg(e));
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function executar(acao: () => Promise<unknown>) {
    try {
      await acao();
      await carregar();
    } catch (e) {
      setErro(msg(e));
    }
  }

  return (
    <div className="space-y-8">
      {erro && <p className="rounded bg-red-50 p-3 text-red-700">{erro}</p>}
      <SecaoPontos pontos={pontos} executar={executar} />
      <SecaoFornecedores fornecedores={fornecedores} executar={executar} />
    </div>
  );
}

function SecaoPontos({ pontos, executar }: { pontos: Ponto[]; executar: Executar }) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<Tipo>('energia');
  const [editando, setEditando] = useState<number | null>(null);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Pontos de medição</h2>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          executar(async () => {
            await api.pontos.criar({ nome, tipo });
            setNome('');
          });
        }}
      >
        <input className={campo} placeholder="Nome do ponto" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
          <option value="energia">Energia</option>
          <option value="agua">Água</option>
        </select>
        <button className={botao}>Adicionar</button>
      </form>

      <div className="overflow-x-auto rounded bg-white shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-2 py-2">Nome</th>
              <th className="px-2 py-2">Tipo</th>
              <th className="px-2 py-2">Matrícula</th>
              <th className="px-2 py-2">Hidrômetro</th>
              <th className="px-2 py-2">Localização</th>
              <th className="px-2 py-2">Situação</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((p) =>
              editando === p.id ? (
                <EditarPonto key={p.id} ponto={p} aoFechar={() => setEditando(null)} executar={executar} />
              ) : (
                <tr key={p.id} className="border-t">
                  <td className="px-2 py-1">{p.nome}</td>
                  <td className="px-2 py-1">{p.tipo === 'energia' ? 'Energia' : 'Água'}</td>
                  <td className="px-2 py-1">{p.matricula ?? ''}</td>
                  <td className="px-2 py-1">{p.hidrometro ?? ''}</td>
                  <td className="px-2 py-1">{p.localizacao ?? ''}</td>
                  <td className="px-2 py-1">{p.ativo ? 'Ativo' : 'Inativo'}</td>
                  <td className="space-x-2 px-2 py-1 text-right">
                    <button className={botaoSec} onClick={() => setEditando(p.id)}>
                      Editar
                    </button>
                    <button className={botaoSec} onClick={() => executar(() => api.pontos.atualizar(p.id, { ativo: !p.ativo }))}>
                      {p.ativo ? 'Inativar' : 'Ativar'}
                    </button>
                    <button
                      className={botaoSec}
                      onClick={() => confirm(`Excluir "${p.nome}"?`) && executar(() => api.pontos.excluir(p.id))}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EditarPonto({ ponto, aoFechar, executar }: { ponto: Ponto; aoFechar: () => void; executar: Executar }) {
  const [nome, setNome] = useState(ponto.nome);
  const [matricula, setMatricula] = useState(ponto.matricula ?? '');
  const [hidrometro, setHidrometro] = useState(ponto.hidrometro ?? '');
  const [localizacao, setLocalizacao] = useState(ponto.localizacao ?? '');
  return (
    <tr className="border-t bg-blue-50">
      <td className="px-2 py-1">
        <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} />
      </td>
      <td className="px-2 py-1">{ponto.tipo === 'energia' ? 'Energia' : 'Água'}</td>
      <td className="px-2 py-1">
        <input className={campo} value={matricula} onChange={(e) => setMatricula(e.target.value)} />
      </td>
      <td className="px-2 py-1">
        <input className={campo} value={hidrometro} onChange={(e) => setHidrometro(e.target.value)} />
      </td>
      <td className="px-2 py-1">
        <input className={campo} value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} />
      </td>
      <td></td>
      <td className="space-x-2 px-2 py-1 text-right">
        <button
          className={botao}
          onClick={() =>
            executar(async () => {
              await api.pontos.atualizar(ponto.id, { nome, matricula, hidrometro, localizacao });
              aoFechar();
            })
          }
        >
          Salvar
        </button>
        <button className={botaoSec} onClick={aoFechar}>
          Cancelar
        </button>
      </td>
    </tr>
  );
}

function SecaoFornecedores({ fornecedores, executar }: { fornecedores: Fornecedor[]; executar: Executar }) {
  const [nome, setNome] = useState('');
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Fornecedores de energia</h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          executar(async () => {
            await api.fornecedores.criar(nome);
            setNome('');
          });
        }}
      >
        <input className={campo} placeholder="Nome do fornecedor" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <button className={botao}>Adicionar</button>
      </form>
      <ul className="divide-y rounded bg-white shadow">
        {fornecedores.map((f) => (
          <li key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>{f.nome}</span>
            <span className="space-x-2">
              <button
                className={botaoSec}
                onClick={() => {
                  const novo = prompt('Novo nome do fornecedor', f.nome);
                  if (novo && novo.trim()) executar(() => api.fornecedores.atualizar(f.id, novo.trim()));
                }}
              >
                Renomear
              </button>
              <button className={botaoSec} onClick={() => confirm(`Excluir "${f.nome}"?`) && executar(() => api.fornecedores.excluir(f.id))}>
                Excluir
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
