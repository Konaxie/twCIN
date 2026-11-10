import { Check, Clock, History, Pencil, Plus, Printer, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PageIntro } from "../components/PageIntro";
import { findCatalogSector, SectorSelector } from "../components/SectorSelector";
import { apiRequest } from "../services/api";
import type {
  AuditLogItem,
  CatalogLocation,
  CatalogSector,
  MovementItem,
  MovementType,
  SuggestionsPayload
} from "../types";

interface MovimentacoesPageProps {
  items: MovementItem[];
  sectors: CatalogSector[];
  locations: CatalogLocation[];
  suggestions: SuggestionsPayload;
  onCreate: (payload: {
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
  }) => Promise<void>;
  onUpdate: (
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
  ) => Promise<void>;
  onReturn: (item: MovementItem) => Promise<void>;
  onCreateSector: (payload: { name: string; is_default?: boolean }) => Promise<CatalogSector>;
  onRefreshCatalogs: () => Promise<void>;
  onPrintSingle: (item: MovementItem) => void;
  onPrintList: (items: MovementItem[], title?: string) => void;
  onOpenAudit: (item: MovementItem) => void;
}

function getLocalDateInput(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getLocalTimeInput(d = new Date()): string {
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

function combineDateTimeToIso(dateStr: string, timeStr: string): string {
  const combined = new Date(`${dateStr}T${timeStr}:00`);
  if (Number.isNaN(combined.getTime())) {
    return new Date().toISOString();
  }
  return combined.toISOString();
}

function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? getLocalDateInput() : getLocalDateInput(d);
}

function isoToLocalTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? getLocalTimeInput() : getLocalTimeInput(d);
}

