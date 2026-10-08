FROM node:22-bookworm-slim

# better-sqlite3 compila se não houver binário pré-compilado para a plataforma.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci

COPY . .
RUN npm run build

# Banco SQLite no volume /data (não apagar). Sem DOCKING_SECRET o painel fica aberto:
# em produção sempre passar DOCKING_SECRET (mesmo valor do Gestão SBR) via --env-file.
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/dados.sqlite
RUN mkdir /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3000
CMD ["node", "backend/dist/index.js"]
