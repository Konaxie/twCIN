import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../services/api";
import type { AuditLogItem } from "../types";

interface AuditDrawerProps {
  target: { entity: string; entityId: number; title: string } | null;
  onClose: () => void;
}

export function AuditDrawer({ target, onClose }: AuditDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (target && !dialog.open) {
      dialog.showModal();
    } else if (!target && dialog.open) {
      dialog.close();
    }
  }, [target]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = "";
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest<{ items: AuditLogItem[] }>(
      `/api/audit?entity=${encodeURIComponent(target.entity)}&entity_id=${target.entityId}`
    )
      .then((res) => {
        if (!cancelled) setLogs(res.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar logs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [target]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="audit-dialog-title"
      className="m-auto w-[min(94vw,680px)] max-h-[85vh] rounded-xl p-0 overflow-auto shadow-xl"
    >
      <div
        className="sticky top-0 px-5 py-3.5 border-b flex items-center justify-between gap-3"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 id="audit-dialog-title" className="text-sm font-semibold truncate">
          Logs: {target?.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border cursor-pointer"
          style={{ borderColor: "var(--border)" }}
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
          Fechar
        </button>
      </div>

      <div className="p-5 space-y-3">
        {loading && <p className="text-sm" style={{ color: "var(--text-muted)" }}>Carregando...</p>}
        {error && <p className="text-sm" style={{ color: "var(--cin-red)" }}>{error}</p>}
        {!loading && !error && logs.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nenhum registro encontrado.</p>
        )}

        {logs.map((log) => (
          <div
            key={log.id}
            className="p-3 rounded-lg border text-xs space-y-1.5"
            style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded font-semibold"
                  style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}
                >
                  {log.action}
                </span>
                <span className="font-semibold">{log.user_name}</span>
              </div>
              <span style={{ color: "var(--text-muted)" }}>
                {new Date(log.created_at).toLocaleString("pt-BR")}
              </span>
            </div>
            <p className="text-sm">{log.summary}</p>
            {(log.before_json || log.after_json) && (
              <details className="pt-1">
                <summary className="cursor-pointer font-medium" style={{ color: "var(--text-muted)" }}>
                  Ver dados alterados
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {log.before_json && (
                    <pre
                      className="p-2 rounded border overflow-x-auto text-xs"
                      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
                    >
                      Antes: {JSON.stringify(JSON.parse(log.before_json), null, 2)}
                    </pre>
                  )}
                  {log.after_json && (
                    <pre
                      className="p-2 rounded border overflow-x-auto text-xs"
                      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
                    >
                      Depois: {JSON.stringify(JSON.parse(log.after_json), null, 2)}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </dialog>
  );
}
