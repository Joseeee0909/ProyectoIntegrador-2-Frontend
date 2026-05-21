import { useState } from "react";
import { AuthError, signInWithEmail } from "../../auth/mockAuth";
import type { LoginFormValues } from "../../auth/types";

interface LoginFormProps {
  onSuccess: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [values, setValues] = useState<LoginFormValues>({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginFormValues, string>>>({});
  const [showPassword, setShowPassword] = useState(false);

  const validate = () => {
    const nextErrors: Partial<Record<keyof LoginFormValues, string>> = {};
    if (!values.email.trim()) nextErrors.email = "El correo es obligatorio.";
    else if (!EMAIL_PATTERN.test(values.email.trim())) nextErrors.email = "Ingresa un correo válido.";
    if (!values.password.trim()) nextErrors.password = "La contraseña es obligatoria.";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!validate()) return;

    setLoading(true);
    try {
      await signInWithEmail({ email: values.email.trim().toLowerCase(), password: values.password });
      onSuccess();
    } catch (authError) {
      setError(authError instanceof AuthError ? authError.message : "No pudimos iniciar sesión. Intenta otra vez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-100" htmlFor="login-email">Correo electrónico</label>
        <input
          id="login-email"
          className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
          type="email"
          value={values.email}
          autoComplete="email"
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
          onChange={(event) => {
            setValues((current) => ({ ...current, email: event.target.value }));
            if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
            if (error) setError("");
          }}
          placeholder="demo@studyroom.app"
        />
        {fieldErrors.email && <p id="login-email-error" className="text-sm text-rose-300">{fieldErrors.email}</p>}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-100" htmlFor="login-password">Contraseña</label>
        <div className="flex gap-2">
          <input
            id="login-password"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
            type={showPassword ? "text" : "password"}
            value={values.password}
            autoComplete="current-password"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
            onChange={(event) => {
              setValues((current) => ({ ...current, password: event.target.value }));
              if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }));
              if (error) setError("");
            }}
            placeholder="••••••••"
          />
          <button type="button" className="rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/10" onClick={() => setShowPassword((current) => !current)}>
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {fieldErrors.password && <p id="login-password-error" className="text-sm text-rose-300">{fieldErrors.password}</p>}
      </div>

      {error && <p role="alert" aria-live="polite" className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p>}

      <div className="flex items-center justify-between gap-3 text-sm text-slate-400">
        <span>Usa tus credenciales registradas.</span>
        <button type="button" className="font-medium text-cyan-300 transition hover:text-cyan-200">¿Olvidaste tu contraseña?</button>
      </div>

      <button type="submit" className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:cursor-progress disabled:opacity-60" disabled={loading}>
        {loading ? <span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden="true" /> Verificando...</span> : "Iniciar sesión"}
      </button>
    </form>
  );
}