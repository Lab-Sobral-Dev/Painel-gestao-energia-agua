import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Aviso, Badge, Botao, Campo, Cartao, Selecao } from '../components/ui';
import type { Fornecedor, Ponto, Tipo } from '../types';

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Erro inesperado');

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
    <div className="space-y-6">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
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
    <Cartao className="space-y-4">
      <h2 className="text-base font-semibold text-slate-900">Pontos de medição</h2>
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
        <Campo placeholder="Nome do ponto" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <Selecao value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
          <option value="energia">Energia</option>
          <option value="agua">Água</option>
        </Selecao>
        <Botao type="submit">Adicionar</Botao>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium text-slate-600">Nome</th>
              <th className="px-3 py-2 font-medium text-slate-600">Tipo</th>
              <th className="px-3 py-2 font-medium text-slate-600">Matrícula</th>
              <th className="px-3 py-2 font-medium text-slate-600">Hidrômetro</th>
              <th className="px-3 py-2 font-medium text-slate-600">Localização</th>
              <th className="px-3 py-2 font-medium text-slate-600">Situação</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((p) =>
              editando === p.id ? (
                <EditarPonto key={p.id} ponto={p} aoFechar={() => setEditando(null)} executar={executar} />
              ) : (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 text-slate-800">{p.nome}</td>
                  <td className="px-3 py-1.5 text-slate-600">{p.tipo === 'energia' ? 'Energia' : 'Água'}</td>
                  <td className="px-3 py-1.5 text-slate-600">{p.matricula ?? ''}</td>
                  <td className="px-3 py-1.5 text-slate-600">{p.hidrometro ?? ''}</td>
                  <td className="px-3 py-1.5 text-slate-600">{p.localizacao ?? ''}</td>
                  <td className="px-3 py-1.5">
                    <Badge tom={p.ativo ? 'verde' : 'cinza'}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </td>
                  <td className="space-x-2 px-3 py-1.5 text-right">
                    <Botao variante="secundario" onClick={() => setEditando(p.id)}>
                      Editar
                    </Botao>
                    <Botao variante="secundario" onClick={() => executar(() => api.pontos.atualizar(p.id, { ativo: !p.ativo }))}>
                      {p.ativo ? 'Inativar' : 'Ativar'}
                    </Botao>
                    <Botao
                      variante="perigo"
                      onClick={() => confirm(`Excluir "${p.nome}"?`) && executar(() => api.pontos.excluir(p.id))}
                    >
                      Excluir
                    </Botao>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </Cartao>
  );
}

function EditarPonto({ ponto, aoFechar, executar }: { ponto: Ponto; aoFechar: () => void; executar: Executar }) {
  const [nome, setNome] = useState(ponto.nome);
  const [matricula, setMatricula] = useState(ponto.matricula ?? '');
  const [hidrometro, setHidrometro] = useState(ponto.hidrometro ?? '');
  const [localizacao, setLocalizacao] = useState(ponto.localizacao ?? '');
  return (
    <tr className="border-t border-slate-100 bg-orange-50/60">
      <td className="px-3 py-1.5">
        <Campo value={nome} onChange={(e) => setNome(e.target.value)} />
      </td>
      <td className="px-3 py-1.5 text-slate-600">{ponto.tipo === 'energia' ? 'Energia' : 'Água'}</td>
      <td className="px-3 py-1.5">
        <Campo value={matricula} onChange={(e) => setMatricula(e.target.value)} />
      </td>
      <td className="px-3 py-1.5">
        <Campo value={hidrometro} onChange={(e) => setHidrometro(e.target.value)} />
      </td>
      <td className="px-3 py-1.5">
        <Campo value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} />
      </td>
      <td></td>
      <td className="space-x-2 px-3 py-1.5 text-right">
        <Botao
          onClick={() =>
            executar(async () => {
              await api.pontos.atualizar(ponto.id, { nome, matricula, hidrometro, localizacao });
              aoFechar();
            })
          }
        >
          Salvar
        </Botao>
        <Botao variante="secundario" onClick={aoFechar}>
          Cancelar
        </Botao>
      </td>
    </tr>
  );
}

function SecaoFornecedores({ fornecedores, executar }: { fornecedores: Fornecedor[]; executar: Executar }) {
  const [nome, setNome] = useState('');
  return (
    <Cartao className="space-y-4">
      <h2 className="text-base font-semibold text-slate-900">Fornecedores de energia</h2>
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
        <Campo placeholder="Nome do fornecedor" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <Botao type="submit">Adicionar</Botao>
      </form>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {fornecedores.map((f) => (
          <li key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-slate-800">{f.nome}</span>
            <span className="space-x-2">
              <Botao
                variante="secundario"
                onClick={() => {
                  const novo = prompt('Novo nome do fornecedor', f.nome);
                  if (novo && novo.trim()) executar(() => api.fornecedores.atualizar(f.id, novo.trim()));
                }}
              >
                Renomear
              </Botao>
              <Botao variante="perigo" onClick={() => confirm(`Excluir "${f.nome}"?`) && executar(() => api.fornecedores.excluir(f.id))}>
                Excluir
              </Botao>
            </span>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}
