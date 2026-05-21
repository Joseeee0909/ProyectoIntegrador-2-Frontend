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
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor="login-email">Correo electrónico</label>
        <input
          id="login-email"
          className="input"
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
        {fieldErrors.email && <p id="login-email-error" className="field__error">{fieldErrors.email}</p>}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="login-password">Contraseña</label>
        <div className="input-row">
          <input
            id="login-password"
            className="input input--with-action"
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
          <button type="button" className="input-action" onClick={() => setShowPassword((current) => !current)}>
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {fieldErrors.password && <p id="login-password-error" className="field__error">{fieldErrors.password}</p>}
      </div>

      {error && <p role="alert" aria-live="polite" className="feedback feedback--error">{error}</p>}

      <div className="form__footer">
        <span className="form__hint">Usa tus credenciales registradas.</span>
        <button type="button" className="text-button">¿Olvidaste tu contraseña?</button>
      </div>

      <button type="submit" className="button button--primary button--full" disabled={loading}>
        {loading ? <span className="button__loading"><span className="spinner" aria-hidden="true" /> Verificando...</span> : "Iniciar sesión"}
      </button>
    </form>
  );
}