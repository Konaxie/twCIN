import {
  Building2,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Monitor,
  Moon,
  Palette,
  Smartphone,
  Sun,
  Upload,
  UserCircle2
} from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { PageIntro } from "../components/PageIntro";
import type { PwaInstallState } from "../hooks/usePwaInstall";
import { apiRequest, ApiError } from "../services/api";
import type { AuthUser, PublicSettings, ThemePreference } from "../types";

interface ConfiguracoesPageProps {
  user: AuthUser;
  settings: PublicSettings;
  preference: ThemePreference;
  systemTheme: "light" | "dark";
  pwa: PwaInstallState;
  onChangeTheme: (pref: ThemePreference) => void;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<AuthUser>;
  onSettingsUpdated: (settings: PublicSettings) => void;
}

type SettingsTab = "conta" | "organizacao" | "aparencia" | "aplicativo";

export function ConfiguracoesPage({
  user,
  settings,
  preference,
  systemTheme,
  pwa,
  onChangeTheme,
  onChangePassword,
  onSettingsUpdated
}: ConfiguracoesPageProps) {
  const [subTab, setSubTab] = useState<SettingsTab>("conta");
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);

  const [appName, setAppName] = useState(settings.app_name);
  const [orgName, setOrgName] = useState(settings.org_name);
  const [logoDataUrl, setLogoDataUrl] = useState(settings.logo_data_url);
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgMessage, setOrgMessage] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const navItems: Array<{ id: SettingsTab; label: string; hint: string; icon: typeof UserCircle2 }> = [
    { id: "conta", label: "Minha Conta", hint: "Perfil e senha", icon: UserCircle2 },
    { id: "organizacao", label: "Organização", hint: "Nome e logo", icon: Building2 },
    { id: "aparencia", label: "Aparência", hint: "Tema claro ou escuro", icon: Palette },
    { id: "aplicativo", label: "Aplicativo", hint: "Instalar no dispositivo", icon: Smartphone }
  ];

  const themeOptions: Array<{
    value: ThemePreference;
    label: string;
    detail: string;
    icon: typeof Monitor;
  }> = [
    {
      value: "system",
      label: "Padrão do sistema",
      detail: `Segue o dispositivo (atual: ${systemTheme === "dark" ? "Escuro" : "Claro"})`,
      icon: Monitor
    },
    {
      value: "light",
      label: "Claro",
      detail: "Fundo claro de alto contraste",
      icon: Sun
    },
    {
      value: "dark",
      label: "Escuro",
      detail: "Superfícies escuras para menor fadiga visual",
      icon: Moon
    }
  ];

  const handleLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setOrgError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setOrgError("Selecione uma imagem PNG, JPEG ou WebP.");
      return;
    }
    if (file.size > 450 * 1024) {
      setOrgError("A imagem deve ter no máximo 450 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLogoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOrgSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOrgError(null);
    setOrgMessage(null);
    setOrgSaving(true);
    try {
      const res = await apiRequest<{ settings: PublicSettings }>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          app_name: appName.trim(),
          org_name: orgName.trim(),
          logo_data_url: logoDataUrl
        })
      });
      onSettingsUpdated(res.settings);
      setOrgMessage("Identidade da organização atualizada.");
    } catch (err) {
      setOrgError(err instanceof ApiError ? err.message : "Erro ao salvar configurações.");
    } finally {
      setOrgSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setError("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A confirmação da nova senha não confere.");
      return;
    }

    setSaving(true);
    try {
      await onChangePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Senha atualizada com sucesso.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível alterar a senha.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleInstallClick = async () => {
    setInstallFeedback(null);
    const outcome = await pwa.triggerInstall();
    if (outcome === "accepted") {
      setInstallFeedback("Instalação iniciada no dispositivo.");
    } else if (outcome === "dismissed") {
      setInstallFeedback("Instalação cancelada. Você pode tentar novamente quando quiser.");
    } else {
      setInstallFeedback("O navegador não disponibilizou o prompt automático neste momento.");
    }
  };

  const initials = user.full_name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

  return (
    <div className="space-y-5">
      <PageIntro
        title="Configurações"
        purpose="Reúne os ajustes pessoais da sua conta, identidade da organização, aparência e instalação como aplicativo (PWA)."
        howTo={[
          "Em Minha Conta, confira os dados do seu login e altere sua senha pessoal com segurança.",
          "Em Organização e Aparência, personalize nome/logo e alterne entre tema Claro, Escuro ou Padrão do sistema.",
          "Em Aplicativo, instale o sistema no celular ou computador diretamente sem pop-ups invasivos."
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Settings Menu */}
        <aside
          aria-label="Seções de configurações"
          className="lg:col-span-3 rounded-xl border p-2.5 shadow-sm space-y-1"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = subTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setSubTab(item.id)}
                className="w-full min-h-[48px] px-3 py-2.5 rounded-lg text-left flex items-center gap-3 transition border cursor-pointer"
                style={
                  active
                    ? {
                        backgroundColor: "var(--brand-soft)",
                        borderColor: "var(--brand)",
                        color: "var(--brand)"
                      }
                    : {
                        backgroundColor: "transparent",
                        borderColor: "transparent",
                        color: "var(--text)"
                      }
                }
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">{item.label}</span>
                  <span
                    className="block text-xs truncate"
                    style={{ color: active ? "var(--brand)" : "var(--text-muted)" }}
                  >
                    {item.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </aside>

        {/* Right Content Panel */}
        <section
          className="lg:col-span-9 rounded-xl border p-5 sm:p-6 shadow-sm space-y-6"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          {subTab === "conta" && (
            <div className="space-y-6">
              <div className="border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-base font-semibold">Minha Conta</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Informações do seu usuário autenticado e atualização de senha.
                </p>
              </div>

              <div
                className="p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4"
                style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                    aria-hidden="true"
                  >
                    {initials || "TI"}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{user.full_name}</div>
                    <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      @{user.username}
                    </div>
                  </div>
                </div>
                {user.last_login_at && (
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Último acesso:{" "}
                    <strong>{new Date(user.last_login_at).toLocaleString("pt-BR")}</strong>
                  </div>
                )}
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-xl">
                <h3 className="text-sm font-semibold">Alterar senha</h3>

                <div>
                  <label htmlFor="cfg-cur-pass" className="block text-xs font-medium mb-1">
                    Senha atual
                  </label>
                  <input
                    id="cfg-cur-pass"
                    type={showPasswords ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="tw-input"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="cfg-new-pass" className="block text-xs font-medium mb-1">
                      Nova senha (mín. 8 caracteres)
                    </label>
                    <input
                      id="cfg-new-pass"
                      type={showPasswords ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="tw-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="cfg-confirm-pass" className="block text-xs font-medium mb-1">
                      Confirmar nova senha
                    </label>
                    <input
                      id="cfg-confirm-pass"
                      type={showPasswords ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="tw-input"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  aria-pressed={showPasswords}
                  onClick={() => setShowPasswords((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                >
                  {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPasswords ? "Ocultar senhas" : "Mostrar senhas"}</span>
                </button>

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

                {success && (
                  <div
                    role="status"
                    className="px-3 py-2 rounded-lg text-sm border"
                    style={{
                      backgroundColor: "var(--ok-soft)",
                      borderColor: "var(--ok)",
                      color: "var(--ok)"
                    }}
                  >
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] px-5 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60"
                  style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                >
                  {saving ? "Salvando..." : "Atualizar senha"}
                </button>
              </form>
            </div>
          )}

          {subTab === "organizacao" && (
            <div className="space-y-6">
              <div className="border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-base font-semibold">Organização</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Identificação exibida na barra superior, tela de login e relatórios em PDF.
                </p>
              </div>

              <form onSubmit={handleOrgSubmit} className="space-y-5 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="org-appname" className="block text-xs font-medium mb-1">
                      Nome do sistema
                    </label>
                    <input
                      id="org-appname"
                      required
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      className="tw-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="org-name" className="block text-xs font-medium mb-1">
                      Nome da organização / setor
                    </label>
                    <input
                      id="org-name"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="tw-input"
                    />
                  </div>
                </div>

                <div
                  className="p-4 rounded-xl border space-y-3"
                  style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
                >
                  <div>
                    <span className="block text-xs font-semibold">Logotipo personalizado</span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Formatos aceitos: PNG, JPEG ou WebP (até 450 KB).
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-white rounded-lg p-2.5 border border-slate-200">
                      <img
                        src={logoDataUrl || "/logo.svg"}
                        alt={appName}
                        className="h-10 w-auto block"
                      />
                    </div>
                    <label
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg text-xs font-medium border cursor-pointer"
                      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                    >
                      <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Enviar logo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleLogoFileChange}
                        className="sr-only"
                      />
                    </label>
                    {logoDataUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoDataUrl("")}
                        className="min-h-[44px] px-4 py-2 rounded-lg text-xs border cursor-pointer"
                        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                      >
                        Restaurar padrão
                      </button>
                    )}
                  </div>
                </div>

                {orgError && (
                  <div
                    role="alert"
                    className="px-3 py-2 rounded-lg text-sm border"
                    style={{
                      backgroundColor: "var(--cin-red-soft)",
                      borderColor: "var(--cin-red)",
                      color: "var(--cin-red)"
                    }}
                  >
                    {orgError}
                  </div>
                )}

                {orgMessage && (
                  <div
                    role="status"
                    className="px-3 py-2 rounded-lg text-sm border"
                    style={{
                      backgroundColor: "var(--ok-soft)",
                      borderColor: "var(--ok)",
                      color: "var(--ok)"
                    }}
                  >
                    {orgMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={orgSaving}
                  className="min-h-[44px] px-5 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60"
                  style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                >
                  {orgSaving ? "Salvando..." : "Salvar organização"}
                </button>
              </form>
            </div>
          )}

          {subTab === "aparencia" && (
            <div className="space-y-6">
              <div className="border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-base font-semibold">Aparência</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Preferência de cores salva localmente para este navegador.
                </p>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold mb-2">Tema da interface</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {themeOptions.map((opt) => {
                    const Icon = opt.icon;
                    const checked = preference === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className="p-4 rounded-xl border flex flex-col gap-3 cursor-pointer transition"
                        style={{
                          backgroundColor: checked ? "var(--brand-soft)" : "var(--bg)",
                          borderColor: checked ? "var(--brand)" : "var(--border)"
                        }}
                      >
                        <div
                          className="h-14 rounded-lg border overflow-hidden grid grid-cols-2"
                          style={{ borderColor: "var(--border)" }}
                          aria-hidden="true"
                        >
                          <div
                            className="p-2 flex flex-col justify-between"
                            style={{
                              backgroundColor:
                                opt.value === "dark" ? "#090e1a" : "#f4f6fa"
                            }}
                          >
                            <span
                              className="h-2 w-8 rounded"
                              style={{
                                backgroundColor: opt.value === "dark" ? "#4f8df5" : "#002d6b"
                              }}
                            />
                            <span
                              className="h-2 w-10 rounded"
                              style={{
                                backgroundColor: opt.value === "dark" ? "#1e293b" : "#d6deeb"
                              }}
                            />
                          </div>
                          <div
                            className="p-2 flex flex-col justify-between"
                            style={{
                              backgroundColor:
                                opt.value === "light" ? "#ffffff" : "#101829"
                            }}
                          >
                            <span
                              className="h-2 w-6 rounded self-end"
                              style={{
                                backgroundColor: opt.value === "light" ? "#c81018" : "#f25f66"
                              }}
                            />
                            <span
                              className="h-2 w-9 rounded"
                              style={{
                                backgroundColor: opt.value === "light" ? "#cbd5e1" : "#263554"
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5">
                          <input
                            type="radio"
                            name="theme-preference"
                            value={opt.value}
                            checked={checked}
                            onChange={() => onChangeTheme(opt.value)}
                            className="mt-1"
                          />
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 text-sm font-semibold">
                              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                              <span>{opt.label}</span>
                            </div>
                            <span className="block text-xs leading-snug" style={{ color: "var(--text-muted)" }}>
                              {opt.detail}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          )}

          {subTab === "aplicativo" && (
            <div className="space-y-6">
              <div className="border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <h2 className="text-base font-semibold">Aplicativo (PWA e Offline)</h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Instale o {appName} na tela inicial do celular ou na área de trabalho sem janelas automáticas.
                </p>
              </div>

              <div
                className="p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {pwa.isInstalled ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" style={{ color: "var(--ok)" }} aria-hidden="true" />
                        <span>Aplicativo instalado neste dispositivo</span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-4 h-4" style={{ color: "var(--brand)" }} aria-hidden="true" />
                        <span>Instalar {appName} no dispositivo</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs max-w-xl" style={{ color: "var(--text-muted)" }}>
                    {pwa.isInstalled
                      ? "Você já está executando o sistema em modo aplicativo independente (standalone)."
                      : pwa.canInstall
                        ? "Pronto para instalar com suporte a funcionamento offline e sincronização automática."
                        : !pwa.isSecureContext
                          ? "A instalação direta no celular exige conexão segura via HTTPS (ou localhost no computador). Ao acessar por IP HTTP na rede local, o navegador bloqueia o instalador automático."
                          : pwa.isIos
                            ? "No Safari (iPhone/iPad), toque no botão Compartilhar e escolha 'Adicionar à Tela de Início'."
                            : "Se o botão não estiver ativo, utilize o menu do navegador (⋮ → Instalar aplicativo / Adicionar à tela inicial)."}
                  </p>
                </div>

                {!pwa.isInstalled && (
                  <button
                    type="button"
                    disabled={!pwa.canInstall}
                    onClick={handleInstallClick}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-lg text-sm font-semibold shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    <span>Instalar no dispositivo</span>
                  </button>
                )}
              </div>

              {installFeedback && (
                <div
                  role="status"
                  className="px-3.5 py-2.5 rounded-lg text-sm border"
                  style={{ backgroundColor: "var(--brand-soft)", borderColor: "var(--brand)", color: "var(--brand)" }}
                >
                  {installFeedback}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border space-y-1" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}>
                  <div className="font-semibold">Contexto seguro</div>
                  <div style={{ color: pwa.isSecureContext ? "var(--ok)" : "var(--warn)" }}>
                    {pwa.isSecureContext ? "HTTPS / Localhost ativo" : "HTTP local (sem HTTPS)"}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border space-y-1" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}>
                  <div className="font-semibold">Service Worker</div>
                  <div style={{ color: pwa.swActive ? "var(--ok)" : pwa.hasServiceWorkerSupport ? "var(--text-muted)" : "var(--warn)" }}>
                    {pwa.swActive
                      ? "Ativo (cache offline pronto)"
                      : pwa.hasServiceWorkerSupport
                        ? "Disponível após carregamento completo"
                        : "Indisponível sem HTTPS"}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border space-y-1" style={{ backgroundColor: "var(--bg)", borderColor: "var(--border)" }}>
                  <div className="font-semibold">Armazenamento offline</div>
                  <div style={{ color: "var(--ok)" }}>IndexedDB (Dexie) habilitado</div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
