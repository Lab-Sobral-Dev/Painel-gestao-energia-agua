# Painel Energia e Água 2026 — Design

Data: 2026-10-01

## Objetivo

Substituir a planilha `ENERGIA E ÁGUA 2026.xlsx` por um sistema web. A equipe lança os dados de energia e água diretamente no sistema, que calcula totais e mostra um dashboard. A planilha de 2026 é usada apenas na migração inicial.

## Contexto e restrições

- Uso interno, rede local, poucas pessoas.
- **Sem login e sem controle de usuários.** Qualquer pessoa com acesso ao endereço pode ler e editar. O histórico de alterações não identifica autor. Login pode ser acrescentado depois.
- Sem Docker e sem nuvem. Um único processo em um PC ou servidor da rede.
- A pasta do projeto contém hoje apenas `README.md`, `STARTER_KIT_SUMMARY.txt`, `package.json`, a planilha e dois prints. `backend/` e `frontend/` não existem e serão criados do zero. `README.md`, `STARTER_KIT_SUMMARY.txt` e `package.json` devem ser ajustados a este design (sem JWT, bcrypt, PostgreSQL e Docker).

## Escopo da v1

Inclui:
- Cadastro de pontos de medição e fornecedores.
- Lançamento mensal de energia (R$ por fornecedor e consumo em MWh) e água (R$ e m³).
- Tabela mensal estilo planilha com totais automáticos.
- Dashboard: evolução mensal, comparação entre pontos, total anual, média mensal.
- Importação única da planilha de 2026.

Fora da v1: login, metas/orçamento, alertas, exportação Excel/PDF, upload de arquivos pela interface, multi-tenant, mobile.

## Arquitetura

- `backend/`: Node.js, Express, TypeScript, SQLite, Zod.
- `frontend/`: React 18, Vite, TypeScript, Tailwind CSS, Recharts.
- Raiz: npm workspaces (`backend`, `frontend`), script `dev` com `concurrently`.
- Desenvolvimento: dois processos (API em 3000, Vite em 5173 com proxy `/api`).
- Produção: `npm run build` compila ambos; o Express serve o front compilado. Um único `npm start`.
- Banco: arquivo `dados.sqlite`. Backup é a cópia do arquivo (script simples fornecido).
- Sem CORS: front e API usam a mesma origem (em dev, o Vite faz proxy de `/api`).

Driver SQLite: `better-sqlite3` (síncrono, simples). Verificar na implementação se há binário pré-compilado para a versão de Node instalada; caso contrário usar `node:sqlite`.

## Modelo de dados

| Tabela | Colunas principais |
|---|---|
| `ponto` | `id`, `nome`, `tipo` (`energia` \| `agua`), `matricula`, `hidrometro`, `localizacao` (os três últimos opcionais, usados na água), `ativo` |
| `fornecedor` | `id`, `nome` (apenas energia) |
| `lancamento_valor` | `id`, `ponto_id`, `ano`, `mes` (1–12), `fornecedor_id` (nulo na água), `valor_rs`. Único por (`ponto_id`, `ano`, `mes`, `fornecedor_id`) |
| `lancamento_consumo` | `id`, `ponto_id`, `ano`, `mes`, `quantidade` (MWh para energia, m³ para água). Único por (`ponto_id`, `ano`, `mes`) |

Ausência de linha significa "sem lançamento", diferente de zero. Valores negativos são rejeitados.

Totais por ponto, total geral do mês, média mensal, total anual e custo médio (R$ total / consumo) são **calculados na consulta e nunca gravados**.

Interpretação da planilha de energia: "CONSUMO" = consumo por unidade; linha "KWH" = custo médio (R$ total / consumo; ex.: maio 87.033,19 / 90,76 = 958,95). Os valores (17 a 100 por unidade) indicam que a unidade é **MWh, não kWh** — a confirmar com o usuário. A unidade é uma constante única no front (`UNIDADE_ENERGIA`).

Média mensal = média dos meses que têm lançamento (não divide por 12).

Pontos iniciais conhecidos:
- Energia: AREOLINO DE ABREU, BENTO LEÃO 25, BENTO LEÃO 25A. Fornecedores: EQUATORIAL, EQUATORIAL RENOVÁVEIS S.A, EQUATORIAL RENOVÁVEIS S.A (NF SERVIÇO).
- Água: PRODUÇÃO/STA, ADM/CQ, MANUTENÇÃO, SÓLIDOS/BATATA/PCP COMPRAS. Medidores (matrícula / hidrômetro / localização): 227378497-4 / A22FA0234889 / 01-600-10-500-0155; 203752640-0 / E15N001061 / 01-400-10-600-1380; 226962454-2 / B11L006108 / 01-400-10-600-1400; 203585751-6 / A98N160319 / 01-400-10-600-1395. O importador lista os medidores encontrados; a associação a cada ponto de água é feita manualmente na tela Cadastros.

## API (JSON, sem autenticação)

| Rota | Função |
|---|---|
| `GET/POST/PUT/DELETE /api/pontos` | CRUD de pontos |
| `GET/POST/PUT/DELETE /api/fornecedores` | CRUD de fornecedores |
| `GET /api/lancamentos?ano=&tipo=` | Tabela do ano: valores e consumo por ponto e mês, com totais |
| `PUT /api/lancamentos/valor` | Grava/atualiza (upsert) valor de uma célula (ponto, ano, mês, fornecedor) |
| `PUT /api/lancamentos/consumo` | Grava/atualiza consumo de uma célula (ponto, ano, mês) |
| `GET /api/dashboard?ano=&tipo=` | Totais mensais, média, total anual, comparação entre pontos, variação contra mês anterior |

Entradas validadas com Zod. Erros em formato padrão `{ erro: string, campos?: {...} }`, mensagens em português. Excluir ponto ou fornecedor com lançamentos associados é bloqueado (a UI oferece inativar o ponto).

## Telas

1. **Dashboard** — filtros de ano e tipo. Cartões: total anual, média mensal, último mês. Gráfico de linha (evolução mensal) e de barras (comparação entre pontos).
2. **Lançamentos** — tabela editável, meses nas colunas e pontos nas linhas, abas Energia (valor por fornecedor + consumo em MWh) e Água (R$ + m³). Totais recalculados ao editar. Salva cada célula ao sair do campo.
3. **Cadastros** — pontos de medição e fornecedores.

Falha ao salvar: célula marcada em vermelho com a mensagem, valor digitado preservado.

## Importação da planilha

Script `npm run importar -w backend -- <caminho.xlsx>` (biblioteca `exceljs` ou `xlsx`). Lê as abas de energia e água de 2026, cria pontos/fornecedores ausentes e faz upsert dos lançamentos. Idempotente graças às chaves únicas. Ao final imprime um resumo (criados, atualizados, ignorados) e lista células não interpretadas. Células vazias não geram lançamento.

Risco conhecido: a planilha tem layout visual (blocos mensais lado a lado, abas "TESTE WEL", "Planilha1", "painel", "ANÁLISE CONSUMO"). O mapeamento exato de células será definido na implementação, inspecionando o arquivo; abas de teste e análise ficam fora da importação salvo decisão em contrário.

## Testes

- Backend (Vitest, SQLite em memória): cálculos de totais e média, upsert, validações, bloqueio de exclusão, idempotência da importação.
- Frontend: cálculos de totais e comportamento de edição de célula. Sem testes visuais.

## Decisões em aberto

- Quais abas da planilha entram na importação (assumido: as duas abas de dados "ENERGIA 2026- LIVRE" e "ÁGUA 2026").
- Associação de cada medidor de água aos pontos (ver acima).
