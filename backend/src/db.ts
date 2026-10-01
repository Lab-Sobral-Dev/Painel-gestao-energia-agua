import Database from 'better-sqlite3';
import { SCHEMA } from './schema';

export function openDb(file: string): Database.Database {
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
