import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

declare global {
  var __reviewDb: Database.Database | undefined;
}

const useLocalFilePersistence = shouldUseLocalFilePersistence();
const dbPath = resolveDatabasePath(useLocalFilePersistence);
const db = global.__reviewDb ?? new Database(dbPath);

if (!global.__reviewDb) {
  db.pragma(`journal_mode = ${useLocalFilePersistence ? "WAL" : "MEMORY"}`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      task_id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_name TEXT NOT NULL,
      version TEXT NOT NULL,
      owner TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS images (
      image_id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      comparison_index INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL CHECK(type IN ('design', 'implementation', 'diff')),
      width INTEGER NOT NULL DEFAULT 0,
      height INTEGER NOT NULL DEFAULT 0,
      url TEXT NOT NULL,
      FOREIGN KEY(task_id) REFERENCES tasks(task_id)
    );

    CREATE TABLE IF NOT EXISTS issues (
      issue_id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      comparison_index INTEGER NOT NULL DEFAULT 0,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('high', 'medium', 'low')),
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(task_id) REFERENCES tasks(task_id)
    );

    CREATE TABLE IF NOT EXISTS comparison_regions (
      task_id INTEGER NOT NULL,
      comparison_index INTEGER NOT NULL,
      regions_json TEXT NOT NULL,
      PRIMARY KEY (task_id, comparison_index),
      FOREIGN KEY(task_id) REFERENCES tasks(task_id)
    );

    CREATE INDEX IF NOT EXISTS idx_images_task_id ON images(task_id);
    CREATE INDEX IF NOT EXISTS idx_issues_task_id ON issues(task_id);
    CREATE INDEX IF NOT EXISTS idx_regions_task_id ON comparison_regions(task_id);
  `);

  ensureColumnExists("images", "comparison_index", "INTEGER NOT NULL DEFAULT 0");
  ensureColumnExists("images", "width", "INTEGER NOT NULL DEFAULT 0");
  ensureColumnExists("images", "height", "INTEGER NOT NULL DEFAULT 0");
  ensureColumnExists("issues", "comparison_index", "INTEGER NOT NULL DEFAULT 0");
  db.exec("CREATE INDEX IF NOT EXISTS idx_images_task_comparison ON images(task_id, comparison_index);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_issues_task_comparison ON issues(task_id, comparison_index);");

  global.__reviewDb = db;
}

export default db;

function ensureColumnExists(table: string, column: string, definition: string): void {
  const columns = db
    .prepare(`PRAGMA table_info(${table})`)
    .all() as Array<{ name: string }>;

  if (columns.some((item) => item.name === column)) {
    return;
  }

  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function shouldUseLocalFilePersistence(): boolean {
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  if (process.env.VERCEL === "1") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

function resolveDatabasePath(useLocalPersistence: boolean): string {
  if (!useLocalPersistence) {
    return ":memory:";
  }

  const dbDir = path.join(process.cwd(), "data");

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  return path.join(dbDir, "review.db");
}
