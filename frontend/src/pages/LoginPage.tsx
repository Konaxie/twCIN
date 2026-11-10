import { Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiError } from "../services/api";
import type { PublicSettings } from "../types";

interface LoginPageProps {
  needsSetup: boolean;
  settings: PublicSettings;
  onLogin: (username: string, password: string) => Promise<unknown>;
  onSetupInitial: (payload: {
    full_name: string;
    username: string;
    password: string;
    app_name?: string;
    org_name?: string;
  }) => Promise<unknown>;
}

export function LoginPage({
  needsSetup,
  settings,
  onLogin,
  onSetupInitial
}: LoginPageProps) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState(settings.org_name || "Setor de TI");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (needsSetup) {
        if (password.length < 8) {
          setError("A senha inicial deve ter no mínimo 8 caracteres.");
          setSubmitting(false);
          return;
        }
        await onSetupInitial({
          full_name: fullName.trim(),
          username: username.trim(),
          password,
          org_name: orgName.trim() || undefined
        });
      } else {
        await onLogin(username.trim(), password);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível conectar ao servidor.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-xl border p-6 sm:p-8 shadow-sm space-y-6"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)"
        }}
      >
        <div className="flex items-center gap-3.5 border-b pb-5" style={{ borderColor: "var(--border)" }}>
          <div className="bg-white rounded-lg px-2.5 py-1.5 border border-slate-200 shrink-0">
            <img
              src={settings.logo_data_url || "/logo.svg"}
              alt={settings.app_name}
              className="h-9 w-auto block"
            />
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              {settings.org_name}
            </p>
            <h1 className="text-xl font-bold tracking-tight">
              {needsSetup ? `${settings.app_name} — Configuração Inicial` : settings.app_name}
            </h1>
          </div>
        </div>

        <form method="POST" onSubmit={handleSubmit} className="space-y-4">
          {needsSetup && (
            <>
              <div className="space-y-1.5">
                <label htmlFor="setup-org" className="block text-sm font-medium">
                  Nome da organização / setor
                </label>
                <input
                  id="setup-org"
                  name="org_name"
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="tw-input"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="setup-fullname" className="block text-sm font-medium">
                  Seu nome completo <span aria-hidden="true">*</span>
                </label>
                <input
                  id="setup-fullname"
                  name="full_name"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="tw-input"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label htmlFor="login-username" className="block text-sm font-medium">
              Usuário <span aria-hidden="true">*</span>
            </label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              required
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError(null);
              }}
              className="tw-input"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-sm font-medium">
              {needsSetup ? "Senha (mín. 8 caracteres)" : "Senha"} <span aria-hidden="true">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={needsSetup ? "new-password" : "current-password"}
                enterKeyHint="done"
                minLength={needsSetup ? 8 : 1}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                className="tw-input pr-12"
              />
              <button
                type="button"
                aria-pressed={showPassword}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 p-2 rounded-md cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="px-3 py-2.5 rounded-lg text-sm border"
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
            disabled={submitting}
            className="w-full min-h-[46px] rounded-lg text-sm font-semibold transition cursor-pointer disabled:opacity-60"
            style={{
              backgroundColor: "var(--brand)",
              color: "var(--brand-fg)"
            }}
          >
            {submitting
              ? needsSetup
                ? "Criando acesso..."
                : "Entrando..."
              : needsSetup
                ? "Criar primeiro usuário"
                : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