function isSameLocalDay(iso: string, ref = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function MovimentacoesPage({
  items,
  sectors,
  locations,
  suggestions,
  onCreate,
  onUpdate,
  onReturn,
  onCreateSector,
  onRefreshCatalogs,
  onPrintSingle,
  onPrintList,
  onOpenAudit
}: MovimentacoesPageProps) {
  const [subTab, setSubTab] = useState<"operacao" | "historico" | "locais">("operacao");
  const [historyView, setHistoryView] = useState<"registros" | "logs">("registros");

  const defaultSector =
    sectors.find((s) => s.active === 1 && s.is_default === 1)?.name ||
    sectors.find((s) => s.active === 1)?.name ||
    suggestions.sectors.find((s) => s.is_default)?.name ||
    "";

  const initializedSectorRef = useRef(Boolean(defaultSector));
  const [autoNow, setAutoNow] = useState(true);
  const [nowClock, setNowClock] = useState(() => new Date());
  const [outDate, setOutDate] = useState(() => getLocalDateInput());
  const [outTime, setOutTime] = useState(() => getLocalTimeInput());
  const [equipmentId, setEquipmentId] = useState<number | null>(null);
  const [equipmentName, setEquipmentName] = useState("");
  const [patrimony, setPatrimony] = useState("");
  const [sectorName, setSectorName] = useState(defaultSector);
  const [installLocation, setInstallLocation] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [movementType, setMovementType] = useState<MovementType>("emprestimo");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSectorConfirm, setPendingSectorConfirm] = useState<{
    mode: "create" | "edit";
    sectorName: string;
  } | null>(null);

  // History & Logs states
  const [histSearch, setHistSearch] = useState("");
  const [histStatusFilter, setHistStatusFilter] = useState<"all" | "ativo" | "devolvido" | "fixo">("all");
  const [histSectorFilter, setHistSectorFilter] = useState<string>("all");
  const [movementLogs, setMovementLogs] = useState<AuditLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Sectors & Locations state
  const [newSectorName, setNewSectorName] = useState("");
  const [newSectorDefault, setNewSectorDefault] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationSectorId, setNewLocationSectorId] = useState<string>("");
  const [catError, setCatError] = useState<string | null>(null);

  const [editing, setEditing] = useState<
    (MovementItem & { editDate: string; editTime: string }) | null
  >(null);
  const [editingSec, setEditingSec] = useState<CatalogSector | null>(null);
  const [editingLoc, setEditingLoc] = useState<CatalogLocation | null>(null);

  const editDialogRef = useRef<HTMLDialogElement>(null);
  const secDialogRef = useRef<HTMLDialogElement>(null);
  const locDialogRef = useRef<HTMLDialogElement>(null);
  const submitSectorDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!autoNow) return;
    const timer = window.setInterval(() => {
      const current = new Date();
      setNowClock(current);
      setOutDate(getLocalDateInput(current));
      setOutTime(getLocalTimeInput(current));
    }, 15000);
    return () => window.clearInterval(timer);
  }, [autoNow]);

  useEffect(() => {
    if (!initializedSectorRef.current && defaultSector) {
      initializedSectorRef.current = true;
      setSectorName(defaultSector);
    }
  }, [defaultSector]);

  useEffect(() => {
    if (subTab === "historico" && historyView === "logs") {
      let cancelled = false;
      setLoadingLogs(true);
      apiRequest<{ items: AuditLogItem[] }>("/api/audit?entity=movement&limit=250")
        .then((res) => {
          if (!cancelled) setMovementLogs(res.items);
        })
        .catch(() => {
          // Offline
        })
        .finally(() => {
          if (!cancelled) setLoadingLogs(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [subTab, historyView]);

  useEffect(() => {
    const d = editDialogRef.current;
    if (!d) return;
    if (editing && !d.open) d.showModal();
    else if (!editing && d.open) d.close();
  }, [editing]);

  useEffect(() => {
    const d = secDialogRef.current;
    if (!d) return;
    if (editingSec && !d.open) d.showModal();
    else if (!editingSec && d.open) d.close();
  }, [editingSec]);

  useEffect(() => {
    const d = locDialogRef.current;
    if (!d) return;
    if (editingLoc && !d.open) d.showModal();
    else if (!editingLoc && d.open) d.close();
  }, [editingLoc]);

  useEffect(() => {
    const d = submitSectorDialogRef.current;
    if (!d) return;
    if (pendingSectorConfirm && !d.open) d.showModal();
    else if (!pendingSectorConfirm && d.open) d.close();
  }, [pendingSectorConfirm]);

  useEffect(() => {
    const bind = (ref: React.RefObject<HTMLDialogElement | null>, clear: () => void) => {
      const d = ref.current;
      if (!d) return () => {};
      const onClose = () => {
        d.returnValue = "";
        clear();
      };
      d.addEventListener("close", onClose);
      return () => d.removeEventListener("close", onClose);
    };
    const c1 = bind(editDialogRef, () => setEditing(null));
    const c2 = bind(secDialogRef, () => setEditingSec(null));
    const c3 = bind(locDialogRef, () => setEditingLoc(null));
    const c4 = bind(submitSectorDialogRef, () => setPendingSectorConfirm(null));
    return () => {
      c1();
      c2();
      c3();
      c4();
    };
  }, []);

  const activeMovements = items.filter((m) => m.status === "ativo");
  const returnedCount = items.filter((m) => m.status === "devolvido").length;
  const fixedCount = items.filter((m) => m.status === "fixo").length;
  const todayCount = items.filter((m) => isSameLocalDay(m.out_at)).length;

  const filteredActive = activeMovements.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.document_code.toLowerCase().includes(q) ||
      m.equipment_name.toLowerCase().includes(q) ||
      m.patrimony.toLowerCase().includes(q) ||
      m.sector_name.toLowerCase().includes(q) ||
      m.install_location.toLowerCase().includes(q) ||
      m.received_by.toLowerCase().includes(q)
    );
  });

  const filteredHistory = items.filter((m) => {
    if (histStatusFilter !== "all" && m.status !== histStatusFilter) return false;
    if (histSectorFilter !== "all" && m.sector_name !== histSectorFilter) return false;
    if (!histSearch.trim()) return true;
    const q = histSearch.toLowerCase();
    return (
      m.document_code.toLowerCase().includes(q) ||
      m.equipment_name.toLowerCase().includes(q) ||
      m.patrimony.toLowerCase().includes(q) ||
      m.sector_name.toLowerCase().includes(q) ||
      m.install_location.toLowerCase().includes(q) ||
      m.received_by.toLowerCase().includes(q) ||
      m.registered_by_name.toLowerCase().includes(q)
    );
  });

  const filteredLogs = movementLogs.filter((log) => {
    if (!histSearch.trim()) return true;
    const q = histSearch.toLowerCase();
    return (
      log.summary.toLowerCase().includes(q) ||
      log.user_name.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q)
    );
  });

  const handleEquipmentChange = (val: string) => {
    setEquipmentName(val);
    const match = suggestions.equipments.find(
      (e) => e.name.toLowerCase() === val.trim().toLowerCase()
    );
    if (match) {
      setEquipmentId(match.id);
      if (match.patrimony) setPatrimony(match.patrimony);
    } else {
      setEquipmentId(null);
    }
  };

  const handlePatrimonyChange = (val: string) => {
    setPatrimony(val);
    const trimmed = val.trim().toLowerCase();
    if (!trimmed) return;
    const match = suggestions.equipments.find(
      (e) => e.patrimony && e.patrimony.toLowerCase() === trimmed
    );
    if (match) {
      setEquipmentId(match.id);
      setEquipmentName(match.name);
    }
  };

  const handleToggleAutoNow = (checked: boolean) => {
    setAutoNow(checked);
    const current = new Date();
    setNowClock(current);
    setOutDate(getLocalDateInput(current));
    setOutTime(getLocalTimeInput(current));
  };

  const executeCreate = async (resolvedSector: { id?: number | null; name: string }) => {
    setError(null);
    setSaving(true);
    try {
      const exactNow = new Date();
      const timestampIso = autoNow
        ? exactNow.toISOString()
        : combineDateTimeToIso(outDate, outTime);

      await onCreate({
        movement_type: movementType,
        equipment_id: equipmentId,
        equipment_name: equipmentName,
        patrimony,
        sector_id: resolvedSector.id && resolvedSector.id > 0 ? resolvedSector.id : null,
        sector_name: resolvedSector.name,
        install_location: installLocation.trim(),
        received_by: receivedBy,
        notes,
        out_at: timestampIso
      });

      const resetTime = new Date();
      setNowClock(resetTime);
      setOutDate(getLocalDateInput(resetTime));
      setOutTime(getLocalTimeInput(resetTime));
      setEquipmentId(null);
      setEquipmentName("");
      setPatrimony("");
      setSectorName(defaultSector);
      setInstallLocation("");
      setReceivedBy("");
      setMovementType("emprestimo");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar movimentação.");
    } finally {
      setSaving(false);
    }
  };

  const executeEditSave = async (
    target: MovementItem & { editDate: string; editTime: string },
    resolvedSector: { id?: number | null; name: string }
  ) => {
    setError(null);
    setSaving(true);
    try {
      await onUpdate(target, {
        movement_type: target.movement_type,
        equipment_name: target.equipment_name,
        patrimony: target.patrimony,
        sector_id: resolvedSector.id && resolvedSector.id > 0 ? resolvedSector.id : null,
        sector_name: resolvedSector.name,
        install_location: target.install_location,
        received_by: target.received_by,
        notes: target.notes,
        out_at: combineDateTimeToIso(target.editDate, target.editTime)
      });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar alterações.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const trimmedSector = sectorName.trim();
    const matchedCatalog = findCatalogSector(sectors, trimmedSector);
    if (!matchedCatalog && trimmedSector) {
      setPendingSectorConfirm({ mode: "create", sectorName: trimmedSector });
      return;
    }
    await executeCreate({
      id: matchedCatalog?.id ?? null,
      name: matchedCatalog?.name ?? trimmedSector
    });
  };

  const handleEditSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    const trimmedSector = editing.sector_name.trim();
    const matchedCatalog = findCatalogSector(sectors, trimmedSector);
    if (!matchedCatalog && trimmedSector) {
      setPendingSectorConfirm({ mode: "edit", sectorName: trimmedSector });
      return;
    }
    await executeEditSave(editing, {
      id: matchedCatalog?.id ?? null,
      name: matchedCatalog?.name ?? trimmedSector
    });
  };

  const handleConfirmPendingSubmitSector = async () => {
    if (!pendingSectorConfirm) return;
    setSaving(true);
    setError(null);
    try {
      const created = await onCreateSector({ name: pendingSectorConfirm.sectorName });
      const { mode } = pendingSectorConfirm;
      setPendingSectorConfirm(null);
      if (mode === "create") {
        await executeCreate({ id: created.id, name: created.name });
      } else if (editing) {
        await executeEditSave(editing, { id: created.id, name: created.name });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar setor.");
      setSaving(false);
    }
  };

  const handleAddSector = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCatError(null);
    try {
      await onCreateSector({ name: newSectorName, is_default: newSectorDefault });
      setNewSectorName("");
      setNewSectorDefault(false);
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Erro ao cadastrar setor.");
    }
  };

  const handlePromoteExistingSector = async (name: string) => {
    setCatError(null);
    try {
      await onCreateSector({ name, is_default: false });
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Erro ao configurar setor.");
    }
  };

  const handleAddLocation = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCatError(null);
    try {
      await apiRequest("/api/catalogs/locations", {
        method: "POST",
        body: JSON.stringify({
          name: newLocationName,
          sector_id: newLocationSectorId ? Number(newLocationSectorId) : null
        })
      });
      setNewLocationName("");
      setNewLocationSectorId("");
      await onRefreshCatalogs();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Erro ao cadastrar local.");
    }
  };

  const handleSaveSecEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSec) return;
    setCatError(null);
    try {
      await apiRequest(`/api/catalogs/sectors/${editingSec.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editingSec.name,
          is_default: editingSec.is_default === 1,
          active: editingSec.active === 1
        })
      });
      setEditingSec(null);
      await onRefreshCatalogs();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Erro ao editar setor.");
    }
  };

  const handleSaveLocEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingLoc) return;
    setCatError(null);
    try {
      await apiRequest(`/api/catalogs/locations/${editingLoc.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editingLoc.name,
          sector_id: editingLoc.sector_id,
          active: editingLoc.active === 1
        })
      });
      setEditingLoc(null);
      await onRefreshCatalogs();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Erro ao editar local.");
    }
  };

  const sectorNamesForFilter = Array.from(new Set(items.map((m) => m.sector_name))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  return (
    <div className="space-y-5">
      <PageIntro
        title="Movimentações"
        purpose="Gerencia saídas, empréstimos, instalações fixas, devoluções, histórico completo e o cadastro de setores e locais."
        howTo={[
          "Em Registrar e Fora de, lance a saída de equipamentos, selecione ou crie setores e dê baixa na devolução.",
          "Em Histórico e Logs, filtre movimentações anteriores, veja a trilha de auditoria e exporte relatórios em PDF.",
          "Em Setores e Locais, configure os setores existentes (inclusive setor padrão) e associe locais de destino."
        ]}
      />

      {/* Sub-navigation bar inside Movimentações */}
      <div
        className="rounded-xl border p-3 flex flex-wrap items-center justify-between gap-3"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab("operacao")}
            className="px-3.5 py-2 rounded-lg text-sm font-medium border cursor-pointer"
            style={
              subTab === "operacao"
                ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)", borderColor: "var(--brand)" }
                : { borderColor: "var(--border)", color: "var(--text-muted)" }
            }
          >
            Registrar e Fora de ({activeMovements.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("historico")}
            className="px-3.5 py-2 rounded-lg text-sm font-medium border cursor-pointer"
            style={
              subTab === "historico"
                ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)", borderColor: "var(--brand)" }
                : { borderColor: "var(--border)", color: "var(--text-muted)" }
            }
          >
            Histórico e Logs ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("locais")}
            className="px-3.5 py-2 rounded-lg text-sm font-medium border cursor-pointer"
            style={
              subTab === "locais"
                ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)", borderColor: "var(--brand)" }
                : { borderColor: "var(--border)", color: "var(--text-muted)" }
            }
          >
            Setores e Locais
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: REGISTRAR, AMOSTRAGEM & FORA DE */}
      {subTab === "operacao" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Form */}
          <section
            className="lg:col-span-5 rounded-xl border p-5 shadow-sm space-y-4"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-base font-semibold">Registrar Movimentação</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Auto Date/Time Option + Manual Inputs */}
              <div
                className="p-3 rounded-lg border space-y-2.5"
                style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
              >
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoNow}
                    onChange={(e) => handleToggleAutoNow(e.target.checked)}
                  />
                  <span>Usar data e hora atuais ao registrar</span>
                </label>

                {autoNow ? (
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      Será registrado com a hora atual ({getLocalDateInput(nowClock).split("-").reverse().join("/")}{" "}
                      {getLocalTimeInput(nowClock)})
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="mov-date" className="block text-xs font-medium mb-1">
                        Data <span aria-hidden="true">*</span>
                      </label>
                      <input
                        id="mov-date"
                        type="date"
                        required
                        value={outDate}
                        onChange={(e) => setOutDate(e.target.value)}
                        className="tw-input"
                      />
                    </div>
                    <div>
                      <label htmlFor="mov-time" className="block text-xs font-medium mb-1">
                        Hora <span aria-hidden="true">*</span>
                      </label>
                      <input
                        id="mov-time"
                        type="time"
                        required
                        value={outTime}
                        onChange={(e) => setOutTime(e.target.value)}
                        className="tw-input"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="mov-equip" className="block text-xs font-medium mb-1">
                  Equipamento <span aria-hidden="true">*</span>
                </label>
                <input
                  id="mov-equip"
                  list="mov-equip-list"
                  required
                  value={equipmentName}
                  onChange={(e) => handleEquipmentChange(e.target.value)}
                  placeholder="Nome ou seleção"
                  className="tw-input"
                />
                <datalist id="mov-equip-list">
                  {suggestions.equipments.map((eq, idx) => (
                    <option key={`${eq.name}-${idx}`} value={eq.name}>
                      {eq.patrimony || ""}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mov-pat" className="block text-xs font-medium mb-1">
                    Nº do patrimônio
                  </label>
                  <input
                    id="mov-pat"
                    list="mov-pat-list"
                    value={patrimony}
                    onChange={(e) => handlePatrimonyChange(e.target.value)}
                    placeholder="PAT-0000"
                    className="tw-input font-mono"
                  />
                  <datalist id="mov-pat-list">
                    {suggestions.equipments
                      .filter((eq) => eq.patrimony)
                      .map((eq, idx) => (
                        <option key={`${eq.patrimony}-${idx}`} value={eq.patrimony}>
                          {eq.name}
                        </option>
                      ))}
                  </datalist>
                </div>

                <div>
                  <label htmlFor="mov-sector" className="block text-xs font-medium mb-1">
                    Setor de destino <span aria-hidden="true">*</span>
                  </label>
                  <SectorSelector
                    id="mov-sector"
                    required
                    value={sectorName}
                    onChange={setSectorName}
                    sectors={sectors}
                    suggestedNames={suggestions.sectors.map((s) => s.name)}
                    onCreateSector={onCreateSector}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mov-local" className="block text-xs font-medium mb-1">
                    Local de instalação <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="mov-local"
                    list="mov-local-list"
                    required
                    value={installLocation}
                    onChange={(e) => setInstallLocation(e.target.value)}
                    placeholder="Sala ou ambiente"
                    className="tw-input"
                  />
                  <datalist id="mov-local-list">
                    {suggestions.locations.map((loc) => (
                      <option key={loc} value={loc} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label htmlFor="mov-receiver" className="block text-xs font-medium mb-1">
                    Recebido por
                  </label>
                  <input
                    id="mov-receiver"
                    list="mov-people-list"
                    value={receivedBy}
                    onChange={(e) => setReceivedBy(e.target.value)}
                    placeholder="Nome do recebedor"
                    className="tw-input"
                  />
                  <datalist id="mov-people-list">
                    {suggestions.people.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
              </div>

              <fieldset className="pt-1">
                <legend className="text-xs font-medium mb-1.5">Tipo de saída</legend>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="movement_type"
                      value="emprestimo"
                      checked={movementType === "emprestimo"}
                      onChange={() => setMovementType("emprestimo")}
                    />
                    <span>Empréstimo</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="movement_type"
                      value="instalacao_fixa"
                      checked={movementType === "instalacao_fixa"}
                      onChange={() => setMovementType("instalacao_fixa")}
                    />
                    <span>Instalação fixa</span>
                  </label>
                </div>
              </fieldset>

              <div>
                <label htmlFor="mov-notes" className="block text-xs font-medium mb-1">
                  Observações
                </label>
                <input
                  id="mov-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="tw-input"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="px-3 py-2 rounded-lg text-sm border"
                  style={{
                    backgroundColor: "var(--cin-red-soft)",
                    borderColor: "var(--cin-red)",
                    color: "var(--cin-red)"
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[44px] rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
              >
                {saving ? "Salvando..." : "Registrar saída"}
              </button>
            </form>
          </section>

          {/* Right Column: Amostragem + Fora de */}
          <div className="lg:col-span-7 space-y-5">
            {/* Área de Amostragem */}
            <section
              className="rounded-xl border p-5 shadow-sm space-y-3"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-base font-semibold">Amostragem de Movimentações</h2>
                <button
                  type="button"
                  onClick={() => setSubTab("historico")}
                  className="text-xs font-semibold cursor-pointer"
                  style={{ color: "var(--brand)" }}
                >
                  Ver histórico completo
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Fora de</span>
                  <div className="text-xl font-bold mt-0.5" style={{ color: "var(--brand)" }}>
                    {activeMovements.length}
                  </div>
                </div>
                <div className="p-3 rounded-lg border" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Hoje</span>
                  <div className="text-xl font-bold mt-0.5">{todayCount}</div>
                </div>
                <div className="p-3 rounded-lg border" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Devoluções</span>
                  <div className="text-xl font-bold mt-0.5" style={{ color: "var(--ok)" }}>
                    {returnedCount}
                  </div>
                </div>
                <div className="p-3 rounded-lg border" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Instalações fixas</span>
                  <div className="text-xl font-bold mt-0.5">{fixedCount}</div>
                </div>
              </div>

              {items.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    Últimos registros
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {items.slice(0, 4).map((sample) => (
                      <div
                        key={sample.client_uuid}
                        className="p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2"
                        style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            <span className="font-mono mr-1.5" style={{ color: "var(--text-muted)" }}>
                              {sample.document_code}
                            </span>
                            {sample.equipment_name}
                          </div>
                          <div className="truncate" style={{ color: "var(--text-muted)" }}>
                            {sample.sector_name} — {sample.install_location}
                          </div>
                        </div>
                        <span
                          className="px-2 py-0.5 rounded font-medium shrink-0"
                          style={
                            sample.status === "ativo"
                              ? { backgroundColor: "var(--brand-soft)", color: "var(--brand)" }
                              : sample.status === "devolvido"
                                ? { backgroundColor: "var(--ok-soft)", color: "var(--ok)" }
                                : { backgroundColor: "var(--surface-alt)", color: "var(--text-muted)" }
                          }
                        >
                          {sample.status === "ativo"
                            ? "Fora"
                            : sample.status === "devolvido"
                              ? "Devolvido"
                              : "Fixo"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Seção Fora de */}
            <section
              className="rounded-xl border p-5 shadow-sm space-y-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-base font-semibold">Fora de ({activeMovements.length})</h2>
                <search className="flex items-center gap-2">
                  <input
                    type="search"
                    aria-label="Filtrar Fora de"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filtrar..."
                    className="tw-input sm:w-52"
                  />
                  <button
                    type="button"
                    onClick={() => onPrintList(filteredActive, "Equipamentos Fora de")}
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg text-xs font-medium border cursor-pointer shrink-0"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <Printer className="w-4 h-4" aria-hidden="true" />
                    Gerar PDF
                  </button>
                </search>
              </div>

              {filteredActive.length === 0 ? (
                <p className="text-sm py-3" style={{ color: "var(--text-muted)" }}>
                  Nenhum equipamento aguardando devolução.
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredActive.map((m) => (
                    <article
                      key={m.client_uuid}
                      className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                            {m.document_code}
                          </span>
                          <strong className="text-sm">{m.equipment_name}</strong>
                          {m.patrimony && (
                            <span
                              className="font-mono text-xs px-2 py-0.5 rounded border"
                              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                            >
                              {m.patrimony}
                            </span>
                          )}
                          {m._pendingSync && (
                            <span className="text-xs font-semibold" style={{ color: "var(--warn)" }}>
                              Pendente sync
                            </span>
                          )}
                        </div>
                        <div className="text-xs flex flex-wrap gap-x-3 gap-y-1" style={{ color: "var(--text-muted)" }}>
                          <span>
                            <strong>Setor:</strong> {m.sector_name}
                          </span>
                          <span>
                            <strong>Local:</strong> {m.install_location}
                          </span>
                          {m.received_by && (
                            <span>
                              <strong>Recebido por:</strong> {m.received_by}
                            </span>
                          )}
                          <span>
                            <strong>Saída:</strong> {new Date(m.out_at).toLocaleString("pt-BR")}
                          </span>
                          <span>
                            <strong>TI:</strong> {m.registered_by_name}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onPrintSingle(m)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditing({
                              ...m,
                              editDate: isoToLocalDate(m.out_at),
                              editTime: isoToLocalTime(m.out_at)
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          Editar
                        </button>
                        {m.id > 0 && (
                          <button
                            type="button"
                            onClick={() => onOpenAudit(m)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer"
                            style={{ borderColor: "var(--border)" }}
                          >
                            <History className="w-3.5 h-3.5" aria-hidden="true" />
                            Logs
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void onReturn(m)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                          style={{ backgroundColor: "var(--ok)", color: "#ffffff" }}
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          Devolvido
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: HISTÓRICO E LOGS DE MOVIMENTAÇÃO */}
      {subTab === "historico" && (
        <section
          className="rounded-xl border p-5 shadow-sm space-y-4"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setHistoryView("registros")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer"
                style={
                  historyView === "registros"
                    ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)", borderColor: "var(--brand)" }
                    : { borderColor: "var(--border)", color: "var(--text-muted)" }
                }
              >
                Histórico de Movimentações ({filteredHistory.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryView("logs")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer"
                style={
                  historyView === "logs"
                    ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)", borderColor: "var(--brand)" }
                    : { borderColor: "var(--border)", color: "var(--text-muted)" }
                }
              >
                Logs de Movimentação
              </button>
            </div>

            <search className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                aria-label="Filtrar histórico de movimentações"
                value={histSearch}
                onChange={(e) => setHistSearch(e.target.value)}
                placeholder="Buscar código, equipamento, local..."
                className="tw-input sm:w-56"
              />
              {historyView === "registros" && (
                <>
                  <select
                    aria-label="Filtrar situação"
                    value={histStatusFilter}
                    onChange={(e) => setHistStatusFilter(e.target.value as typeof histStatusFilter)}
                    className="tw-input sm:w-36"
                  >
                    <option value="all">Todas situações</option>
                    <option value="ativo">Fora</option>
                    <option value="devolvido">Devolvido</option>
                    <option value="fixo">Instalação fixa</option>
                  </select>
                  <select
                    aria-label="Filtrar setor"
                    value={histSectorFilter}
                    onChange={(e) => setHistSectorFilter(e.target.value)}
                    className="tw-input sm:w-40"
                  >
                    <option value="all">Todos os setores</option>
                    {sectorNamesForFilter.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onPrintList(filteredHistory, "Histórico Completo de Movimentações")}
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-lg text-xs font-medium border cursor-pointer shrink-0"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <Printer className="w-4 h-4" aria-hidden="true" />
                    Exportar PDF
                  </button>
                </>
              )}
            </search>
          </div>

          {historyView === "registros" && (
            <div tabIndex={0} role="region" aria-label="Histórico completo de movimentações" className="table-wrapper">
              <table className="responsive-table w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    <th scope="col" className="py-2 pr-3">Código</th>
                    <th scope="col" className="py-2 pr-3">Equipamento</th>
                    <th scope="col" className="py-2 pr-3">Setor / Local</th>
                    <th scope="col" className="py-2 pr-3">Recebido por</th>
                    <th scope="col" className="py-2 pr-3">Saída / TI</th>
                    <th scope="col" className="py-2 pr-3">Situação</th>
                    <th scope="col" className="py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((m) => (
                    <tr key={m.client_uuid} className="border-b text-xs" style={{ borderColor: "var(--border)" }}>
                      <td data-label="Código" className="py-2.5 pr-3 font-mono">{m.document_code}</td>
                      <td data-label="Equipamento" className="py-2.5 pr-3">
                        <strong>{m.equipment_name}</strong>
                        {m.patrimony ? ` (${m.patrimony})` : ""}
                      </td>
                      <td data-label="Setor / Local" className="py-2.5 pr-3">
                        {m.sector_name} — {m.install_location}
                      </td>
                      <td data-label="Recebido por" className="py-2.5 pr-3">{m.received_by || "-"}</td>
                      <td data-label="Saída / TI" className="py-2.5 pr-3">
                        {new Date(m.out_at).toLocaleString("pt-BR")} ({m.registered_by_name})
                      </td>
                      <td data-label="Situação" className="py-2.5 pr-3">
                        {m.status === "devolvido"
                          ? `Devolvido em ${new Date(m.returned_at || m.updated_at).toLocaleString("pt-BR")} (${m.returned_to_name || "-"})`
                          : m.status === "fixo"
                            ? "Instalação fixa"
                            : "Fora"}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => onPrintSingle(m)}
                          className="px-2.5 py-1 rounded border cursor-pointer"
                          style={{ borderColor: "var(--border)" }}
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEditing({
                              ...m,
                              editDate: isoToLocalDate(m.out_at),
                              editTime: isoToLocalTime(m.out_at)
                            })
                          }
                          className="px-2.5 py-1 rounded border cursor-pointer"
                          style={{ borderColor: "var(--border)" }}
                        >
                          Editar
                        </button>
                        {m.id > 0 && (
                          <button
                            type="button"
                            onClick={() => onOpenAudit(m)}
                            className="px-2.5 py-1 rounded border cursor-pointer"
                            style={{ borderColor: "var(--border)" }}
                          >
                            Logs
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredHistory.length === 0 && (
                <p className="text-sm py-4" style={{ color: "var(--text-muted)" }}>
                  Nenhuma movimentação encontrada.
                </p>
              )}
            </div>
          )}

          {historyView === "logs" && (
            <div className="space-y-2.5">
              {loadingLogs && <p className="text-sm" style={{ color: "var(--text-muted)" }}>Carregando logs...</p>}
              {!loadingLogs && filteredLogs.length === 0 && (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhum log de movimentação encontrado.</p>
              )}
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="px-2 py-0.5 rounded font-semibold"
                        style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}
                      >
                        {log.action}
                      </span>
                      <strong>{log.user_name}</strong>
                      {log.entity_id && (
                        <span style={{ color: "var(--text-muted)" }}>Movimento #{log.entity_id}</span>
                      )}
                    </div>
                    <p className="text-sm">{log.summary}</p>
                  </div>
                  <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* SUB-TAB 3: SETORES E LOCAIS INTEGRADOS À MOVIMENTAÇÃO */}
      {subTab === "locais" && (
        <div className="space-y-4">
          {catError && (
            <div
              role="alert"
              className="px-4 py-2.5 rounded-lg border text-sm"
              style={{
                backgroundColor: "var(--cin-red-soft)",
                borderColor: "var(--cin-red)",
                color: "var(--cin-red)"
              }}
            >
              {catError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <section
              className="rounded-xl border p-5 shadow-sm space-y-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-base font-semibold">Setores de Destino</h2>
              </div>

              <form onSubmit={handleAddSector} className="space-y-2.5">
                <div className="flex gap-2">
                  <input
                    aria-label="Nome do setor"
                    required
                    value={newSectorName}
                    onChange={(e) => setNewSectorName(e.target.value)}
                    placeholder="Nome do setor"
                    className="tw-input flex-1"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] px-4 rounded-lg text-sm font-semibold cursor-pointer shrink-0"
                    style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                  >
                    Adicionar
                  </button>
                </div>
                <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSectorDefault}
                    onChange={(e) => setNewSectorDefault(e.target.checked)}
                  />
                  <span>Definir como setor padrão nas movimentações</span>
                </label>
              </form>

              <div className="space-y-2">
                {sectors.map((sec) => (
                  <div
                    key={sec.id}
                    className="px-3 py-2 rounded-lg border flex items-center justify-between gap-2 text-xs"
                    style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center gap-2">
                      <strong className="text-sm">{sec.name}</strong>
                      {sec.is_default === 1 && (
                        <span
                          className="px-2 py-0.5 rounded font-semibold"
                          style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}
                        >
                          Padrão
                        </span>
                      )}
                      {sec.active === 0 && <span style={{ color: "var(--cin-red)" }}>Inativo</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingSec({ ...sec })}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border cursor-pointer"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <Pencil className="w-3 h-3" aria-hidden="true" />
                      Editar
                    </button>
                  </div>
                ))}
                {sectors.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Nenhum setor cadastrado.
                  </p>
                )}
              </div>

              {suggestions.sectors.some((s) => s.id === null) && (
                <div
                  className="pt-3 border-t space-y-2"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    Setores usados em movimentações ainda não configurados no catálogo
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.sectors
                      .filter((s) => s.id === null)
                      .map((sec) => (
                        <button
                          key={sec.name}
                          type="button"
                          onClick={() => handlePromoteExistingSector(sec.name)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer"
                          style={{
                            backgroundColor: "var(--bg)",
                            borderColor: "var(--border)"
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Cadastrar &ldquo;{sec.name}&rdquo;</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </section>

            <section
              className="rounded-xl border p-5 shadow-sm space-y-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-base font-semibold">Locais de Movimentação</h2>
              </div>

              <form onSubmit={handleAddLocation} className="space-y-2.5">
                <div className="flex gap-2">
                  <input
                    aria-label="Nome do local"
                    required
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    placeholder="Ex: Sala 104, Auditório..."
                    className="tw-input flex-1"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] px-4 rounded-lg text-sm font-semibold cursor-pointer shrink-0"
                    style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                  >
                    Adicionar
                  </button>
                </div>
                <select
                  aria-label="Setor associado"
                  value={newLocationSectorId}
                  onChange={(e) => setNewLocationSectorId(e.target.value)}
                  className="tw-input"
                >
                  <option value="">Sem vínculo específico com setor</option>
                  {sectors
                    .filter((s) => s.active === 1)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        Setor: {s.name}
                      </option>
                    ))}
                </select>
              </form>

              <div className="space-y-2 max-h-72 overflow-auto">
                {locations.map((loc) => {
                  const linkedSector = sectors.find((s) => s.id === loc.sector_id);
                  return (
                    <div
                      key={loc.id}
                      className="px-3 py-2 rounded-lg border flex items-center justify-between gap-2 text-xs"
                      style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
                    >
                      <div>
                        <strong className="text-sm">{loc.name}</strong>
                        <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                          {linkedSector && <span>Setor: {linkedSector.name}</span>}
                          {loc.active === 0 && <span style={{ color: "var(--cin-red)" }}>Inativo</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingLoc({ ...loc })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border cursor-pointer"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <Pencil className="w-3 h-3" aria-hidden="true" />
                        Editar
                      </button>
                    </div>
                  );
                })}
                {locations.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Nenhum local cadastrado.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Edit Movement Dialog */}
      <dialog
        ref={editDialogRef}
        aria-labelledby="edit-mov-title"
        className="m-auto w-[min(94vw,620px)] rounded-xl p-0 overflow-auto shadow-xl"
      >
        {editing && (
          <form onSubmit={handleEditSave} className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <h2 id="edit-mov-title" className="text-base font-semibold">
                Editar {editing.document_code}
              </h2>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg border cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Data</label>
                <input
                  type="date"
                  required
                  value={editing.editDate}
                  onChange={(e) => setEditing({ ...editing, editDate: e.target.value })}
                  className="tw-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Hora</label>
                <input
                  type="time"
                  required
                  value={editing.editTime}
                  onChange={(e) => setEditing({ ...editing, editTime: e.target.value })}
                  className="tw-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Equipamento</label>
                <input
                  required
                  value={editing.equipment_name}
                  onChange={(e) => setEditing({ ...editing, equipment_name: e.target.value })}
                  className="tw-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Nº do patrimônio</label>
                <input
                  value={editing.patrimony}
                  onChange={(e) => setEditing({ ...editing, patrimony: e.target.value })}
                  className="tw-input font-mono"
                />
              </div>
              <div>
                <label htmlFor="edit-mov-sector" className="block text-xs font-medium mb-1">
                  Setor
                </label>
                <SectorSelector
                  id="edit-mov-sector"
                  required
                  value={editing.sector_name}
                  onChange={(nextName) => setEditing({ ...editing, sector_name: nextName })}
                  sectors={sectors}
                  suggestedNames={suggestions.sectors.map((s) => s.name)}
                  onCreateSector={onCreateSector}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Local de instalação</label>
                <input
                  required
                  value={editing.install_location}
                  onChange={(e) => setEditing({ ...editing, install_location: e.target.value })}
                  className="tw-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Recebido por</label>
                <input
                  value={editing.received_by}
                  onChange={(e) => setEditing({ ...editing, received_by: e.target.value })}
                  className="tw-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Tipo</label>
                <select
                  value={editing.movement_type}
                  onChange={(e) =>
                    setEditing({ ...editing, movement_type: e.target.value as MovementType })
                  }
                  className="tw-input"
                >
                  <option value="emprestimo">Empréstimo</option>
                  <option value="instalacao_fixa">Instalação fixa</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1">Observações</label>
                <textarea
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  className="tw-textarea"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg text-sm border cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
              >
                Salvar alterações
              </button>
            </div>
          </form>
        )}
      </dialog>

      {/* Edit Sector Dialog */}
      <dialog ref={secDialogRef} aria-labelledby="edit-sec-title" className="m-auto w-[min(94vw,420px)] rounded-xl p-5 shadow-xl">
        {editingSec && (
          <form onSubmit={handleSaveSecEdit} className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
              <h3 id="edit-sec-title" className="text-sm font-semibold">Editar Setor</h3>
              <button type="button" aria-label="Fechar" onClick={() => setEditingSec(null)} className="p-1 rounded border cursor-pointer" style={{ borderColor: "var(--border)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Nome</label>
              <input required value={editingSec.name} onChange={(e) => setEditingSec({ ...editingSec, name: e.target.value })} className="tw-input" />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={editingSec.is_default === 1} onChange={(e) => setEditingSec({ ...editingSec, is_default: e.target.checked ? 1 : 0 })} />
              <span>Setor padrão</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={editingSec.active === 1} onChange={(e) => setEditingSec({ ...editingSec, active: e.target.checked ? 1 : 0 })} />
              <span>Ativo</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingSec(null)} className="px-3 py-1.5 rounded-lg text-xs border cursor-pointer" style={{ borderColor: "var(--border)" }}>Cancelar</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>Salvar</button>
            </div>
          </form>
        )}
      </dialog>

      {/* Edit Location Dialog */}
      <dialog ref={locDialogRef} aria-labelledby="edit-loc-title" className="m-auto w-[min(94vw,420px)] rounded-xl p-5 shadow-xl">
        {editingLoc && (
          <form onSubmit={handleSaveLocEdit} className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
              <h3 id="edit-loc-title" className="text-sm font-semibold">Editar Local</h3>
              <button type="button" aria-label="Fechar" onClick={() => setEditingLoc(null)} className="p-1 rounded border cursor-pointer" style={{ borderColor: "var(--border)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Nome</label>
              <input required value={editingLoc.name} onChange={(e) => setEditingLoc({ ...editingLoc, name: e.target.value })} className="tw-input" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Setor associado</label>
              <select
                value={editingLoc.sector_id ?? ""}
                onChange={(e) =>
                  setEditingLoc({ ...editingLoc, sector_id: e.target.value ? Number(e.target.value) : null })
                }
                className="tw-input"
              >
                <option value="">Sem vínculo específico</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={editingLoc.active === 1} onChange={(e) => setEditingLoc({ ...editingLoc, active: e.target.checked ? 1 : 0 })} />
              <span>Ativo</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingLoc(null)} className="px-3 py-1.5 rounded-lg text-xs border cursor-pointer" style={{ borderColor: "var(--border)" }}>Cancelar</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}>Salvar</button>
            </div>
          </form>
        )}
      </dialog>

      {/* Confirm new sector creation when submitting movement with manual uncatalogued sector */}
      <dialog
        ref={submitSectorDialogRef}
        aria-labelledby="submit-sec-confirm-title"
        className="m-auto w-[min(94vw,430px)] rounded-xl p-5 shadow-xl"
      >
        {pendingSectorConfirm && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
              <h3 id="submit-sec-confirm-title" className="text-sm font-semibold">
                Confirmar criação de setor
              </h3>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setPendingSectorConfirm(null)}
                className="p-1 rounded border cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm">
              O setor <strong>{pendingSectorConfirm.sectorName}</strong> não existe no catálogo. Deseja criá-lo agora e registrar a movimentação?
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingSectorConfirm(null)}
                className="px-3.5 py-2 rounded-lg text-xs border cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmPendingSubmitSector}
                className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
              >
                {saving ? "Salvando..." : "Sim, criar setor e continuar"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
