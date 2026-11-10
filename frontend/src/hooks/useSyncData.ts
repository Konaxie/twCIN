import { useCallback, useEffect, useState } from "react";
import {
  getCachedSettings,
  getCachedSuggestions,
  offlineDb,
  type SyncQueueEntry
} from "../offline/db";
import {
  enqueueOfflineOperation,
  getPendingSyncCount,
  runSyncCycle
} from "../offline/syncEngine";
import { apiRequest, isNetworkError } from "../services/api";
import type {
  AuthUser,
  CatalogEquipment,
  CatalogLocation,
  CatalogSector,
  EquipmentCondition,
  EquipmentOwnership,
  MovementItem,
  MovementType,
  PublicSettings,
  SuggestionsPayload,
  TiUser
} from "../types";

export function useSyncData(
  user: AuthUser | null,
  onSessionExpired: () => void,
  onSettingsSynced?: (settings: PublicSettings) => void
) {
  const [movements, setMovements] = useState<MovementItem[]>([]);
  const [equipments, setEquipments] = useState<CatalogEquipment[]>([]);
  const [sectors, setSectors] = useState<CatalogSector[]>([]);
  const [locations, setLocations] = useState<CatalogLocation[]>([]);
  const [users, setUsers] = useState<TiUser[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionsPayload>({
    equipments: [],
    sectors: [],
    locations: [],
    people: []
  });
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const loadFromLocalDb = useCallback(async () => {
    const [m, eq, sec, loc, usr, sug, cachedSettings, pend] = await Promise.all([
      offlineDb.movements.toArray(),
      offlineDb.equipments.toArray(),
      offlineDb.sectors.toArray(),
      offlineDb.locations.toArray(),
      offlineDb.users.toArray(),
      getCachedSuggestions(),
      getCachedSettings(),
      getPendingSyncCount()
    ]);

    if (onSettingsSynced) {
      onSettingsSynced(cachedSettings);
    }

    m.sort((x, y) => y.out_at.localeCompare(x.out_at));
    eq.sort((x, y) => y.updated_at.localeCompare(x.updated_at));
    sec.sort((x, y) => {
      if (x.is_default !== y.is_default) return y.is_default - x.is_default;
      return x.name.localeCompare(y.name, "pt-BR");
    });
    loc.sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));

    setMovements(m);
    setEquipments(eq);
    setSectors(sec);
    setLocations(loc);
    setUsers(usr);
    setSuggestions(sug);
    setPendingCount(pend);
  }, [onSettingsSynced]);

  const syncNow = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const result = await runSyncCycle();
      if (result.authExpired) {
        onSessionExpired();
        return;
      }
      if (result.conflicts.length > 0) {
        setSyncNotice(result.conflicts[0]);
      }
      await loadFromLocalDb();
    } catch {
      await loadFromLocalDb();
    } finally {
      setSyncing(false);
    }
  }, [user, loadFromLocalDb, onSessionExpired]);

  useEffect(() => {
    if (!user) return;
    void loadFromLocalDb().then(() => syncNow());

    const handleOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const handleOffline = () => {
      setOnline(false);
    };
    const handleFocus = () => {
      if (navigator.onLine) {
        void syncNow();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);

    const interval = window.setInterval(() => {
      if (navigator.onLine) {
        void syncNow();
      }
    }, 20000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(interval);
    };
  }, [user, loadFromLocalDb, syncNow]);

  const queueMutation = async (
    entry: Omit<SyncQueueEntry, "id" | "op_id" | "created_at">
  ) => {
    await enqueueOfflineOperation(entry);
    await loadFromLocalDb();
  };

  const createEquipment = async (payload: {
    name: string;
    patrimony?: string;
    category?: string;
    ownership_type: EquipmentOwnership;
    condition_status: EquipmentCondition;
    origin?: string;
    received_from?: string;
    reason?: string;
    notes?: string;
  }): Promise<void> => {
    if (!user) return;
    const client_uuid = crypto.randomUUID();
    const now = new Date().toISOString();

    if (navigator.onLine) {
      try {
        await apiRequest<{ item: CatalogEquipment }>("/api/catalogs/equipments", {
          method: "POST",
          body: JSON.stringify({ ...payload, client_uuid })
        });
        await syncNow();
        return;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    const optimistic: CatalogEquipment = {
      id: -Date.now(),
      client_uuid,
      name: payload.name.trim(),
      patrimony: payload.patrimony?.trim() || null,
      category: payload.category?.trim() || "",
      ownership_type: payload.ownership_type,
      condition_status: payload.condition_status,
      origin: payload.origin?.trim() || "",
      received_from: payload.received_from?.trim() || "",
      reason: payload.reason?.trim() || "",
      notes: payload.notes?.trim() || "",
      active: 1,
      version: 1,
      created_by_id: user.id,
      created_by_name: user.full_name,
      updated_by_id: user.id,
      updated_by_name: user.full_name,
      created_at: now,
      updated_at: now,
      _pendingSync: true
    };
    await offlineDb.equipments.put(optimistic);
    await queueMutation({
      type: "equipment.create",
      client_uuid,
      payload: { ...payload, client_uuid }
    });
  };

  const updateEquipment = async (
    item: CatalogEquipment,
    patch: Partial<{
      name: string;
      patrimony: string;
      category: string;
      ownership_type: EquipmentOwnership;
      condition_status: EquipmentCondition;
      origin: string;
      received_from: string;
      reason: string;
      notes: string;
      active: boolean;
    }>
  ): Promise<void> => {
    if (!user) return;
    const now = new Date().toISOString();

    if (navigator.onLine && item.id > 0) {
      try {
        await apiRequest<{ item: CatalogEquipment }>(`/api/catalogs/equipments/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...patch, expected_version: item.version })
        });
        await syncNow();
        return;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    const updatedLocal: CatalogEquipment = {
      ...item,
      ...patch,
      patrimony:
        patch.patrimony !== undefined ? patch.patrimony.trim() || null : item.patrimony,
      active: patch.active !== undefined ? (patch.active ? 1 : 0) : item.active,
      updated_by_id: user.id,
      updated_by_name: user.full_name,
      updated_at: now,
      _pendingSync: true
    };
    await offlineDb.equipments.put(updatedLocal);
    await queueMutation({
      type: "equipment.update",
      ...(item.id > 0 ? { entity_id: item.id } : { client_uuid: item.client_uuid }),
      payload: { ...patch, ...(item.id > 0 ? { expected_version: item.version } : {}) }
    });
  };

  const createMovement = async (payload: {
    movement_type: MovementType;
    equipment_id?: number | null;
    equipment_name: string;
    patrimony?: string;
    sector_id?: number | null;
    sector_name: string;
    install_location: string;
    received_by?: string;
    notes?: string;
    out_at: string;
  }): Promise<void> => {
    if (!user) return;
    const client_uuid = crypto.randomUUID();
    const now = new Date().toISOString();

    if (navigator.onLine) {
      try {
        await apiRequest<{ item: MovementItem }>("/api/movements", {
          method: "POST",
          body: JSON.stringify({ ...payload, client_uuid })
        });
        await syncNow();
        return;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    const optimistic: MovementItem = {
      id: -Date.now(),
      client_uuid,
      document_code: "PENDENTE",
      movement_type: payload.movement_type,
      equipment_id: payload.equipment_id ?? null,
      equipment_name: payload.equipment_name.trim(),
      patrimony: payload.patrimony?.trim() || "",
      sector_id: payload.sector_id ?? null,
      sector_name: payload.sector_name.trim(),
      install_location: payload.install_location.trim(),
      received_by: payload.received_by?.trim() || "",
      notes: payload.notes?.trim() || "",
      status: payload.movement_type === "instalacao_fixa" ? "fixo" : "ativo",
      version: 1,
      out_at: payload.out_at,
      returned_at: null,
      registered_by_id: user.id,
      registered_by_name: user.full_name,
      returned_to_id: null,
      returned_to_name: null,
      created_at: now,
      updated_at: now,
      _pendingSync: true
    };
    await offlineDb.movements.put(optimistic);
    await queueMutation({
      type: "movement.create",
      client_uuid,
      payload: { ...payload, client_uuid }
    });
  };

  const updateMovement = async (
    item: MovementItem,
    patch: Partial<{
      movement_type: MovementType;
      equipment_id: number | null;
      equipment_name: string;
      patrimony: string;
      sector_id: number | null;
      sector_name: string;
      install_location: string;
      received_by: string;
      notes: string;
      out_at: string;
    }>
  ): Promise<void> => {
    if (!user) return;
    const now = new Date().toISOString();

    if (navigator.onLine && item.id > 0) {
      try {
        await apiRequest<{ item: MovementItem }>(`/api/movements/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...patch, expected_version: item.version })
        });
        await syncNow();
        return;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    const updatedLocal: MovementItem = {
      ...item,
      ...patch,
      updated_at: now,
      _pendingSync: true
    };
    await offlineDb.movements.put(updatedLocal);
    await queueMutation({
      type: "movement.update",
      ...(item.id > 0 ? { entity_id: item.id } : { client_uuid: item.client_uuid }),
      payload: { ...patch, ...(item.id > 0 ? { expected_version: item.version } : {}) }
    });
  };

  const returnMovement = async (item: MovementItem): Promise<void> => {
    if (!user) return;
    const now = new Date().toISOString();

    if (navigator.onLine && item.id > 0) {
      try {
        await apiRequest<{ item: MovementItem }>(`/api/movements/${item.id}/return`, {
          method: "POST",
          body: JSON.stringify({ returned_at: now, expected_version: item.version })
        });
        await syncNow();
        return;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    const updatedLocal: MovementItem = {
      ...item,
      status: "devolvido",
      returned_at: now,
      returned_to_id: user.id,
      returned_to_name: user.full_name,
      updated_at: now,
      _pendingSync: true
    };
    await offlineDb.movements.put(updatedLocal);
    await queueMutation({
      type: "movement.return",
      ...(item.id > 0 ? { entity_id: item.id } : { client_uuid: item.client_uuid }),
      payload: { returned_at: now, ...(item.id > 0 ? { expected_version: item.version } : {}) }
    });
  };

  const createSector = async (payload: {
    name: string;
    is_default?: boolean;
  }): Promise<CatalogSector> => {
    const trimmed = payload.name.trim();
    const existingLocal = sectors.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (existingLocal) {
      return existingLocal;
    }

    if (navigator.onLine) {
      try {
        const res = await apiRequest<{ item: CatalogSector }>("/api/catalogs/sectors", {
          method: "POST",
          body: JSON.stringify({ name: trimmed, is_default: Boolean(payload.is_default) })
        });
        await syncNow();
        return res.item;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    const now = new Date().toISOString();
    const optimistic: CatalogSector = {
      id: -Date.now(),
      name: trimmed,
      is_default: payload.is_default ? 1 : 0,
      active: 1,
      created_at: now,
      updated_at: now
    };
    await offlineDb.sectors.put(optimistic);
    await queueMutation({
      type: "sector.create",
      payload: { name: trimmed, is_default: Boolean(payload.is_default) }
    });
    return optimistic;
  };

  return {
    movements,
    equipments,
    sectors,
    locations,
    users,
    suggestions,
    online,
    pendingCount,
    syncing,
    syncNotice,
    clearSyncNotice: () => setSyncNotice(null),
    syncNow,
    createEquipment,
    updateEquipment,
    createMovement,
    updateMovement,
    returnMovement,
    createSector
  };
}
