import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env";
import { logger } from "../utils/logger";

let db: Database.Database | null = null;

/**
 * Abre (criando se necessario) o banco SQLite e garante que as tabelas
 * existam. Chamado uma vez na inicializacao do bot (src/index.ts).
 */
export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(path.dirname(env.dbPath), { recursive: true });
  db = new Database(env.dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_name TEXT NOT NULL,
      price_current REAL NOT NULL,
      price_original REAL,
      original_link TEXT NOT NULL UNIQUE,
      image_url TEXT,
      source TEXT NOT NULL,
      category TEXT,
      collected_at TEXT NOT NULL DEFAULT (datetime('now')),

      -- pending_review: aguardando filtro; awaiting_approval: passou no filtro
      -- e esta na fila do WhatsApp; approved / rejected: resposta manual;
      -- discarded: reprovado pelo filtro automatico; posted: publicado no grupo
      status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (status IN (
          'pending_review', 'awaiting_approval', 'approved',
          'rejected', 'discarded', 'posted'
        )),

      affiliate_link TEXT,
      posted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
    CREATE INDEX IF NOT EXISTS idx_offers_source ON offers(source);
  `);

  logger.info({ dbPath: env.dbPath }, "Banco de dados pronto");
  return db;
}
