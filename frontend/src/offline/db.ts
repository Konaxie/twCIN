import Dexie, { type Table } from "dexie";
import type {
  AuthUser,
  CatalogEquipment,
  CatalogLocation,
  CatalogSector,
  MovementItem,
  PublicSettings,
  SuggestionsPayload,
  TiUser
} from "../types";

export interface SyncQueueEntry {
  id?: number;
  op_id: string;
  type:
    | "equipment.create"
    | "equipment.update"
    | "movement.create"
    | "movement.update"
    | "movement.return"
    | "sector.create";
  entity_id?: number;
  client_uuid?: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

class TwCinOfflineDb extends Dexie {
  movements!: Table<MovementItem, string>;
  equipments!: Table<CatalogEquipment, string>;
  sectors!: Table<CatalogSector, number>;
  locations!: Table<CatalogLocation, number>;
  users!: Table<TiUser, number>;
  syncQueue!: Table<SyncQueueEntry, number>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super("twcin_offline_v2");
    this.version(1).stores({
      movements: "client_uuid, id, status, out_at",
      equipments: "client_uuid, id, name, patrimony, ownership_type, condition_status",
      sectors: "id, name, is_default",
      locations: "id, name",
      users: "id, username",
      syncQueue: "++id, op_id, type, created_at",
      meta: "key"
    });
  }
}

export const offlineDb = new TwCinOfflineDb();

export async function saveCachedUser(user: AuthUser | null): Promise<void> {
  if (!user) {
    await offlineDb.meta.delete("currentUser");
    return;
  }
  await offlineDb.meta.put({ key: "currentUser", value: user });
}

export async function getCachedUser(): Promise<AuthUser | null> {
  const row = await offlineDb.meta.get("currentUser");
  return (row?.value as AuthUser | undefined) ?? null;
}

export async function saveCachedSettings(settings: PublicSettings): Promise<void> {
  await offlineDb.meta.put({ key: "settings", value: settings });
}

export async function getCachedSettings(): Promise<PublicSettings> {
  const row = await offlineDb.meta.get("settings");
  return (
    (row?.value as PublicSettings | undefined) ?? {
      app_name: "twCIN",
      org_name: "Setor de TI",
      logo_data_url: ""
    }
  );
}

export async function saveCachedSuggestions(suggestions: SuggestionsPayload): Promise<void> {
  await offlineDb.meta.put({ key: "suggestions", value: suggestions });
}

export async function getCachedSuggestions(): Promise<SuggestionsPayload> {
  const row = await offlineDb.meta.get("suggestions");
  return (
    (row?.value as SuggestionsPayload | undefined) ?? {
      equipments: [],
      sectors: [],
      locations: [],
      people: []
    }
  );
}
