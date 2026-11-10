import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

function ensureColumn(
  db: DatabaseSync,
  table: string,
  column: string,
  definition: string
): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      token_version INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      password_changed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_equipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_uuid TEXT,
      name TEXT NOT NULL,
      patrimony TEXT UNIQUE,
      category TEXT NOT NULL DEFAULT '',
      ownership_type TEXT NOT NULL DEFAULT 'proprio_ti',
      condition_status TEXT NOT NULL DEFAULT 'disponivel',
      origin TEXT NOT NULL DEFAULT '',
      received_from TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      version INTEGER NOT NULL DEFAULT 1,
      created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_by_name TEXT NOT NULL DEFAULT '',
      updated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_by_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_sectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_default INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sector_id INTEGER REFERENCES catalog_sectors(id) ON DELETE SET NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_uuid TEXT NOT NULL UNIQUE,
      document_code TEXT NOT NULL UNIQUE,
      movement_type TEXT NOT NULL DEFAULT 'emprestimo',
      equipment_id INTEGER REFERENCES catalog_equipments(id) ON DELETE SET NULL,
      equipment_name TEXT NOT NULL,
      patrimony TEXT NOT NULL DEFAULT '',
      sector_id INTEGER REFERENCES catalog_sectors(id) ON DELETE SET NULL,
      sector_name TEXT NOT NULL,
      install_location TEXT NOT NULL DEFAULT '',
      received_by TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ativo',
      version INTEGER NOT NULL DEFAULT 1,
      out_at TEXT NOT NULL,
      returned_at TEXT,
      registered_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      registered_by_name TEXT NOT NULL,
      returned_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      returned_to_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id INTEGER,
      summary TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      ip_address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_movements_status ON movements(status, out_at DESC);
    CREATE INDEX IF NOT EXISTS idx_movements_equipment ON movements(equipment_id, out_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
  `);

  ensureColumn(db, "users", "must_change_password", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "users", "token_version", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "users", "last_login_at", "TEXT");
  ensureColumn(db, "users", "password_changed_at", "TEXT");

  ensureColumn(db, "catalog_equipments", "client_uuid", "TEXT");
  ensureColumn(db, "catalog_equipments", "ownership_type", "TEXT NOT NULL DEFAULT 'proprio_ti'");
  ensureColumn(db, "catalog_equipments", "condition_status", "TEXT NOT NULL DEFAULT 'disponivel'");
  ensureColumn(db, "catalog_equipments", "origin", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "catalog_equipments", "received_from", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "catalog_equipments", "reason", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "catalog_equipments", "notes", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "catalog_equipments", "version", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "catalog_equipments", "created_by_id", "INTEGER REFERENCES users(id) ON DELETE SET NULL");
  ensureColumn(db, "catalog_equipments", "created_by_name", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "catalog_equipments", "updated_by_id", "INTEGER REFERENCES users(id) ON DELETE SET NULL");
  ensureColumn(db, "catalog_equipments", "updated_by_name", "TEXT NOT NULL DEFAULT ''");

  const missingUuids = db
    .prepare("SELECT id FROM catalog_equipments WHERE client_uuid IS NULL OR client_uuid = ''")
    .all() as Array<{ id: number }>;
  const updateUuid = db.prepare("UPDATE catalog_equipments SET client_uuid = ? WHERE id = ?");
  for (const row of missingUuids) {
    updateUuid.run(crypto.randomUUID(), row.id);
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_equip_client_uuid ON catalog_equipments(client_uuid);
    CREATE INDEX IF NOT EXISTS idx_equip_condition ON catalog_equipments(condition_status, ownership_type);
  `);
}
