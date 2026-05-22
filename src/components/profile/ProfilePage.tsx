import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Camera, Mail, Save, Sparkles, UserRound } from "lucide-react";
import { AuthError, checkUsernameAvailability, updateProfile } from "../../auth/mockAuth";
import type { AuthUser, ProfileFormValues } from "../../auth/types";

interface ProfilePageProps {
  user: AuthUser;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

type AvailabilityState = "idle" | "checking" | "available" | "taken" | "error" | "invalid";

export function ProfilePage({ user, onCancel, onSaved }: ProfilePageProps) {
  const initialUsername = user.username.trim().toLowerCase();
  const initialEmail = user.email.trim().toLowerCase();
  const [values, setValues] = useState<ProfileFormValues>({
    names: user.names,
    lastNames: user.lastNames,
    username: user.username,
    email: user.email,
    avatar: user.avatar ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ProfileFormValues, string>>>({});
  const [usernameState, setUsernameState] = useState<AvailabilityState>("idle");
  const [usernameMessage, setUsernameMessage] = useState("El username debe ser único.");
  const [avatarErrored, setAvatarErrored] = useState(false);

  useEffect(() => {
    const normalized = values.username.trim();
    if (normalized.toLowerCase() === initialUsername) {
      setUsernameState("idle");
      setUsernameMessage("Es tu username actual.");
      return;
    }

    if (!normalized) {
      setUsernameState("idle");
      setUsernameMessage("El username debe ser único.");
      return;
    }

    if (normalized.length < 3) {
      setUsernameState("invalid");
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
    }, [initialUsername, values.username]);

  const validate = () => {
    const nextErrors: Partial<Record<keyof ProfileFormValues, string>> = {};
    if (!values.names.trim()) nextErrors.names = "Ingresa tus nombres.";
    if (!values.lastNames.trim()) nextErrors.lastNames = "Ingresa tus apellidos.";
    if (!values.username.trim()) nextErrors.username = "El username es obligatorio.";
    setFieldErrors(nextErrors);

    const usernameChanged = values.username.trim().toLowerCase() !== initialUsername;

    return Object.keys(nextErrors).length === 0 && (!usernameChanged || usernameState !== "taken");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!validate()) {
      if (values.username.trim().toLowerCase() !== initialUsername && usernameState === "taken") {
        setFieldErrors((current) => ({ ...current, username: "Ese username ya existe." }));
      }
      return;
    }

    setLoading(true);
    try {
      await updateProfile({
        names: values.names.trim(),
        lastNames: values.lastNames.trim(),
        username: values.username.trim(),
        email: initialEmail,
        avatar: values.avatar.trim(),
      });
      setSuccess("Perfil actualizado correctamente.");
      onSaved("Tus datos se actualizaron con éxito.");
    } catch (submissionError) {
      const authError = submissionError instanceof AuthError ? submissionError : null;
      if (authError?.code === "username_taken") {
        setFieldErrors((current) => ({ ...current, username: "Ese username ya existe." }));
        setError(authError.message);
      } else {
        setError(authError?.message ?? "No pudimos actualizar tu perfil. Intenta otra vez.");
      }
    } finally {
      setLoading(false);
    }
  };

  const avatarInitials = `${values.names} ${values.lastNames}`
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  const hasRenderableAvatar = Boolean(values.avatar && !avatarErrored && /^https?:\/\//i.test(values.avatar));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,116,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.08),transparent_26%),linear-gradient(180deg,#070a1f_0%,#030617_100%)] p-4 text-slate-100">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl grid-cols-1 gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="flex flex-col gap-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <button type="button" className="inline-flex h-11 w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 transition hover:bg-white/10" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
            <UserRound className="h-4 w-4 text-cyan-300" /> Mi Perfil
          </div>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Actualiza tus datos personales</h1>
          <p className="max-w-xl text-base leading-8 text-slate-400">
            Mantén tu nombre, apellido, avatar, username y correo sincronizados para que tu identidad esté siempre al día.
          </p>

          <div className="grid gap-3">
            <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-slate-200">
              <BadgeCheck className="h-4 w-4 text-emerald-300" /> El sistema valida disponibilidad antes de guardar
            </div>
            <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-slate-200">
              <Sparkles className="h-4 w-4 text-violet-300" /> Guarda los cambios con un click y ve el resultado al instante
            </div>
            <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-slate-200">
              <Camera className="h-4 w-4 text-cyan-300" /> El avatar puede venir de Google o de una URL propia
            </div>
          </div>

          <div className="mt-auto rounded-[1.75rem] border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Vista previa</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-lg font-bold text-white ring-1 ring-white/10">
                {hasRenderableAvatar ? <img src={values.avatar} alt="Avatar actual" className="h-full w-full object-cover" onError={() => setAvatarErrored(true)} /> : avatarInitials}
              </div>
              <div>
                <strong className="block text-base font-semibold text-slate-100">{`${values.names} ${values.lastNames}`.trim() || "Tu nombre"}</strong>
                <p className="text-sm text-slate-400">{values.email || "tu-correo@ejemplo.com"}</p>
              </div>
            </div>
          </div>
        </aside>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-2 border-b border-white/10 pb-5">
            <div className="inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
              Datos personales
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-100">Editar perfil</h2>
            <p className="text-sm text-slate-400">Si cambias username o correo, el sistema verificará disponibilidad antes de guardar.</p>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-100" htmlFor="profile-first-name">Nombres</label>
                <input
                  id="profile-first-name"
                  className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
                  value={values.names}
                  onChange={(event) => {
                    setValues((current) => ({ ...current, names: event.target.value }));
                    if (fieldErrors.names) setFieldErrors((current) => ({ ...current, names: undefined }));
                    if (error) setError("");
                  }}
                  placeholder="José Luis"
                />
                {fieldErrors.names && <p className="text-sm text-rose-300">{fieldErrors.names}</p>}
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-100" htmlFor="profile-last-name">Apellidos</label>
                <input
                  id="profile-last-name"
                  className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
                  value={values.lastNames}
                  onChange={(event) => {
                    setValues((current) => ({ ...current, lastNames: event.target.value }));
                    if (fieldErrors.lastNames) setFieldErrors((current) => ({ ...current, lastNames: undefined }));
                    if (error) setError("");
                  }}
                  placeholder="Muñoz"
                />
                {fieldErrors.lastNames && <p className="text-sm text-rose-300">{fieldErrors.lastNames}</p>}
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-100" htmlFor="profile-username">Username</label>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 focus-within:border-cyan-400/50 focus-within:ring-4 focus-within:ring-cyan-400/10">
                <input
                  id="profile-username"
                  className="h-12 min-w-0 flex-1 bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
                  value={values.username}
                  onChange={(event) => {
                    setValues((current) => ({ ...current, username: event.target.value }));
                    if (fieldErrors.username) setFieldErrors((current) => ({ ...current, username: undefined }));
                    if (error) setError("");
                  }}
                  placeholder="jmunoz"
                />
                <span className={`h-3 w-3 rounded-full ${usernameState === "checking" ? "bg-amber-400" : usernameState === "available" ? "bg-emerald-400" : usernameState === "taken" ? "bg-rose-400" : "bg-slate-500"}`} aria-hidden="true" />
              </div>
              <p className={`text-sm ${usernameState === "available" ? "text-emerald-300" : usernameState === "taken" || usernameState === "error" ? "text-rose-300" : "text-slate-400"}`}>
                {usernameMessage}
              </p>
              {fieldErrors.username && <p className="text-sm text-rose-300">{fieldErrors.username}</p>}
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-100" htmlFor="profile-email">Correo electrónico</label>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 opacity-90">
                <Mail className="h-4 w-4 text-slate-400" />
                <input
                  id="profile-email"
                  className="h-12 min-w-0 flex-1 bg-transparent text-slate-100 outline-none placeholder:text-slate-500"
                  type="email"
                  value={values.email}
                  readOnly
                  tabIndex={-1}
                />
              </div>
              <p className="text-sm text-slate-400">El correo no se puede modificar desde este perfil.</p>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-100" htmlFor="profile-avatar">Avatar</label>
              <input
                id="profile-avatar"
                className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
                value={values.avatar}
                onChange={(event) => {
                  setValues((current) => ({ ...current, avatar: event.target.value }));
                  if (error) setError("");
                }}
                placeholder="https://..."
              />
              <p className="text-sm text-slate-400">Si lo dejas vacío, se mantiene el avatar actual.</p>
            </div>

            {error && <p role="alert" aria-live="polite" className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p>}
            {success && <p role="status" aria-live="polite" className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{success}</p>}

            <div className="flex flex-wrap gap-3 pt-2">
              <button type="submit" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:cursor-progress disabled:opacity-60" disabled={loading}>
                <Save className="h-4 w-4" />
                {loading ? "Guardando..." : "Guardar cambios"}
              </button>
              <button type="button" className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-medium text-slate-100 transition hover:bg-white/10" onClick={onCancel}>
                <ArrowLeft className="h-4 w-4" /> Cancelar
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}