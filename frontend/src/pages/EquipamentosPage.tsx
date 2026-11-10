import { Eye, History, Pencil, Printer, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PageIntro } from "../components/PageIntro";
import { apiRequest } from "../services/api";
import type {
  CatalogEquipment,
  EquipmentCondition,
  EquipmentOwnership,
  MovementItem
} from "../types";

interface EquipamentosPageProps {
  equipments: CatalogEquipment[];
  movements: MovementItem[];
  onCreate: (payload: {
    name: string;
    patrimony?: string;
    category?: string;
    ownership_type: EquipmentOwnership;
    condition_status: EquipmentCondition;
    origin?: string;
    received_from?: string;
    reason?: string;
    notes?: string;
  }) => Promise<void>;
  onUpdate: (
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
  ) => Promise<void>;
  onOpenAudit: (item: CatalogEquipment) => void;
  onPrintReport: (items: CatalogEquipment[]) => void;
}

const OWNERSHIP_LABELS: Record<EquipmentOwnership, string> = {
  proprio_ti: "Próprio do TI",
  estoque: "Em estoque",
  terceiro: "Recebido de terceiros / setor"
};

const CONDITION_LABELS: Record<EquipmentCondition, string> = {
  disponivel: "Disponível",
  em_uso: "Em uso",
  manutencao: "Manutenção",
  avaliacao: "Avaliação",
  emprestado: "Emprestado",
  descartado: "Descartado"
};

