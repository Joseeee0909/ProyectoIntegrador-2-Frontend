import { useState } from "react";
import { AuthError, checkUsernameAvailability } from "../../auth/mockAuth";
import type { GoogleAuthProfile } from "../../auth/types";

interface UsernameSelectionProps {
  profile: GoogleAuthProfile;
  onComplete: (username: string) => Promise<void>;
}

export function UsernameSelection({ profile, onComplete }: UsernameSelectionProps) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("Debes elegir un username único para terminar tu perfil.");
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");

  const handleChange = async (value: string) => {
    setUsername(value);
    setError("");

    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setAvailable(false);
      setChecking(false);
      setMessage("Debe tener al menos 3 caracteres.");
      return;
    }

    setChecking(true);
    setMessage("Validando disponibilidad...");
    try {
      const result = await checkUsernameAvailability(trimmed);
      setAvailable(result.available);
      setMessage(result.message ?? (result.available ? "Disponible" : "No disponible"));
    } catch {
      setAvailable(false);
      setMessage("No pudimos validar el username ahora.");
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setError("El username debe tener al menos 3 caracteres.");
      return;
    }

    setLoading(true);
    try {
      await onComplete(trimmed);
    } catch (submissionError) {
      setError(submissionError instanceof AuthError ? submissionError.message : "No pudimos completar el perfil. Intenta otra vez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fullscreen-page username-page">
      <div className="username-layout">
        <section className="surface-copy">
          <div className="surface-card__eyebrow">Paso obligatorio para Google</div>
          <h1>Elige tu username para terminar el acceso.</h1>
          <p>
            Este paso evita duplicados, mantiene la identidad clara y deja el dashboard listo con una sesión completa.
          </p>

          <div className="feature-grid">
            <div className="mini-card">Validación en tiempo real</div>
            <div className="mini-card">Feedback inmediato si existe</div>
            <div className="mini-card">Acceso al dashboard protegido</div>
          </div>
        </section>

        <aside className="surface-card surface-card--wide">
          <div className="surface-card__eyebrow">Perfil Google</div>
          <h2>Completa tu username</h2>

          <div className="profile-preview">
            <div className="profile-preview__avatar" aria-hidden="true">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : profile.displayName.charAt(0)}
            </div>
            <div>
              <strong>{profile.displayName}</strong>
              <p>{profile.email}</p>
            </div>
          </div>

          <form className="form" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label className="field__label" htmlFor="google-username">Username</label>
              <div className="input-row input-row--status">
                <input
                  id="google-username"
                  className="input input--with-action"
                  value={username}
                  autoComplete="username"
                  aria-invalid={Boolean(error) || (!available && username.trim().length >= 3)}
                  aria-describedby="google-username-help"
                  onChange={(event) => void handleChange(event.target.value)}
                  placeholder="elige_un_username"
                />
                <span className={`status-dot status-dot--${checking ? "checking" : available ? "available" : username.trim().length >= 3 ? "taken" : "idle"}`} aria-hidden="true" />
              </div>
              <p id="google-username-help" className={`field__hint field__hint--${available ? "available" : error ? "error" : "idle"}`}>
                {error || message}
              </p>
            </div>

            {error && <p role="alert" aria-live="polite" className="feedback feedback--error">{error}</p>}

            <button type="submit" className="button button--primary button--full" disabled={loading || checking || !available}>
              {loading ? <span className="button__loading"><span className="spinner" aria-hidden="true" /> Completando perfil...</span> : "Confirmar username"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}