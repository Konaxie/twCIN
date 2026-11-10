import type { DatabaseSync } from "node:sqlite";
import type { z } from "zod";
import type { syncOperationSchema } from "../schemas/index.js";
import type { AuthUser } from "../security/auth.js";
import {
  createCatalogEquipment,
  createCatalogSector,
  getSuggestions,
  listCatalogEquipments,
  listCatalogLocations,
  listCatalogSectors,
  updateCatalogEquipment
} from "./catalogs.service.js";
import { ConflictError, NotFoundError } from "./errors.js";
import { createMovement, listMovements, returnMovement, updateMovement } from "./movements.service.js";
import { getPublicSettings } from "./settings.service.js";
import { listUsers } from "./users.service.js";

export type SyncOperation = z.infer<typeof syncOperationSchema>;

export interface SyncOpResult {
  op_id: string;
  status: "applied" | "conflict" | "error";
  record?: unknown;
  error?: string;
}

export function processSyncBatch(
  db: DatabaseSync,
  operations: SyncOperation[],
  actor: AuthUser,
  ipAddress: string
): SyncOpResult[] {
  const results: SyncOpResult[] = [];

  for (const op of operations) {
    try {
      switch (op.type) {
        case "equipment.create": {
          const created = createCatalogEquipment(db, op.payload, actor, ipAddress);
          results.push({ op_id: op.op_id, status: "applied", record: created });
          break;
        }
        case "equipment.update": {
          const updated = updateCatalogEquipment(
            db,
            { id: op.entity_id, clientUuid: op.client_uuid },
            op.payload,
            actor,
            ipAddress
          );
          results.push({ op_id: op.op_id, status: "applied", record: updated });
          break;
        }
        case "movement.create": {
          const created = createMovement(db, op.payload, actor, ipAddress);
          results.push({ op_id: op.op_id, status: "applied", record: created });
          break;
        }
        case "movement.update": {
          const updated = updateMovement(
            db,
            { id: op.entity_id, clientUuid: op.client_uuid },
            op.payload,
            actor,
            ipAddress
          );
          results.push({ op_id: op.op_id, status: "applied", record: updated });
          break;
        }
        case "movement.return": {
          const returned = returnMovement(
            db,
            { id: op.entity_id, clientUuid: op.client_uuid },
            op.payload,
            actor,
            ipAddress
          );
          results.push({ op_id: op.op_id, status: "applied", record: returned });
          break;
        }
        case "sector.create": {
          const existing = db
            .prepare("SELECT * FROM catalog_sectors WHERE LOWER(name) = LOWER(?)")
            .get(op.payload.name.trim());
          const sector = existing ?? createCatalogSector(db, op.payload, actor, ipAddress);
          results.push({ op_id: op.op_id, status: "applied", record: sector });
          break;
        }
      }
    } catch (err) {
      if (err instanceof ConflictError) {
        results.push({
          op_id: op.op_id,
          status: "conflict",
          record: (err.details as { current?: unknown } | undefined)?.current,
          error: err.message
        });
      } else if (err instanceof NotFoundError) {
        results.push({ op_id: op.op_id, status: "error", error: err.message });
      } else {
        results.push({
          op_id: op.op_id,
          status: "error",
          error: err instanceof Error ? err.message : "Erro ao processar sincronização."
        });
      }
    }
  }

  return results;
}

export function buildSyncSnapshot(db: DatabaseSync) {
  return {
    server_time: new Date().toISOString(),
    settings: getPublicSettings(db),
    movements: listMovements(db, { includeFinished: true }),
    catalog_equipments: listCatalogEquipments(db, true),
    catalog_sectors: listCatalogSectors(db, true),
    catalog_locations: listCatalogLocations(db, true),
    suggestions: getSuggestions(db),
    users: listUsers(db)
  };
}