export function EquipamentosPage({
  equipments,
  movements,
  onCreate,
  onUpdate,
  onOpenAudit,
  onPrintReport
}: EquipamentosPageProps) {
  const [name, setName] = useState("");
  const [patrimony, setPatrimony] = useState("");
  const [category, setCategory] = useState("");
  const [ownershipType, setOwnershipType] = useState<EquipmentOwnership>("proprio_ti");
  const [conditionStatus, setConditionStatus] = useState<EquipmentCondition>("disponivel");
  const [origin, setOrigin] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const [filterView, setFilterView] = useState<
    "all" | "proprio_ti" | "estoque" | "terceiro" | "atencao" | "inactive"
  >("all");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedEq, setSelectedEq] = useState<CatalogEquipment | null>(null);
  const [selectedMovements, setSelectedMovements] = useState<MovementItem[]>([]);
  const [editing, setEditing] = useState<CatalogEquipment | null>(null);

  const detailsDialogRef = useRef<HTMLDialogElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = detailsDialogRef.current;
    if (!d) return;
    if (selectedEq && !d.open) d.showModal();
    else if (!selectedEq && d.open) d.close();
  }, [selectedEq]);

  useEffect(() => {
    const d = editDialogRef.current;
    if (!d) return;
    if (editing && !d.open) d.showModal();
    else if (!editing && d.open) d.close();
  }, [editing]);

  useEffect(() => {
    const d1 = detailsDialogRef.current;
    const d2 = editDialogRef.current;
    const c1 = () => {
      if (d1) d1.returnValue = "";
      setSelectedEq(null);
    };
    const c2 = () => {
      if (d2) d2.returnValue = "";
      setEditing(null);
    };
    d1?.addEventListener("close", c1);
    d2?.addEventListener("close", c2);
    return () => {
      d1?.removeEventListener("close", c1);
      d2?.removeEventListener("close", c2);
    };
  }, []);

  const openDetails = async (eq: CatalogEquipment) => {
    setSelectedEq(eq);
    const localMatches = movements.filter((m) => m.equipment_id === eq.id);
    setSelectedMovements(localMatches);
    if (eq.id > 0 && navigator.onLine) {
      try {
        const res = await apiRequest<{ item: CatalogEquipment; movements: MovementItem[] }>(
          `/api/catalogs/equipments/${eq.id}`
        );
        setSelectedMovements(res.movements);
      } catch {
        // Keep cached matches when offline
      }
    }
  };

  const filtered = equipments.filter((eq) => {
    if (filterView === "inactive") {
      if (eq.active !== 0) return false;
    } else {
      if (eq.active !== 1) return false;
      if (filterView === "proprio_ti" && eq.ownership_type !== "proprio_ti") return false;
      if (filterView === "estoque" && eq.ownership_type !== "estoque") return false;
      if (filterView === "terceiro" && eq.ownership_type !== "terceiro") return false;
      if (
        filterView === "atencao" &&
        eq.condition_status !== "manutencao" &&
        eq.condition_status !== "avaliacao"
      ) {
        return false;
      }
    }

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      eq.name.toLowerCase().includes(q) ||
      (eq.patrimony || "").toLowerCase().includes(q) ||
      eq.category.toLowerCase().includes(q) ||
      eq.origin.toLowerCase().includes(q) ||
      eq.received_from.toLowerCase().includes(q) ||
      eq.reason.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onCreate({
        name,
        patrimony,
        category,
        ownership_type: ownershipType,
        condition_status: conditionStatus,
        origin,
        received_from: receivedFrom,
        reason,
        notes
      });
      setName("");
      setPatrimony("");
      setCategory("");
      setOwnershipType("proprio_ti");
      setConditionStatus("disponivel");
      setOrigin("");
      setReceivedFrom("");
      setReason("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar equipamento.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    setError(null);
    setSaving(true);
    try {
      await onUpdate(editing, {
        name: editing.name,
        patrimony: editing.patrimony || "",
        category: editing.category,
        ownership_type: editing.ownership_type,
        condition_status: editing.condition_status,
        origin: editing.origin,
        received_from: editing.received_from,
        reason: editing.reason,
        notes: editing.notes,
        active: editing.active === 1
      });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao editar equipamento.");
    } finally {
      setSaving(false);
    }
  };

  const conditionBadgeStyle = (status: EquipmentCondition) => {
    if (status === "disponivel" || status === "em_uso") {
      return { backgroundColor: "var(--ok-soft)", color: "var(--ok)" };
    }
    if (status === "manutencao" || status === "avaliacao") {
      return { backgroundColor: "var(--warn-soft)", color: "var(--warn)" };
    }
    if (status === "descartado") {
      return { backgroundColor: "var(--cin-red-soft)", color: "var(--cin-red)" };
    }
    return { backgroundColor: "var(--brand-soft)", color: "var(--brand)" };
  };

  return (
    <div className="space-y-5">
      <PageIntro
        title="Equipamentos"
        purpose="Controla o acervo sob responsabilidade do TI, diferenciando itens próprios, estoque e equipamentos recebidos de terceiros."
        howTo={[
          "Cadastre o equipamento informando tipo, situação e, quando aplicável, origem e de quem foi recebido.",
          "Filtre por Próprio do TI, Estoque, Terceiros ou Manutenção/Avaliação para achar itens rápido.",
          "Abra Detalhes, Editar ou Histórico na tabela para consultar movimentações ou atualizar o status."
        ]}
      />

      <section
        className="rounded-xl border p-5 shadow-sm space-y-4"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="border-b pb-3" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold">Novo Equipamento</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label htmlFor="eq-name" className="block text-xs font-medium mb-1">
                Equipamento <span aria-hidden="true">*</span>
              </label>
              <input
                id="eq-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Notebook Dell Latitude"
                className="tw-input"
              />
            </div>

            <div>
              <label htmlFor="eq-pat" className="block text-xs font-medium mb-1">
                Nº do patrimônio
              </label>
              <input
                id="eq-pat"
                value={patrimony}
                onChange={(e) => setPatrimony(e.target.value)}
                placeholder="PAT-0000"
                className="tw-input font-mono"
              />
            </div>

            <div>
              <label htmlFor="eq-cat" className="block text-xs font-medium mb-1">
                Categoria
              </label>
              <input
                id="eq-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Notebook, PC, Projetor..."
                className="tw-input"
              />
            </div>

            <div>
              <label htmlFor="eq-ownership" className="block text-xs font-medium mb-1">
                Vínculo / Posse
              </label>
              <select
                id="eq-ownership"
                value={ownershipType}
                onChange={(e) => setOwnershipType(e.target.value as EquipmentOwnership)}
                className="tw-input"
              >
                <option value="proprio_ti">Próprio do TI</option>
                <option value="estoque">Em estoque</option>
                <option value="terceiro">Recebido de terceiros / setor</option>
              </select>
            </div>

            <div>
              <label htmlFor="eq-condition" className="block text-xs font-medium mb-1">
                Situação
              </label>
              <select
                id="eq-condition"
                value={conditionStatus}
                onChange={(e) => setConditionStatus(e.target.value as EquipmentCondition)}
                className="tw-input"
              >
                <option value="disponivel">Disponível</option>
                <option value="em_uso">Em uso</option>
                <option value="manutencao">Manutenção</option>
                <option value="avaliacao">Avaliação</option>
                <option value="emprestado">Emprestado</option>
                <option value="descartado">Descartado</option>
              </select>
            </div>

            <div>
              <label htmlFor="eq-origin" className="block text-xs font-medium mb-1">
                Origem
              </label>
              <input
                id="eq-origin"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Setor, sala ou fornecedor"
                className="tw-input"
              />
            </div>

            <div>
              <label htmlFor="eq-received" className="block text-xs font-medium mb-1">
                Recebido de
              </label>
              <input
                id="eq-received"
                value={receivedFrom}
                onChange={(e) => setReceivedFrom(e.target.value)}
                placeholder="Pessoa que entregou"
                className="tw-input"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="eq-reason" className="block text-xs font-medium mb-1">
                Motivo de estar sob responsabilidade do TI
              </label>
              <input
                id="eq-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Reserva técnica, formatação, avaliação de placa..."
                className="tw-input"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <div className="flex-1">
              <label htmlFor="eq-notes" className="block text-xs font-medium mb-1">
                Observações
              </label>
              <input
                id="eq-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="tw-input"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-5 rounded-lg text-sm font-semibold cursor-pointer shrink-0 disabled:opacity-60"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
            >
              {saving ? "Salvando..." : "Cadastrar equipamento"}
            </button>
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
        </form>
      </section>

      <section
        className="rounded-xl border p-5 shadow-sm space-y-4"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: "all", label: "Todos" },
              { key: "proprio_ti", label: "Próprios do TI" },
              { key: "estoque", label: "Em estoque" },
              { key: "terceiro", label: "Terceiros / Setores" },
              { key: "atencao", label: "Manutenção / Avaliação" },
              { key: "inactive", label: "Inativos" }
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterView(tab.key as typeof filterView)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer"
                style={
                  filterView === tab.key
                    ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)", borderColor: "var(--brand)" }
                    : { borderColor: "var(--border)", color: "var(--text-muted)" }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          <search className="flex items-center gap-2">
            <input
              type="search"
              aria-label="Buscar equipamentos"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nome, patrimônio, origem..."
              className="tw-input sm:w-64"
            />
            <button
              type="button"
              onClick={() => onPrintReport(filtered)}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-lg text-xs font-medium border cursor-pointer shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
              Gerar PDF
            </button>
          </search>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm py-4" style={{ color: "var(--text-muted)" }}>
            Nenhum equipamento encontrado nesta seleção.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((eq) => (
              <article
                key={eq.client_uuid}
                className="rounded-xl border p-4 flex flex-col justify-between gap-3"
                style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-semibold"
                      style={conditionBadgeStyle(eq.condition_status)}
                    >
                      {CONDITION_LABELS[eq.condition_status]}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {OWNERSHIP_LABELS[eq.ownership_type]}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-sm font-semibold">
                      {eq.name}
                      {eq.patrimony && (
                        <span className="ml-2 font-mono text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                          ({eq.patrimony})
                        </span>
                      )}
                    </h2>
                    {eq.category && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {eq.category}
                      </p>
                    )}
                    {eq.reason && <p className="text-xs mt-1.5">{eq.reason}</p>}
                  </div>

                  {(eq.origin || eq.received_from) && (
                    <div
                      className="text-xs rounded-lg p-2.5 border space-y-0.5"
                      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                    >
                      {eq.origin && (
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>Origem:</span> {eq.origin}
                        </div>
                      )}
                      {eq.received_from && (
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>Recebido de:</span> {eq.received_from}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => void openDetails(eq)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                    Detalhes
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditing({ ...eq })}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      Editar
                    </button>
                    {eq.id > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenAudit(eq)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer"
                        style={{ borderColor: "var(--border)" }}
                      >
                        <History className="w-3.5 h-3.5" aria-hidden="true" />
                        Logs
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Details Modal */}
      <dialog
        ref={detailsDialogRef}
        aria-labelledby="eq-details-title"
        className="m-auto w-[min(94vw,680px)] max-h-[85vh] rounded-xl p-0 overflow-auto shadow-xl"
      >
        {selectedEq && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <h2 id="eq-details-title" className="text-base font-semibold">
                {selectedEq.name}
                {selectedEq.patrimony ? ` (${selectedEq.patrimony})` : ""}
              </h2>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setSelectedEq(null)}
                className="p-1.5 rounded-lg border cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-3.5 rounded-lg border"
              style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
            >
              <div>
                <span style={{ color: "var(--text-muted)" }} className="block">Classificação</span>
                <strong>{OWNERSHIP_LABELS[selectedEq.ownership_type]}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }} className="block">Situação</span>
                <strong>{CONDITION_LABELS[selectedEq.condition_status]}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }} className="block">Categoria</span>
                <span>{selectedEq.category || "-"}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }} className="block">Origem</span>
                <span>{selectedEq.origin || "-"}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }} className="block">Recebido de</span>
                <span>{selectedEq.received_from || "-"}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }} className="block">Cadastrado por</span>
                <span>{selectedEq.created_by_name || "-"}</span>
              </div>
              <div className="sm:col-span-2">
                <span style={{ color: "var(--text-muted)" }} className="block">Motivo</span>
                <span>{selectedEq.reason || "-"}</span>
              </div>
              {selectedEq.notes && (
                <div className="sm:col-span-2">
                  <span style={{ color: "var(--text-muted)" }} className="block">Observações</span>
                  <span>{selectedEq.notes}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                Movimentações vinculadas ({selectedMovements.length})
              </h3>
              {selectedMovements.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Nenhuma movimentação vinculada a este equipamento.
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {selectedMovements.map((m) => (
                    <li
                      key={m.client_uuid}
                      className="p-2.5 rounded-lg border flex flex-wrap justify-between gap-2"
                      style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
                    >
                      <div>
                        <span className="font-mono mr-1.5">{m.document_code}</span>
                        <strong>{m.sector_name}</strong> — {m.install_location}
                        {m.received_by ? ` (${m.received_by})` : ""}
                      </div>
                      <span style={{ color: "var(--text-muted)" }}>
                        {new Date(m.out_at).toLocaleString("pt-BR")} • {m.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </dialog>

      {/* Edit Dialog */}
      <dialog
        ref={editDialogRef}
        aria-labelledby="edit-eq-title"
        className="m-auto w-[min(94vw,620px)] rounded-xl p-5 shadow-xl"
      >
        {editing && (
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
              <h2 id="edit-eq-title" className="text-base font-semibold">Editar Equipamento</h2>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setEditing(null)}
                className="p-1 rounded border cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Equipamento</label>
                <input
                  required
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="tw-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Nº do patrimônio</label>
                <input
                  value={editing.patrimony || ""}
                  onChange={(e) => setEditing({ ...editing, patrimony: e.target.value })}
                  className="tw-input font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Vínculo / Posse</label>
                <select
                  value={editing.ownership_type}
                  onChange={(e) =>
                    setEditing({ ...editing, ownership_type: e.target.value as EquipmentOwnership })
                  }
                  className="tw-input"
                >
                  <option value="proprio_ti">Próprio do TI</option>
                  <option value="estoque">Em estoque</option>
                  <option value="terceiro">Recebido de terceiros / setor</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Situação</label>
                <select
                  value={editing.condition_status}
                  onChange={(e) =>
                    setEditing({ ...editing, condition_status: e.target.value as EquipmentCondition })
                  }
                  className="tw-input"
                >
                  <option value="disponivel">Disponível</option>
                  <option value="em_uso">Em uso</option>
                  <option value="manutencao">Manutenção</option>
                  <option value="avaliacao">Avaliação</option>
                  <option value="emprestado">Emprestado</option>
                  <option value="descartado">Descartado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Categoria</label>
                <input
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="tw-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Origem</label>
                <input
                  value={editing.origin}
                  onChange={(e) => setEditing({ ...editing, origin: e.target.value })}
                  className="tw-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Recebido de</label>
                <input
                  value={editing.received_from}
                  onChange={(e) => setEditing({ ...editing, received_from: e.target.value })}
                  className="tw-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Motivo</label>
                <input
                  value={editing.reason}
                  onChange={(e) => setEditing({ ...editing, reason: e.target.value })}
                  className="tw-input"
                />
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

            <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={editing.active === 1}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked ? 1 : 0 })}
              />
              <span>Ativo</span>
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-3.5 py-2 rounded-lg text-xs border cursor-pointer"
                style={{ borderColor: "var(--border)" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
              >
                Salvar alterações
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
