import { Eye, EyeOff, LogOut } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiError } from "../services/api";
import type { AuthUser, PublicSettings } from "../types";

interface ForcePasswordChangePageProps {
  user: AuthUser;
  settings: PublicSettings;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<AuthUser>;
  onLogout: () => void;
}

export function ForcePasswordChangePage({
  user,
  settings,
  onChangePassword,
  onLogout
}: ForcePasswordChangePageProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("A confirmação da nova senha não confere.");
      return;
    }

    setSubmitting(true);
    try {
      await onChangePassword(currentPassword, newPassword);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Não foi possível alterar a senha.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-xl border p-6 sm:p-8 shadow-sm space-y-5"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)"
        }}
      >
        <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg px-2 py-1 border border-slate-200 shrink-0">
              <img src={settings.logo_data_url || "/logo.svg"} alt={settings.app_name} className="h-7 w-auto block" />
            </div>
            <div>
              <h1 className="text-base font-bold">Definir nova senha</h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {user.full_name} (@{user.username})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border cursor-pointer"
            style={{ borderColor: "var(--border)" }}
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            Sair
          </button>
        </div>

        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          No primeiro acesso é obrigatório escolher uma nova senha pessoal (mínimo 8 caracteres).
        </p>

        <form method="POST" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="fp-current" className="block text-sm font-medium">
              Senha atual <span aria-hidden="true">*</span>
            </label>
            <input
              id="fp-current"
              name="current_password"
              type={showPasswords ? "text" : "password"}
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="tw-input"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="fp-new" className="block text-sm font-medium">
              Nova senha <span aria-hidden="true">*</span>
            </label>
            <input
              id="fp-new"
              name="new_password"
              type={showPasswords ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="tw-input"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="fp-confirm" className="block text-sm font-medium">
              Confirmar nova senha <span aria-hidden="true">*</span>
            </label>
            <input
              id="fp-confirm"
              name="confirm_password"
              type={showPasswords ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="tw-input"
            />
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
            className="w-full min-h-[46px] rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
          >
            {submitting ? "Salvando..." : "Salvar nova senha e entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
