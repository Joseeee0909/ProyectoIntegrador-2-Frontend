import { useEffect, useState } from "react";
import { AuthError, checkUsernameAvailability, registerWithEmail } from "../../auth/mockAuth";
import type { RegisterFormValues } from "../../auth/types";

interface RegisterFormProps {
  onSuccess: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UsernameState = "idle" | "checking" | "available" | "taken" | "too-short" | "error";

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
  const [usernameState, setUsernameState] = useState<UsernameState>("idle");
  const [usernameMessage, setUsernameMessage] = useState("El username debe ser único.");

  useEffect(() => {
    const normalized = values.username.trim();
    if (!normalized) {
      setUsernameState("idle");
      setUsernameMessage("El username debe ser único.");
      return;
    }

    if (normalized.length < 3) {
      setUsernameState("too-short");
      setUsernameMessage("Debe tener al menos 3 caracteres.");
      return;
    }

    let cancelled = false;
    setUsernameState("checking");
    setUsernameMessage("Comprobando disponibilidad...");

    const timeout = window.setTimeout(() => {
      void checkUsernameAvailability(normalized)
        .then((result) => {
          if (cancelled) return;
          setUsernameState(result.available ? "available" : "taken");
          setUsernameMessage(result.message ?? (result.available ? "Disponible" : "No disponible"));
        })
        .catch(() => {
          if (cancelled) return;
          setUsernameState("error");
          setUsernameMessage("No pudimos validar el username ahora.");
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [values.username]);

  const validate = () => {
    const nextErrors: Partial<Record<keyof RegisterFormValues, string>> = {};
    if (!values.firstName.trim()) nextErrors.firstName = "Ingresa tus nombres.";
    if (!values.lastName.trim()) nextErrors.lastName = "Ingresa tus apellidos.";
    if (!values.username.trim()) nextErrors.username = "El username es obligatorio.";
    else if (values.username.trim().length < 3) nextErrors.username = "Debe tener al menos 3 caracteres.";
    if (!values.email.trim()) nextErrors.email = "El correo es obligatorio.";
    else if (!EMAIL_PATTERN.test(values.email.trim())) nextErrors.email = "Ingresa un correo válido.";
    if (!values.password.trim()) nextErrors.password = "La contraseña es obligatoria.";
    else if (values.password.length < 8) nextErrors.password = "Debe tener al menos 8 caracteres.";
    if (usernameState === "taken") nextErrors.username = "Ese username ya existe.";
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
        ...values,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        username: values.username.trim(),
        email: values.email.trim().toLowerCase(),
        avatarUrl: values.avatarUrl.trim(),
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
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="form__split">
        <div className="field">
          <label className="field__label" htmlFor="register-first-name">Nombres</label>
          <input
            id="register-first-name"
            className="input"
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
          {fieldErrors.firstName && <p className="field__error">{fieldErrors.firstName}</p>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="register-last-name">Apellidos</label>
          <input
            id="register-last-name"
            className="input"
            value={values.lastName}
            autoComplete="family-name"
            aria-invalid={Boolean(fieldErrors.lastName)}
            onChange={(event) => {
              setValues((current) => ({ ...current, lastName: event.target.value }));
              if (fieldErrors.lastName) setFieldErrors((current) => ({ ...current, lastName: undefined }));
              if (error) setError("");
            }}
            placeholder="Rios"
          />
          {fieldErrors.lastName && <p className="field__error">{fieldErrors.lastName}</p>}
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="register-username">Username</label>
        <div className="input-row input-row--status">
          <input
            id="register-username"
            className="input input--with-action"
            value={values.username}
            autoComplete="username"
            aria-invalid={Boolean(fieldErrors.username) || usernameState === "taken"}
            aria-describedby="register-username-help"
            onChange={(event) => {
              setValues((current) => ({ ...current, username: event.target.value }));
              if (fieldErrors.username) setFieldErrors((current) => ({ ...current, username: undefined }));
              if (error) setError("");
            }}
            placeholder="anarios"
          />
          <span className={`status-dot status-dot--${usernameState}`} aria-hidden="true" />
        </div>
        <p id="register-username-help" className={`field__hint field__hint--${usernameState}`}>
          {usernameState === "available" ? "Username disponible." : usernameMessage}
        </p>
        {fieldErrors.username && <p className="field__error">{fieldErrors.username}</p>}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="register-avatar">Avatar</label>
        <input
          id="register-avatar"
          className="input"
          value={values.avatarUrl}
          autoComplete="photo"
          onChange={(event) => setValues((current) => ({ ...current, avatarUrl: event.target.value }))}
          placeholder="https://... o deja en blanco para usar uno automático"
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="register-email">Correo electrónico</label>
        <input
          id="register-email"
          className="input"
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
        {fieldErrors.email && <p className="field__error">{fieldErrors.email}</p>}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="register-password">Contraseña</label>
        <input
          id="register-password"
          className="input"
          type="password"
          value={values.password}
          autoComplete="new-password"
          aria-invalid={Boolean(fieldErrors.password)}
          onChange={(event) => {
            setValues((current) => ({ ...current, password: event.target.value }));
            if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }));
            if (error) setError("");
          }}
          placeholder="Mínimo 8 caracteres"
        />
        {fieldErrors.password && <p className="field__error">{fieldErrors.password}</p>}
      </div>

      {error && <p role="alert" aria-live="polite" className="feedback feedback--error">{error}</p>}
      {success && <p role="status" aria-live="polite" className="feedback feedback--success">{success}</p>}

      <button type="submit" className="button button--primary button--full" disabled={loading}>
        {loading ? <span className="button__loading"><span className="spinner" aria-hidden="true" /> Creando cuenta...</span> : "Registrarme"}
      </button>

      <p className="form__note">El username se valida en tiempo real y el avatar puede ser una URL o dejarse vacío.</p>
    </form>
  );
}