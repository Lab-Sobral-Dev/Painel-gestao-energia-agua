# Painel Energia e Água 2026

Sistema interno (sem login) para lançar e acompanhar consumo e custo de energia e água. Substitui a planilha `ENERGIA E ÁGUA 2026.xlsx`.

- **Lançamentos:** tabela mensal editável (energia por fornecedor + consumo; água em R$ + m³), com totais automáticos.
- **Dashboard:** total do ano, média mensal, variação do último mês, evolução mensal e comparação entre pontos.
- **Cadastros:** pontos de medição (com matrícula, hidrômetro e localização) e fornecedores.

## Requisitos

- Node.js 22 ou superior (exigência do `better-sqlite3@13`)

## Primeiros passos (desenvolvimento)

```bash
npm install
npm run dev            # API em :3000, front em http://localhost:5173
```

## Produção (um único processo)

```bash
npm run build
npm start              # http://<ip-da-maquina>:3000 na rede local
```

Variáveis opcionais: `PORT` (padrão 3000) e `DB_PATH` (padrão `backend/dados.sqlite`).
Se outros computadores não conseguirem abrir o endereço, libere a porta no firewall do Windows.

## Importar a planilha de 2026

```bash
npm run importar -- "ENERGIA E ÁGUA 2026.xlsx" --ano 2026
```

- O caminho é relativo à pasta onde você digitou o comando.
- Pode ser repetido sem duplicar dados (os valores são atualizados no lugar).
- Por padrão lê as abas **"ENERGIA 2026- LIVRE (TESTE WEL)"** (valores e consumo) e **"ÁGUA 2026"**. A aba "ENERGIA 2026- LIVRE" não tem a coluna CONSUMO. Para usar outras abas: `--aba-energia "..."` e `--aba-agua "..."`.
- Hidrômetro, matrícula e localização dos pontos de água são preenchidos pelo hidrômetro quando ele consta na tabela de medidores da planilha. O que faltar, complete na tela **Cadastros**. Valores já preenchidos nunca são sobrescritos.
- Ao final o importador lista fornecedores, pontos e avisos. Confira os nomes: variações de digitação na planilha viram cadastros distintos.

## Acoplamento ao Gestão SBR

O painel abre dentro do Gestão SBR (Central de Relatórios › Manutenção › Energia e Água), pelo Protocolo de Acoplamento: o Gestão autentica no AD e entrega um token JWT HS256 de 60 s em `GET /api/auth/sso?token=...`, que vira uma sessão por cookie. Detalhes do contrato: `docs/PROTOCOLO-DE-ACOPLAMENTO.md` no repo do Gestão SBR.

- `DOCKING_SECRET`: segredo compartilhado com o Gestão (mesmo valor dos dois lados). **Definido, todas as rotas `/api` exigem a sessão do SSO.** Ausente, o painel fica aberto como antes (uso local) e o SSO responde 503.
- `SESSION_SECRET` (opcional): chave do cookie de sessão; por padrão é derivada do `DOCKING_SECRET`.
- O cookie de sessão é `SameSite=None; Secure` (o painel roda em iframe de outro site), então **precisa ser servido por HTTPS** (no .214, vhost `:443` com o wildcard `*.labsobralnet.ind`).
- `FRAME_ANCESTORS` (opcional): sobrescreve o `frame-ancestors` do CSP; o padrão libera `gestao.labsobralnet.ind` e `gestao.laboratoriosobral.com.br`.
- O `token` precisa ter `produto = painel-energia-agua` e `sub` = login AD.

Docker (o `.214` usa o auto-deploy do Gestão, que chama `docker build` e `docker run`):

```bash
docker build -t painel-energia-agua .
docker run -d -p 127.0.0.1:3011:3000 -v painel-energia-agua-data:/data --env-file .env painel-energia-agua
```

O banco fica no volume `/data` (`DB_PATH=/data/dados.sqlite`); nunca apague o volume. Para importar a planilha no container: `docker cp "ENERGIA E ÁGUA 2026.xlsx" <container>:/tmp/` e `docker exec <container> npm run importar -- /tmp/"ENERGIA E ÁGUA 2026.xlsx" --ano 2026`.

## Backup

```bash
npm run backup         # cria backend/backups/dados-AAAA-MM-DD.sqlite
```

## Testes

```bash
npm test               # backend (Vitest + Supertest) e frontend (Vitest + Testing Library)
```

## Observações

- **Não há autenticação:** qualquer pessoa na rede com o endereço pode ler e editar. Use apenas em rede interna confiável.
- Totais e médias são calculados na consulta e nunca gravados. A média mensal considera só os meses com lançamento.
- Célula vazia significa "sem lançamento"; `0` é um lançamento.
- Unidade do consumo de energia: `UNIDADE_ENERGIA` em `frontend/src/format.ts` (atualmente `MWh`; confirme se está correto).

## Estrutura

```
backend/    Express + TypeScript + SQLite (better-sqlite3) + Zod
frontend/   React + Vite + Tailwind + Recharts
docs/superpowers/specs/   design
docs/superpowers/plans/   plano de implementação
```
