import { apiRequest, ApiError, isNetworkError } from "../services/api";
import type {
  CatalogEquipment,
  CatalogLocation,
  CatalogSector,
  MovementItem,
  PublicSettings,
  SuggestionsPayload,
  TiUser
} from "../types";
import { offlineDb, saveCachedSettings, saveCachedSuggestions, type SyncQueueEntry } from "./db";

export interface SnapshotResponse {
  server_time: string;
  settings: PublicSettings;
  movements: MovementItem[];
  catalog_equipments: CatalogEquipment[];
  catalog_sectors: CatalogSector[];
  catalog_locations: CatalogLocation[];
  suggestions: SuggestionsPayload;
  users: TiUser[];
}

export interface SyncBatchResponse {
  results: Array<{
    op_id: string;
    status: "applied" | "conflict" | "error";
    record?: unknown;
    error?: string;
  }>;
  snapshot: SnapshotResponse;
}

export async function applySnapshotToLocalDb(snapshot: SnapshotResponse): Promise<void> {
  await offlineDb.transaction(
    "rw",
    [
      offlineDb.movements,
      offlineDb.equipments,
      offlineDb.sectors,
      offlineDb.locations,
      offlineDb.users,
      offlineDb.meta
    ],
    async () => {
      await offlineDb.movements.clear();
      if (snapshot.movements.length > 0) {
        await offlineDb.movements.bulkPut(snapshot.movements);
      }

      await offlineDb.equipments.clear();
      if (snapshot.catalog_equipments.length > 0) {
        await offlineDb.equipments.bulkPut(snapshot.catalog_equipments);
      }

      await offlineDb.sectors.clear();
      if (snapshot.catalog_sectors.length > 0) {
        await offlineDb.sectors.bulkPut(snapshot.catalog_sectors);
      }

      await offlineDb.locations.clear();
      if (snapshot.catalog_locations.length > 0) {
        await offlineDb.locations.bulkPut(snapshot.catalog_locations);
      }

      await offlineDb.users.clear();
      if (snapshot.users.length > 0) {
        await offlineDb.users.bulkPut(snapshot.users);
      }

      if (snapshot.settings) {
        await saveCachedSettings(snapshot.settings);
      }
      await saveCachedSuggestions(snapshot.suggestions);
      await offlineDb.meta.put({ key: "lastSyncAt", value: snapshot.server_time });
    }
  );
}

let activeSyncPromise: Promise<{ synced: number; conflicts: string[]; authExpired?: boolean }> | null = null;

export async function runSyncCycle(): Promise<{
  synced: number;
  conflicts: string[];
  authExpired?: boolean;
}> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    const queue = await offlineDb.syncQueue.orderBy("id").toArray();
    const conflicts: string[] = [];
    let synced = 0;

    try {
      if (queue.length > 0) {
        const res = await apiRequest<SyncBatchResponse>("/api/sync", {
          method: "POST",
          body: JSON.stringify({
            operations: queue.map((q) => ({
              op_id: q.op_id,
              type: q.type,
              ...(q.entity_id ? { entity_id: q.entity_id } : {}),
              ...(q.client_uuid ? { client_uuid: q.client_uuid } : {}),
              payload: q.payload
            }))
          })
        });

        const processedIds: number[] = [];
        for (const item of res.results) {
          const matched = queue.find((q) => q.op_id === item.op_id);
          if (item.status === "applied") {
            synced++;
            if (matched?.id !== undefined) processedIds.push(matched.id);
          } else {
            conflicts.push(item.error || "Erro de sincronização.");
            if (matched?.id !== undefined) processedIds.push(matched.id);
          }
        }

        if (processedIds.length > 0) {
          await offlineDb.syncQueue.bulkDelete(processedIds);
        }

        await applySnapshotToLocalDb(res.snapshot);
      } else {
        const snapshot = await apiRequest<SnapshotResponse>("/api/sync/snapshot");
        await applySnapshotToLocalDb(snapshot);
      }

      return { synced, conflicts };
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        return { synced: 0, conflicts: [], authExpired: true };
      }
      if (isNetworkError(err)) {
        return { synced: 0, conflicts: [] };
      }
      throw err;
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

export async function enqueueOfflineOperation(
  entry: Omit<SyncQueueEntry, "id" | "op_id" | "created_at">
): Promise<void> {
  await offlineDb.syncQueue.add({
    ...entry,
    op_id: crypto.randomUUID(),
    created_at: new Date().toISOString()
  });
}

export async function getPendingSyncCount(): Promise<number> {
  return offlineDb.syncQueue.count();
}
