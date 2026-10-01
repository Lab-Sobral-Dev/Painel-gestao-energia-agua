# 🔋 Painel Energia e Água 2026

Aplicação web completa para gerenciar dados de consumo de energia e água com análise, relatórios e gerenciamento centralizado.

## 🎯 Funcionalidades

- ✅ Dashboard interativo com gráficos em tempo real
- ✅ CRUD completo de consumo, fornecedores e locais
- ✅ Relatórios e análises avançadas
- ✅ Autenticação segura com JWT
- ✅ Upload de dados via Excel/CSV
- ✅ Comparações e tendências históricas
- ✅ Gerenciamento de orçamentos e metas

## 🏗️ Arquitetura

```
energia-agua-painel/
├── backend/                    # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/            # Configurações (DB, env)
│   │   ├── migrations/        # Schema e seeds
│   │   ├── middleware/        # Middleware (auth, errors)
│   │   ├── routes/            # Rotas da API
│   │   └── index.ts           # Servidor principal
│   └── package.json
├── frontend/                   # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/        # Componentes React
│   │   ├── pages/            # Páginas
│   │   ├── App.tsx           # App principal
│   │   └── main.tsx          # Entry point
│   └── package.json
└── README.md
```

## 🚀 Quick Start

### Pré-requisitos

- Node.js 18+
- PostgreSQL 12+
- npm ou yarn

### 1. Clonar e instalar

```bash
cd energia-agua-painel
npm install
```

### 2. Configurar banco de dados

```bash
# Criar arquivo .env no backend
cp backend/.env.example backend/.env

# Editar com suas credenciais PostgreSQL
# backend/.env
```

### 3. Criar schema no banco

```bash
npm run db:migrate -w backend
npm run db:seed -w backend
```

### 4. Iniciar desenvolvimento

```bash
# Terminal único (ambos runtimes)
npm run dev

# Ou em terminais separados:
npm run dev -w backend    # Port 3000
npm run dev -w frontend   # Port 5173
```

## 📊 API Endpoints

### Autenticação
```
POST   /api/auth/register        Criar novo usuário
POST   /api/auth/login           Login
POST   /api/auth/verify          Verificar token JWT
```

### Consumo
```
GET    /api/consumo              Listar todos
GET    /api/consumo/:id          Obter um
POST   /api/consumo              Criar
PUT    /api/consumo/:id          Atualizar
DELETE /api/consumo/:id          Deletar
```

### Fornecedores
```
GET    /api/fornecedor           Listar
POST   /api/fornecedor           Criar
PUT    /api/fornecedor/:id       Atualizar
DELETE /api/fornecedor/:id       Deletar
```

### Relatórios
```
GET    /api/relatorio/consumo-por-local      Por local
GET    /api/relatorio/consumo-por-mes        Por mês
GET    /api/relatorio/resumo                 Resumo geral
GET    /api/relatorio/comparacao-anual       Comparação ano a ano
```

## 🗄️ Schema do Banco

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `users` | Usuários do sistema |
| `local` | Prédios/unidades |
| `fornecedor` | Fornecedores (água, energia) |
| `consumo` | Registros de consumo |
| `consumo_historico` | Auditoria de alterações |
| `orcamento` | Metas e budgets |

## 🔐 Credenciais padrão (após seed)

```
Email: admin@energia-agua.com
Senha: senha123
```

⚠️ **MUDE ISTO EM PRODUÇÃO!**

## 🛠️ Variáveis de Ambiente

### Backend (`backend/.env`)

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=energia_agua_2026
DB_USER=postgres
DB_PASSWORD=postgres

JWT_SECRET=sua_chave_muito_segura_aqui

CORS_ORIGIN=http://localhost:5173
```

## 📦 Build para Produção

```bash
npm run build

# Backend
npm run build -w backend
npm start -w backend

# Frontend (gera dist/)
npm run build -w frontend
```

## 🧪 Testes

```bash
npm test
```

## 📝 Stack Tecnológico

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Linguagem**: TypeScript
- **Database**: PostgreSQL
- **Autenticação**: JWT + bcryptjs
- **Validação**: Zod

### Frontend
- **UI Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Gráficos**: Recharts
- **HTTP Client**: Axios
- **Linguagem**: TypeScript

## 🚀 Próximas funcionalidades

- [ ] Upload de Excel/CSV
- [ ] Integração com APIs de fornecedores
- [ ] Dashboard em tempo real (WebSocket)
- [ ] Exportação de relatórios (PDF)
- [ ] Mobile app (React Native)
- [ ] Dark mode
- [ ] Multi-tenant support

## 📚 Documentação

Consulte:
- [Backend README](./backend/README.md) - Detalhes da API
- [Frontend README](./frontend/README.md) - Detalhes do React

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a MIT License - veja o arquivo LICENSE para detalhes.

## 📞 Suporte

Para dúvidas ou problemas:
1. Abra uma issue no repositório
2. Consulte a documentação
3. Entre em contato com o time
