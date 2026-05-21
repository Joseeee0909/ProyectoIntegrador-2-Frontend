import { useState } from "react";
import { ArrowLeft, BadgeCheck, Sparkles, UserRound } from "lucide-react";
import { AuthError, checkUsernameAvailability } from "../../auth/mockAuth";
import type { GoogleAuthProfile } from "../../auth/types";

interface UsernameSelectionProps {
  profile: GoogleAuthProfile;
  onComplete: (username: string) => Promise<void>;
  onBack: () => void;
}

export function UsernameSelection({ profile, onComplete, onBack }: UsernameSelectionProps) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("Debes elegir un username único para terminar tu perfil.");
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");
  const profileInitials = profile.displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  const hasRenderableAvatar = Boolean(profile.avatarUrl && /^https?:\/\//i.test(profile.avatarUrl));

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,116,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.08),transparent_26%),linear-gradient(180deg,#070a1f_0%,#030617_100%)] p-4 text-slate-100">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
        <section className="grid gap-5">
          <button type="button" className="inline-flex h-11 w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 transition hover:bg-white/10" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>

          <div className="inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">Paso obligatorio para Google</div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Elige tu username para terminar el acceso.</h1>
          <p className="max-w-xl text-base leading-8 text-slate-400">
            Este paso evita duplicados, mantiene la identidad clara y deja el dashboard listo con una sesión completa.
          </p>

          <div className="grid gap-3 sm:max-w-xl">
            <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-slate-200">
              <BadgeCheck className="h-4 w-4 text-cyan-300" /> Validación en tiempo real
            </div>
            <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-slate-200">
              <Sparkles className="h-4 w-4 text-violet-300" /> Feedback inmediato si existe
            </div>
            <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-slate-200">
              <UserRound className="h-4 w-4 text-emerald-300" /> Acceso al dashboard protegido
            </div>
          </div>
        </section>

        <aside className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">Perfil Google</div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Completa tu username</h2>

          <div className="mt-6 flex items-center gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/40 p-4">
            <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-cyan-400/10 text-lg font-bold text-cyan-100" aria-hidden="true">
              {hasRenderableAvatar ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : profileInitials}
            </div>
            <div>
              <strong className="block text-base font-semibold text-slate-100">{profile.displayName}</strong>
              <p className="text-sm text-slate-400">{profile.email}</p>
            </div>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-100" htmlFor="google-username">Username</label>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 focus-within:border-cyan-400/50 focus-within:ring-4 focus-within:ring-cyan-400/10">
                <input
                  id="google-username"
                  className="h-12 min-w-0 flex-1 bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
                  value={username}
                  autoComplete="username"
                  aria-invalid={Boolean(error) || (!available && username.trim().length >= 3)}
                  aria-describedby="google-username-help"
                  onChange={(event) => void handleChange(event.target.value)}
                  placeholder="elige_un_username"
                />
                <span className={`h-3 w-3 rounded-full ${checking ? "bg-amber-400" : available ? "bg-emerald-400" : username.trim().length >= 3 ? "bg-rose-400" : "bg-slate-500"}`} aria-hidden="true" />
              </div>
              <p id="google-username-help" className={`text-sm ${available ? "text-emerald-300" : error ? "text-rose-300" : "text-slate-400"}`}>
                {error || message}
              </p>
            </div>

            {error && <p role="alert" aria-live="polite" className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p>}

            <button type="submit" className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:cursor-progress disabled:opacity-60" disabled={loading || checking || !available}>
              {loading ? <span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden="true" /> Completando perfil...</span> : "Confirmar username"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}