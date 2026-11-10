import { ArrowRightLeft, BarChart3, Check, Package, Search, Wrench } from "lucide-react";
import { useState } from "react";
import { PageIntro } from "../components/PageIntro";
import type { CatalogEquipment, MovementItem, PageKey } from "../types";

interface InicioPageProps {
  equipments: CatalogEquipment[];
  movements: MovementItem[];
  onNavigate: (page: PageKey) => void;
  onQuickUpdateEquipment: (
    item: CatalogEquipment,
    patch: Partial<{ condition_status: CatalogEquipment["condition_status"] }>
  ) => Promise<void>;
  onQuickReturnMovement: (item: MovementItem) => Promise<void>;
  onPrintMovement: (item: MovementItem) => void;
}

const CONDITION_LABELS: Record<CatalogEquipment["condition_status"], string> = {
  disponivel: "Disponível",
  em_uso: "Em uso",
  manutencao: "Manutenção",
  avaliacao: "Avaliação",
  emprestado: "Emprestado",
  descartado: "Descartado"
};

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function InicioPage({
  equipments,
  movements,
  onNavigate,
  onQuickUpdateEquipment,
  onQuickReturnMovement,
  onPrintMovement
}: InicioPageProps) {
  const [search, setSearch] = useState("");

  const activeEquipments = equipments.filter((e) => e.active === 1);
  const attentionEquipments = activeEquipments.filter(
    (e) => e.condition_status === "manutencao" || e.condition_status === "avaliacao"
  );
  const stockCount = activeEquipments.filter((e) => e.ownership_type === "estoque").length;
  const activeLoans = movements.filter((m) => m.status === "ativo");
  const recentMovements = movements.slice(0, 6);

  const q = search.trim().toLowerCase();
  const matchedEquipments = q
    ? activeEquipments
        .filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            (e.patrimony || "").toLowerCase().includes(q) ||
            e.origin.toLowerCase().includes(q) ||
            e.received_from.toLowerCase().includes(q) ||
            e.reason.toLowerCase().includes(q)
        )
        .slice(0, 8)
    : [];

  const matchedMovements = q
    ? movements
        .filter(
          (m) =>
            m.document_code.toLowerCase().includes(q) ||
            m.equipment_name.toLowerCase().includes(q) ||
            m.patrimony.toLowerCase().includes(q) ||
            m.sector_name.toLowerCase().includes(q) ||
            m.install_location.toLowerCase().includes(q) ||
            m.received_by.toLowerCase().includes(q)
        )
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-5">
      <PageIntro
        title="Início — Acesso Rápido"
        purpose="Centraliza a visão rápida do setor de TI com atalhos para as tarefas do dia a dia e busca imediata."
        howTo={[
          "Busque por equipamento, patrimônio, setor ou código para localizar itens na hora.",
          "Acompanhe equipamentos em manutenção ou avaliação e mude a situação com um clique.",
          "Confira as movimentações em aberto em Fora de para marcar devolução ou gerar o PDF."
        ]}
      />

      {/* Top Quick Actions & Unified Search */}
      <section
        className="rounded-xl border p-5 shadow-sm space-y-4"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Atalhos e Busca Rápida</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate("movimentacoes")}
              className="inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-lg text-sm font-semibold cursor-pointer"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
            >
              <ArrowRightLeft className="w-4 h-4" aria-hidden="true" />
              Nova movimentação
            </button>
            <button
              type="button"
              onClick={() => onNavigate("equipamentos")}
              className="inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-lg text-sm font-medium border cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              <Package className="w-4 h-4" aria-hidden="true" />
              Novo equipamento
            </button>
            <button
              type="button"
              onClick={() => onNavigate("graficos")}
              className="inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-lg text-sm font-medium border cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              <BarChart3 className="w-4 h-4" aria-hidden="true" />
              Gráficos
            </button>
          </div>
        </div>

        <search className="relative flex items-center">
          <Search
            className="w-4 h-4 absolute left-3 pointer-events-none"
            style={{ color: "var(--text-muted)" }}
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Consulta rápida"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Consultar equipamento, patrimônio, setor, local ou pessoa..."
            className="tw-input pl-9"
          />
        </search>

        {q && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div
              className="rounded-lg border p-3.5 space-y-2"
              style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Equipamentos ({matchedEquipments.length})
              </h2>
              {matchedEquipments.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nenhum equipamento encontrado.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {matchedEquipments.map((eq) => (
                    <li
                      key={eq.client_uuid}
                      className="p-2 rounded border flex items-center justify-between gap-2"
                      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                    >
                      <div className="min-w-0">
                        <strong className="text-sm">{eq.name}</strong>
                        {eq.patrimony && <span className="ml-2 font-mono">{eq.patrimony}</span>}
                        <div style={{ color: "var(--text-muted)" }}>
                          {CONDITION_LABELS[eq.condition_status]}
                          {eq.origin ? ` • ${eq.origin}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate("equipamentos")}
                        className="px-2 py-1 rounded border cursor-pointer shrink-0"
                        style={{ borderColor: "var(--border)" }}
                      >
                        Abrir
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div
              className="rounded-lg border p-3.5 space-y-2"
              style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                Movimentações ({matchedMovements.length})
              </h2>
              {matchedMovements.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nenhuma movimentação encontrada.</p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {matchedMovements.map((m) => (
                    <li
                      key={m.client_uuid}
                      className="p-2 rounded border flex items-center justify-between gap-2"
                      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                    >
                      <div className="min-w-0">
                        <span className="font-mono mr-1.5" style={{ color: "var(--text-muted)" }}>
                          {m.document_code}
                        </span>
                        <strong className="text-sm">{m.equipment_name}</strong>
                        <div style={{ color: "var(--text-muted)" }}>
                          {m.sector_name} — {m.install_location}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onPrintMovement(m)}
                        className="px-2 py-1 rounded border cursor-pointer shrink-0"
                        style={{ borderColor: "var(--border)" }}
                      >
                        PDF
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Equipamentos ativos</span>
          <div className="text-2xl font-bold mt-1">{activeEquipments.length}</div>
        </div>
        <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Em manutenção / avaliação</span>
          <div className="text-2xl font-bold mt-1" style={{ color: attentionEquipments.length > 0 ? "var(--warn)" : undefined }}>
            {attentionEquipments.length}
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Em estoque</span>
          <div className="text-2xl font-bold mt-1">{stockCount}</div>
        </div>
        <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>Fora de (empréstimos)</span>
          <div className="text-2xl font-bold mt-1" style={{ color: activeLoans.length > 0 ? "var(--brand)" : undefined }}>
            {activeLoans.length}
          </div>
        </div>
      </div>

      {/* Main Operational Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Equipment in IT Maintenance / Evaluation */}
        <section
          className="lg:col-span-6 rounded-xl border p-5 shadow-sm space-y-3"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4" style={{ color: "var(--warn)" }} aria-hidden="true" />
              <h2 className="text-base font-semibold">No TI para manutenção / avaliação</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("equipamentos")}
              className="text-xs font-semibold cursor-pointer"
              style={{ color: "var(--brand)" }}
            >
              Ver todos
            </button>
          </div>

          {attentionEquipments.length === 0 ? (
            <p className="text-sm py-3" style={{ color: "var(--text-muted)" }}>
              Nenhum equipamento aguardando manutenção ou avaliação.
            </p>
          ) : (
            <div className="space-y-2.5">
              {attentionEquipments.map((eq) => {
                const days = daysSince(eq.updated_at);
                return (
                  <article
                    key={eq.client_uuid}
                    className="rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    style={{
                      backgroundColor: "var(--bg)",
                      borderColor: days >= 5 ? "var(--cin-red)" : "var(--border)"
                    }}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-semibold"
                          style={{ backgroundColor: "var(--warn-soft)", color: "var(--warn)" }}
                        >
                          {CONDITION_LABELS[eq.condition_status]}
                        </span>
                        <strong className="text-sm">{eq.name}</strong>
                        {eq.patrimony && (
                          <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                            {eq.patrimony}
                          </span>
                        )}
                      </div>
                      {eq.reason && <p className="text-xs">{eq.reason}</p>}
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {eq.origin ? `Origem: ${eq.origin}` : "Origem não informada"}
                        {eq.received_from ? ` (${eq.received_from})` : ""} •{" "}
                        {days === 0 ? "Hoje" : `${days}d`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void onQuickUpdateEquipment(eq, { condition_status: "disponivel" })
                      }
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0"
                      style={{ backgroundColor: "var(--ok)", color: "#ffffff" }}
                    >
                      Marcar disponível
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Active Outgoing Loans + Recent Activity */}
        <div className="lg:col-span-6 space-y-5">
          <section
            className="rounded-xl border p-5 shadow-sm space-y-3"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-base font-semibold">Fora de ({activeLoans.length})</h2>
              <button
                type="button"
                onClick={() => onNavigate("movimentacoes")}
                className="text-xs font-semibold cursor-pointer"
                style={{ color: "var(--brand)" }}
              >
                Gerenciar
              </button>
            </div>

            {activeLoans.length === 0 ? (
              <p className="text-sm py-3" style={{ color: "var(--text-muted)" }}>
                Nenhum empréstimo aguardando devolução.
              </p>
            ) : (
              <div className="space-y-2.5">
                {activeLoans.slice(0, 6).map((m) => (
                  <article
                    key={m.client_uuid}
                    className="rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                          {m.document_code}
                        </span>
                        <strong className="text-sm">{m.equipment_name}</strong>
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {m.sector_name} — {m.install_location}
                        {m.received_by ? ` • ${m.received_by}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onPrintMovement(m)}
                        className="px-2.5 py-1.5 rounded-lg text-xs border cursor-pointer"
                        style={{ borderColor: "var(--border)" }}
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => void onQuickReturnMovement(m)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
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

          <section
            className="rounded-xl border p-5 shadow-sm space-y-3"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <h2 className="text-base font-semibold border-b pb-3" style={{ borderColor: "var(--border)" }}>
              Últimos registros de movimentação
            </h2>
            {recentMovements.length === 0 ? (
              <p className="text-sm py-2" style={{ color: "var(--text-muted)" }}>
                Nenhuma movimentação registrada ainda.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {recentMovements.map((m) => (
                  <li
                    key={m.client_uuid}
                    className="p-2.5 rounded-lg border flex items-center justify-between gap-2"
                    style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
                  >
                    <div className="min-w-0">
                      <span className="font-mono mr-1.5" style={{ color: "var(--text-muted)" }}>
                        {m.document_code}
                      </span>
                      <strong>{m.equipment_name}</strong>
                      <span style={{ color: "var(--text-muted)" }}>
                        {" "}→ {m.sector_name} ({m.install_location})
                      </span>
                    </div>
                    <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
                      {new Date(m.out_at).toLocaleString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
