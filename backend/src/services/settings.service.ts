import type { DatabaseSync } from "node:sqlite";
import { withTransaction } from "../db/connection.js";
import { writeAuditLog } from "../security/audit.js";
import type { AuthUser } from "../security/auth.js";

export interface PublicSettings {
  app_name: string;
  org_name: string;
  logo_data_url: string;
}

export function getPublicSettings(db: DatabaseSync): PublicSettings {
  const rows = db.prepare("SELECT key, value FROM app_settings").all() as Array<{
    key: string;
    value: string;
  }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    app_name: map.get("app_name") || "twCIN",
    org_name: map.get("org_name") || "Setor de TI",
    logo_data_url: map.get("logo_data_url") || ""
  };
}

export function updatePublicSettings(
  db: DatabaseSync,
  input: Partial<PublicSettings>,
  actor: AuthUser,
  ipAddress: string
): PublicSettings {
  const before = getPublicSettings(db);
  const now = new Date().toISOString();

  return withTransaction(db, () => {
    const upsert = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    if (input.app_name !== undefined) {
      upsert.run("app_name", input.app_name.trim(), now);
    }
    if (input.org_name !== undefined) {
      upsert.run("org_name", input.org_name.trim(), now);
    }
    if (input.logo_data_url !== undefined) {
      upsert.run("logo_data_url", input.logo_data_url, now);
    }

    const after = getPublicSettings(db);
    writeAuditLog(db, {
      userId: actor.id,
      userName: actor.full_name,
      action: "UPDATE",
      entity: "app_settings",
      summary: `Configurações da organização atualizadas (${after.app_name} / ${after.org_name})`,
      before: { app_name: before.app_name, org_name: before.org_name, has_logo: Boolean(before.logo_data_url) },
      after: { app_name: after.app_name, org_name: after.org_name, has_logo: Boolean(after.logo_data_url) },
      ipAddress
    });

    return after;
  });
}
