import path from 'node:path';
import { createApp } from './app';
import { configDoAmbiente } from './acoplamento';
import { openDb } from './db';

const porta = Number(process.env.PORT ?? 3000);
const arquivo = process.env.DB_PATH ?? path.resolve(__dirname, '..', 'dados.sqlite');

const db = openDb(arquivo);
const acoplamento = configDoAmbiente();
const app = createApp(db, { staticDir: path.resolve(__dirname, '../../frontend/dist'), acoplamento });

app.listen(porta, '0.0.0.0', () => {
  console.log(`Painel Energia e Água em http://localhost:${porta} (banco: ${arquivo})`);
  if (!acoplamento.dockingSecret) console.warn('DOCKING_SECRET ausente: painel aberto, sem login (uso local).');
});
