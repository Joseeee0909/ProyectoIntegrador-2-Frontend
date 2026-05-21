import { useEffect, useState } from "react";
import { AuthError, checkUsernameAvailability, registerWithEmail } from "../../auth/mockAuth";
import type { RegisterFormValues } from "../../auth/types";

interface RegisterFormProps {
  onSuccess: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^(https?:\/\/)[^\s/$.?#].[^\s]*$/i;

type AvailabilityState = "idle" | "checking" | "available" | "taken" | "error" | "invalid";

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [values, setValues] = useState<RegisterFormValues>({
    firstName: "",
    lastName: "",
    username: "",
    avatarUrl: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterFormValues, string>>>({});
  const [usernameState, setUsernameState] = useState<AvailabilityState>("idle");
  const [usernameMessage, setUsernameMessage] = useState("El username debe ser único.");

  useEffect(() => {
    const normalized = values.username.trim();

    if (!normalized) {
      setUsernameState("idle");
      setUsernameMessage("El username debe ser único.");
      return;
    }

    if (normalized.length < 3) {
      setUsernameState("invalid");
      setUsernameMessage("El username debe tener al menos 3 caracteres.");
      return;
    }

    let active = true;
    setUsernameState("checking");
    setUsernameMessage("Verificando username...");

    const timeout = window.setTimeout(async () => {
      try {
        const availability = await checkUsernameAvailability(normalized);
        if (!active) return;

        setUsernameState(availability.available ? "available" : "taken");
        setUsernameMessage(availability.message);
      } catch {
        if (!active) return;

        setUsernameState("error");
        setUsernameMessage("No pudimos validar el username.");
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [values.username]);

  const validate = () => {
    const nextErrors: Partial<Record<keyof RegisterFormValues, string>> = {};
    if (!values.firstName.trim()) nextErrors.firstName = "Ingresa tus nombres.";
    if (!values.lastName.trim()) nextErrors.lastName = "Ingresa tus apellidos.";
    if (!values.username.trim()) nextErrors.username = "El username es obligatorio.";
    else if (values.username.trim().length < 3) nextErrors.username = "El username debe tener al menos 3 caracteres.";
    else if (usernameState === "taken") nextErrors.username = usernameMessage;
    if (!values.email.trim()) nextErrors.email = "El correo es obligatorio.";
    else if (!EMAIL_PATTERN.test(values.email.trim())) nextErrors.email = "Ingresa un correo válido.";
    if (!values.password.trim()) nextErrors.password = "La contraseña es obligatoria.";
    if (values.avatarUrl.trim() && !URL_PATTERN.test(values.avatarUrl.trim())) nextErrors.avatarUrl = "Ingresa una URL válida o deja este campo vacío.";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!validate()) return;

    setLoading(true);
    try {
      await registerWithEmail({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        username: values.username.trim(),
        avatarUrl: values.avatarUrl.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });
      setSuccess("Registro completado.");
      onSuccess();
    } catch (authError) {
      setError(authError instanceof AuthError ? authError.message : "No pudimos completar el registro. Intenta otra vez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="grid min-w-0 gap-2">
          <label className="text-sm font-medium text-slate-100" htmlFor="register-first-name">Nombres</label>
          <input
            id="register-first-name"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
            type="text"
            value={values.firstName}
            autoComplete="given-name"
            aria-invalid={Boolean(fieldErrors.firstName)}
            onChange={(event) => {
              setValues((current) => ({ ...current, firstName: event.target.value }));
              if (fieldErrors.firstName) setFieldErrors((current) => ({ ...current, firstName: undefined }));
              if (error) setError("");
            }}
            placeholder="Ana"
          />
          {fieldErrors.firstName && <p className="text-sm text-rose-300">{fieldErrors.firstName}</p>}
        </div>

        <div className="grid min-w-0 gap-2">
          <label className="text-sm font-medium text-slate-100" htmlFor="register-last-name">Apellidos</label>
          <input
            id="register-last-name"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
            type="text"
            value={values.lastName}
            autoComplete="family-name"
            aria-invalid={Boolean(fieldErrors.lastName)}
            onChange={(event) => {
              setValues((current) => ({ ...current, lastName: event.target.value }));
              if (fieldErrors.lastName) setFieldErrors((current) => ({ ...current, lastName: undefined }));
              if (error) setError("");
            }}
            placeholder="Soto"
          />
          {fieldErrors.lastName && <p className="text-sm text-rose-300">{fieldErrors.lastName}</p>}
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-100" htmlFor="register-username">Username</label>
        <input
          id="register-username"
          className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
          type="text"
          value={values.username}
          autoComplete="username"
          aria-invalid={Boolean(fieldErrors.username)}
          onChange={(event) => {
            setValues((current) => ({ ...current, username: event.target.value }));
            if (fieldErrors.username) setFieldErrors((current) => ({ ...current, username: undefined }));
            if (error) setError("");
          }}
          placeholder="anastudy"
        />
        <p className={`text-sm ${usernameState === "taken" ? "text-rose-300" : usernameState === "available" ? "text-emerald-300" : "text-slate-400"}`}>
          {fieldErrors.username ?? usernameMessage}
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-100" htmlFor="register-avatar">Avatar</label>
        <input
          id="register-avatar"
          className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
          type="url"
          value={values.avatarUrl}
          autoComplete="photo"
          aria-invalid={Boolean(fieldErrors.avatarUrl)}
          onChange={(event) => {
            setValues((current) => ({ ...current, avatarUrl: event.target.value }));
            if (fieldErrors.avatarUrl) setFieldErrors((current) => ({ ...current, avatarUrl: undefined }));
            if (error) setError("");
          }}
          placeholder="https://..."
        />
        {fieldErrors.avatarUrl ? (
          <p className="text-sm text-rose-300">{fieldErrors.avatarUrl}</p>
        ) : (
          <p className="text-sm text-slate-400">Puedes dejarlo vacío y se usará un avatar con tus iniciales.</p>
        )}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-100" htmlFor="register-email">Correo electrónico</label>
        <input
          id="register-email"
          className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
          type="email"
          value={values.email}
          autoComplete="email"
          aria-invalid={Boolean(fieldErrors.email)}
          onChange={(event) => {
            setValues((current) => ({ ...current, email: event.target.value }));
            if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
            if (error) setError("");
          }}
          placeholder="ana@studyroom.app"
        />
        {fieldErrors.email && <p className="text-sm text-rose-300">{fieldErrors.email}</p>}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-100" htmlFor="register-password">Contraseña</label>
        <input
          id="register-password"
          className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
          type="password"
          value={values.password}
          autoComplete="new-password"
          aria-invalid={Boolean(fieldErrors.password)}
          onChange={(event) => {
            setValues((current) => ({ ...current, password: event.target.value }));
            if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }));
            if (error) setError("");
          }}
          placeholder="Mínimo 6 caracteres"
        />
        {fieldErrors.password && <p className="text-sm text-rose-300">{fieldErrors.password}</p>}
      </div>

      {error && <p role="alert" aria-live="polite" className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p>}
      {success && <p role="status" aria-live="polite" className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{success}</p>}

      <button type="submit" className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:cursor-progress disabled:opacity-60" disabled={loading}>
        {loading ? <span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden="true" /> Creando cuenta...</span> : "Registrarme"}
      </button>

      <p className="text-sm text-slate-400">Crea tu cuenta con correo y contraseña.</p>
    </form>
  );
}