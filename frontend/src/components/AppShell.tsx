import { LogOut, Menu, RefreshCw, Wifi, WifiOff, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { AuthUser, PageKey, PublicSettings } from "../types";

interface AppShellProps {
  user: AuthUser;
  settings: PublicSettings;
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
  onLogout: () => void;
  online: boolean;
  pendingCount: number;
  syncing: boolean;
  syncNotice: string | null;
  onClearSyncNotice: () => void;
  onSyncNow: () => void;
  children: ReactNode;
}

const NAV_ITEMS: Array<{ key: PageKey; label: string }> = [
  { key: "inicio", label: "Início" },
  { key: "equipamentos", label: "Equipamentos" },
  { key: "movimentacoes", label: "Movimentações" },
  { key: "graficos", label: "Gráficos" },
  { key: "usuarios", label: "Usuários" },
  { key: "configuracoes", label: "Configurações" }
];

export function AppShell({
  user,
  settings,
  activePage,
  onNavigate,
  onLogout,
  online,
  pendingCount,
  syncing,
  syncNotice,
  onClearSyncNotice,
  onSyncNow,
  children
}: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (page: PageKey) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="no-print sticky top-0 z-30 border-b"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)"
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-white rounded-md px-2 py-1 border border-slate-200 shrink-0">
              <img
                src={settings.logo_data_url || "/logo.svg"}
                alt={settings.app_name}
                className="h-6 w-auto block"
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight truncate">{settings.app_name}</div>
              <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {settings.org_name}
              </div>
            </div>
          </div>

          <nav aria-label="Navegação principal" className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = activePage === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => handleNavClick(item.key)}
                  className="px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
                  style={
                    active
                      ? {
                          backgroundColor: "var(--brand)",
                          color: "var(--brand-fg)"
                        }
                      : {
                          color: "var(--text-muted)"
                        }
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onSyncNow}
              title={online ? "Sincronizar agora" : "Modo offline"}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--surface-alt)",
                color: !online ? "var(--cin-red)" : pendingCount > 0 ? "var(--warn)" : "var(--ok)"
              }}
            >
              {!online ? (
                <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
              ) : syncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {!online
                  ? pendingCount > 0
                    ? `Offline (${pendingCount})`
                    : "Offline"
                  : pendingCount > 0
                    ? `Sincronizando (${pendingCount})`
                    : "Online"}
              </span>
            </button>

            <span className="hidden sm:inline text-sm font-medium px-1">{user.full_name}</span>

            <button
              type="button"
              onClick={onLogout}
              aria-label="Sair"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Sair</span>
            </button>

            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
              aria-label="Menu"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg border cursor-pointer"
              style={{ borderColor: "var(--border)" }}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            id="mobile-nav"
            aria-label="Navegação móvel"
            className="lg:hidden border-t px-4 py-2 flex flex-col gap-1"
            style={{ borderColor: "var(--border)" }}
          >
            {NAV_ITEMS.map((item) => {
              const active = activePage === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => handleNavClick(item.key)}
                  className="text-left px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
                  style={
                    active
                      ? { backgroundColor: "var(--brand)", color: "var(--brand-fg)" }
                      : { color: "var(--text)" }
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      {syncNotice && (
        <div
          role="status"
          className="no-print max-w-7xl w-full mx-auto px-4 pt-3"
        >
          <div
            className="px-4 py-2.5 rounded-lg border text-sm flex items-center justify-between gap-3"
            style={{
              backgroundColor: "var(--warn-soft)",
              borderColor: "var(--warn)",
              color: "var(--warn)"
            }}
          >
            <span>{syncNotice}</span>
            <button
              type="button"
              onClick={onClearSyncNotice}
              className="text-xs font-semibold underline cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5">{children}</main>
    </div>
  );
}
