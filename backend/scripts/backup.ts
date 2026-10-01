import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const origem = process.env.DB_PATH ?? path.resolve(__dirname, '..', 'dados.sqlite');
const pasta = path.resolve(__dirname, '..', 'backups');
fs.mkdirSync(pasta, { recursive: true });
const destino = path.join(pasta, `dados-${new Date().toISOString().slice(0, 10)}.sqlite`);

const db = new Database(origem, { fileMustExist: true });
db.backup(destino).then(() => {
  console.log('Backup criado em', destino);
  db.close();
});
