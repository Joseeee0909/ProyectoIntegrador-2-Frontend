import { useEffect, useState } from "react";
import { BookOpen, Clock3, LogOut, Settings, Sparkles } from "lucide-react";
import type { AuthUser } from "../../auth/types";

interface DashboardProps {
  user: AuthUser;
  onLogout: () => void;
  flashMessage?: string;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
}

export function Dashboard({ user, onLogout, flashMessage, onOpenSettings, onOpenProfile }: DashboardProps) {
  const [avatarError, setAvatarError] = useState(false);
  const displayName = [user.names, user.lastNames || user.lastnames || user.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();
  const userInitials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  useEffect(() => {
    setAvatarError(false);
  }, [user.avatar, user.id]);

  const hasRenderableAvatar = Boolean(user.avatar && !avatarError && /^https?:\/\//i.test(user.avatar));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,116,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.08),transparent_26%),linear-gradient(180deg,#070a1f_0%,#030617_100%)] p-4 text-slate-100">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-6 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <strong className="block text-base text-slate-100">StudyRoom</strong>
              <p className="text-sm text-slate-400">Salas colaborativas</p>
            </div>
          </div>

          <nav className="grid gap-2">
            <button type="button" className="flex h-12 items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20">
              <Sparkles className="h-4 w-4" /> Salas
            </button>
            <button type="button" className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/10" onClick={onOpenProfile}>
              <BookOpen className="h-4 w-4" /> Mi perfil
            </button>
            <button type="button" className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/10" onClick={onOpenSettings}>
              <Settings className="h-4 w-4" /> Configuración
            </button>
          </nav>

          <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Estado</p>
           
            <div className="mt-4 text-sm text-slate-400">
              No tienes salas todavía.
            </div>
          </div>

          <div className="mt-auto flex items-center gap-3 border-t border-white/10 pt-4">
            <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-sm font-bold text-white ring-1 ring-white/10">
              {hasRenderableAvatar ? (
                <img
                  src={user.avatar}
                  alt={`Avatar de ${displayName || user.username}`}
                  className="h-full w-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                userInitials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm text-slate-100">{displayName || user.username}</strong>
              <p className="truncate text-sm text-slate-400">{user.email}</p>
            </div>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10" onClick={onLogout} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </aside>

        <main className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <header className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 text-slate-300">
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5">
                <Clock3 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Panel principal</p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-100">Salas</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10" onClick={onOpenProfile}>
                Mi perfil
              </button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10" onClick={onOpenSettings}>
                Configuración
              </button>
            </div>
          </header>

          {flashMessage && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{flashMessage}</div>}

          <section className="flex min-h-[420px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/10 bg-slate-950/40 px-6 py-10 text-center">
            <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-cyan-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">Estado vacío</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-100">No tienes salas</h2>
            <p className="mt-3 max-w-xl text-base leading-8 text-slate-400">
              Cuando crees o te unas a una sala, aparecerá aquí. 
            </p>

            <div className="mt-8 w-full max-w-2xl space-y-3" aria-hidden="true">
              <div className="h-24 animate-pulse rounded-[1.5rem] border border-white/10 bg-gradient-to-r from-white/5 via-white/10 to-white/5" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-16 animate-pulse rounded-[1.25rem] border border-white/10 bg-gradient-to-r from-white/5 via-white/10 to-white/5" />
                <div className="h-16 animate-pulse rounded-[1.25rem] border border-white/10 bg-gradient-to-r from-white/5 via-white/10 to-white/5" />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
