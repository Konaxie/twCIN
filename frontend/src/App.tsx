import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { AuditDrawer } from "./components/AuditDrawer";
import { PdfModal, type PdfPayload } from "./components/PdfModal";
import { useAuth } from "./hooks/useAuth";
import { usePwaInstall } from "./hooks/usePwaInstall";
import { useSyncData } from "./hooks/useSyncData";
import { useTheme } from "./hooks/useTheme";
import { ConfiguracoesPage } from "./pages/ConfiguracoesPage";
import { EquipamentosPage } from "./pages/EquipamentosPage";
import { ForcePasswordChangePage } from "./pages/ForcePasswordChangePage";
import { GraficosPage } from "./pages/GraficosPage";
import { InicioPage } from "./pages/InicioPage";
import { LoginPage } from "./pages/LoginPage";
import { MovimentacoesPage } from "./pages/MovimentacoesPage";
import { UsuariosPage } from "./pages/UsuariosPage";
import type { PageKey } from "./types";

export function App() {
  const {
    user,
    needsSetup,
    settings,
    setSettings,
    loading,
    setupInitial,
    login,
    changePassword,
    logout,
    setUser
  } = useAuth();
  const { preference, systemTheme, setPreference } = useTheme();
  const pwa = usePwaInstall();
  const [activePage, setActivePage] = useState<PageKey>("inicio");
  const [pdfPayload, setPdfPayload] = useState<PdfPayload | null>(null);
  const [auditTarget, setAuditTarget] = useState<{
    entity: string;
    entityId: number;
    title: string;
  } | null>(null);

  const readyUser = user && !user.must_change_password ? user : null;
  const syncData = useSyncData(readyUser, () => setUser(null), setSettings);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
        Carregando...
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        needsSetup={needsSetup}
        settings={settings}
        onLogin={login}
        onSetupInitial={setupInitial}
      />
    );
  }

  if (user.must_change_password) {
    return (
      <ForcePasswordChangePage
        user={user}
        settings={settings}
        onChangePassword={changePassword}
        onLogout={() => void logout()}
      />
    );
  }

  return (
    <AppShell
      user={user}
      settings={settings}
      activePage={activePage}
      onNavigate={setActivePage}
      onLogout={() => void logout()}
      online={syncData.online}
      pendingCount={syncData.pendingCount}
      syncing={syncData.syncing}
      syncNotice={syncData.syncNotice}
      onClearSyncNotice={syncData.clearSyncNotice}
      onSyncNow={() => void syncData.syncNow()}
    >
      {activePage === "inicio" && (
        <InicioPage
          equipments={syncData.equipments}
          movements={syncData.movements}
          onNavigate={setActivePage}
          onQuickUpdateEquipment={syncData.updateEquipment}
          onQuickReturnMovement={syncData.returnMovement}
          onPrintMovement={(item) => setPdfPayload({ kind: "movement", item })}
        />
      )}

      {activePage === "equipamentos" && (
        <EquipamentosPage
          equipments={syncData.equipments}
          movements={syncData.movements}
          onCreate={syncData.createEquipment}
          onUpdate={syncData.updateEquipment}
          onOpenAudit={(item) =>
            setAuditTarget({
              entity: "catalog_equipment",
              entityId: item.id,
              title: item.name
            })
          }
          onPrintReport={(list) =>
            setPdfPayload({
              kind: "equipments_report",
              title: "Equipamentos sob Responsabilidade do TI",
              items: list,
              issuedBy: user.full_name
            })
          }
        />
      )}

      {activePage === "movimentacoes" && (
        <MovimentacoesPage
          items={syncData.movements}
          sectors={syncData.sectors}
          locations={syncData.locations}
          suggestions={syncData.suggestions}
          onCreate={syncData.createMovement}
          onUpdate={syncData.updateMovement}
          onReturn={syncData.returnMovement}
          onCreateSector={syncData.createSector}
          onRefreshCatalogs={syncData.syncNow}
          onPrintSingle={(item) => setPdfPayload({ kind: "movement", item })}
          onPrintList={(list, title = "Movimentações de Equipamentos") =>
            setPdfPayload({
              kind: "movements_report",
              title,
              items: list,
              issuedBy: user.full_name
            })
          }
          onOpenAudit={(item) =>
            setAuditTarget({
              entity: "movement",
              entityId: item.id,
              title: `${item.document_code} — ${item.equipment_name}`
            })
          }
        />
      )}

      {activePage === "graficos" && (
        <GraficosPage
          equipments={syncData.equipments}
          movements={syncData.movements}
        />
      )}

      {activePage === "usuarios" && (
        <UsuariosPage
          users={syncData.users}
          currentUser={user}
          onRefresh={syncData.syncNow}
        />
      )}

      {activePage === "configuracoes" && (
        <ConfiguracoesPage
          user={user}
          settings={settings}
          preference={preference}
          systemTheme={systemTheme}
          pwa={pwa}
          onChangeTheme={setPreference}
          onChangePassword={changePassword}
          onSettingsUpdated={(updated) => setSettings(updated)}
        />
      )}

      <PdfModal payload={pdfPayload} settings={settings} onClose={() => setPdfPayload(null)} />
      <AuditDrawer target={auditTarget} onClose={() => setAuditTarget(null)} />
    </AppShell>
  );
}
