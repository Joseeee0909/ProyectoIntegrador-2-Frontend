import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Image,
  LogOut,
  Mic,
  MoreVertical,
  Paperclip,
  PencilLine,
  ScreenShare,
  Settings,
  Sigma,
  Smile,
  Sparkles,
  Trash2,
  Video,
  BookOpen,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AuthUser } from "../../auth/types";
import { resolveAvatarSrc } from "../../auth/avatar";
import { type StudyRoom, leaveRoom } from "../../services/rooms";

interface RoomPageProps {
  room: StudyRoom | null;
  roomLoading: boolean;
  user: AuthUser;
  accessToken: string;
  onBack: () => void;
  onOpenProfile: () => void;
  onSettings: () => void;
  onLogout: () => void;
  onRenameRoom: (roomId: string, name: string) => Promise<void>;
  onDeleteRoom: (roomId: string) => Promise<void>;
}

type Participant = {
  name: string;
  initials: string;
  accent: string;
  avatarSrc?: string;
  badge?: string;
};

function getDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}


function getJwtSubject(token: string) {
  if (!token) return "";

  const parts = token.split(".");
  if (parts.length !== 3) return "";

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { sub?: string; uid?: string };
    return payload.uid || payload.sub || "";
  } catch {
    return "";
  }
}
export function RoomPage({ room, roomLoading, user, accessToken, onBack, onOpenProfile, onSettings, onLogout, onRenameRoom, onDeleteRoom }: RoomPageProps) {
  const [roomName, setRoomName] = useState(room?.name ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [memberActionLoading, setMemberActionLoading] = useState(false);

  useEffect(() => {
    setRoomName(room?.name ?? "");
    setError("");
    setDraft("");
  }, [room?.id, room?.name]);

  const displayName = [user.names, user.lastNames].filter((part): part is string => Boolean(part && part.trim())).join(" ").trim();
  const avatarSrc = resolveAvatarSrc(user.avatar);
  const userInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  const roomCode = room?.id ?? "--";
  const currentParticipant: Participant = {
    name: displayName || user.username,
    initials: userInitials || user.username.slice(0, 2).toUpperCase(),
    accent: "linear-gradient(135deg,#f97316,#ec4899)",
    avatarSrc: resolveAvatarSrc(user.avatar),
    badge: "active",
  };
  const tokenSubject = getJwtSubject(accessToken);
  const isOwner = Boolean(
    room
      && (room.ownerId === user.id
        || room.ownerId === user.uid
        || room.ownerId === user.firestoreId
        || room.ownerId === tokenSubject),
  );
  const ownerLabel = isOwner ? user.username : room?.ownerId || "";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!room || !isOwner) return;

    setError("");
    setLoading(true);
    try {
      await onRenameRoom(room.id, roomName);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "No pudimos actualizar la sala.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!room || !isOwner) return;

    setError("");
    setLoading(true);
    try {
      await onDeleteRoom(room.id);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "No pudimos eliminar la sala.");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!room) return;

    setMemberActionLoading(true);
    try {
      await leaveRoom(room.id, accessToken);
      onBack();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "No pudimos salir de la sala.");
    } finally {
      setMemberActionLoading(false);
    }
  };

  const handleSendMessage = () => {
    setDraft("");
  };

  if (roomLoading) {
    return (
      <div className="grid h-screen place-items-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(124,116,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.08),transparent_26%),linear-gradient(180deg,#070a1f_0%,#030617_100%)] p-4 text-slate-100">
        <section className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-2 border-white/20 border-t-cyan-300" aria-hidden="true" />
          <h1 className="mt-6 text-4xl font-semibold tracking-tight">Cargando sala</h1>
          <p className="mt-3 text-slate-400">Consultando el backend para recuperar la información de este espacio.</p>
        </section>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="grid h-screen place-items-center overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(124,116,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.08),transparent_26%),linear-gradient(180deg,#070a1f_0%,#030617_100%)] p-4 text-slate-100">
        <section className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-amber-100">
            <Sparkles className="h-4 w-4" /> Sala no encontrada
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight">No pudimos cargar esta sala</h1>
          <p className="mt-3 text-slate-400">Puede haber sido eliminada o todavía no existe. Vuelve al dashboard para crear o abrir otra sala.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 transition hover:bg-white/10" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>
            <button type="button" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5" onClick={onSettings}>
              <Settings className="h-4 w-4" /> Configuración
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(124,116,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.08),transparent_26%),linear-gradient(180deg,#070a1f_0%,#030617_100%)] p-4 text-slate-100">
      <div className="mx-auto grid h-full w-full max-w-[1600px] grid-cols-1 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl shadow-black/20 backdrop-blur-xl xl:grid-cols-[280px_minmax(0,1fr)]">
        <DashboardSidebar
          user={user}
          onBack={onBack}
          onOpenProfile={onOpenProfile}
          onSettings={onSettings}
          onLogout={onLogout}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-t border-white/10 bg-[linear-gradient(180deg,rgba(15,24,54,0.95),rgba(14,18,44,0.94)),radial-gradient(circle_at_bottom_right,rgba(124,116,255,0.3),transparent_34%)] xl:border-l xl:border-t-0 xl:border-white/10">
          <RoomHeader
            room={room}
            onBack={onBack}
            onSettings={onSettings}
            onLeaveRoom={handleLeaveRoom}
            memberActionLoading={memberActionLoading}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
            <ChatPane
              room={room}
              user={user}
              draft={draft}
              onDraftChange={setDraft}
              onSendMessage={handleSendMessage}
              userInitials={userInitials || user.username.slice(0, 2).toUpperCase()}
              avatarSrc={avatarSrc}
            />
            <RoomSidebar
              room={room}
              isOwner={isOwner}
              error={error}
              onSubmit={handleSubmit}
              roomName={roomName}
              setRoomName={setRoomName}
              loading={loading}
              onDeleteRoom={handleDelete}
              participant={currentParticipant}
              roomCode={roomCode}
              ownerLabel={ownerLabel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSidebar({ user, onBack, onOpenProfile, onSettings, onLogout }: {
  user: AuthUser;
  onBack: () => void;
  onOpenProfile: () => void;
  onSettings: () => void;
  onLogout: () => void;
}) {
  const displayName = [user.names, user.lastNames].filter((part): part is string => Boolean(part && part.trim())).join(" ").trim();
  const avatarSrc = resolveAvatarSrc(user.avatar);
  const userInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <aside className="flex h-full flex-col gap-6 overflow-hidden border-b border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl xl:border-b-0 xl:border-r xl:border-white/10">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/20">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <strong className="block text-base text-slate-100">StudyRoom</strong>
          <p className="text-sm text-slate-400">Salas colaborativas</p>
        </div>
      </div>

      <button type="button" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 transition hover:bg-white/10" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <nav className="grid gap-2">
        <button type="button" className="flex h-12 items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20">
          <Sparkles className="h-4 w-4" /> Salas
        </button>
        <button type="button" className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/10" onClick={onOpenProfile}>
          <BookOpen className="h-4 w-4" /> Mi perfil
        </button>
        <button type="button" className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/10" onClick={onSettings}>
          <Settings className="h-4 w-4" /> Configuración
        </button>
      </nav>

      <div className="mt-auto flex items-center gap-3 border-t border-white/10 pt-4">
        <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-sm font-bold text-white ring-1 ring-white/10">
          {avatarSrc ? (
            <img src={avatarSrc} alt={`Avatar de ${displayName || user.username}`} className="h-full w-full object-cover" />
          ) : (
            userInitials || user.username.slice(0, 2).toUpperCase()
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
  );
}

function RoomHeader({ room, onBack, onSettings, onLeaveRoom, memberActionLoading }: {
  room: StudyRoom;
  onBack: () => void;
  onSettings: () => void;
  onLeaveRoom: () => void;
  memberActionLoading: boolean;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:gap-3 xl:px-7">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[rgba(124,106,247,0.15)] text-[#a89cf5]">
          <Sigma className="h-5 w-5" />
        </div>
        <div>
          <div className="font-[Syne,system-ui] text-[15px] font-bold text-white">{room.name}</div>
          <div className="mt-1 text-[11px] text-[#5a5f7a]">Sesión activa</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
        <button type="button" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> Salas
        </button>
        <button type="button" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/10" onClick={onSettings}>
          <Settings className="h-3.5 w-3.5" /> Ajustes
        </button>
        <button type="button" className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-progress disabled:opacity-60" onClick={onLeaveRoom} disabled={memberActionLoading}>
          <LogOut className="h-3.5 w-3.5" /> {memberActionLoading ? "Saliendo..." : "Salir"}
        </button>
        <div className="flex items-center gap-1.5">
          <button type="button" className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-[#7a7f9a] transition hover:bg-white/10 hover:text-[#c0c4dc]">
            <Mic className="h-4 w-4" />
          </button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-[#7a7f9a] transition hover:bg-white/10 hover:text-[#c0c4dc]">
            <Video className="h-4 w-4" />
          </button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-[#7a7f9a] transition hover:bg-white/10 hover:text-[#c0c4dc]">
            <ScreenShare className="h-4 w-4" />
          </button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-[#7a7f9a] transition hover:bg-white/10 hover:text-[#c0c4dc]">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function ChatPane({
  room,
  user,
  draft,
  onDraftChange,
  onSendMessage,
  userInitials,
  avatarSrc,
}: {
  room: StudyRoom;
  user: AuthUser;
  draft: string;
  onDraftChange: (value: string) => void;
  onSendMessage: () => void;
  userInitials: string;
  avatarSrc: string | null;
}) {
  const todayLabel = useMemo(() => getDisplayDate(new Date()), []);
  const displayName = [user.names, user.lastNames].filter((part): part is string => Boolean(part && part.trim())).join(" ").trim();

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden xl:min-w-0">
      <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
        <div className="mb-4 flex items-center gap-3 py-2">
          <hr className="flex-1 border-white/5" />
          <span className="text-[10px] uppercase tracking-[0.5px] text-[#3a3f5a]">hoy — {todayLabel}</span>
          <hr className="flex-1 border-white/5" />
        </div>

        <div className="grid min-h-[420px] place-items-center rounded-[1.75rem] border border-dashed border-white/10 bg-slate-950/30 px-6 py-10 text-center">
          <div className="w-full max-w-2xl">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-cyan-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-100">No hay mensajes todavía</h2>
            <p className="mt-3 text-base leading-7 text-slate-400">Esta sala está vacía por ahora. Cuando existan mensajes reales, aparecerán aquí.</p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SkeletonMessage />
              <SkeletonMessage />
              <SkeletonMessage className="hidden lg:block" />
            </div>
          </div>
        </div>
      </div>
      <footer className="shrink-0 border-t border-white/5 bg-[#0d0f1a] px-4 py-3 sm:px-5">
        <div className="mb-2 flex flex-wrap gap-2">
          <QuickChip icon={Paperclip} label="Adjuntar" />
          <QuickChip icon={Image} label="Imagen" />
          <QuickChip icon={Sigma} label="LaTeX" />
          <QuickChip icon={Smile} label="" compact />
        </div>
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#181b2d] px-3 py-2.5 focus-within:border-violet-500/35">
          <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-white/10 text-xs font-semibold text-white">
            {avatarSrc ? (
              <img src={avatarSrc} alt={`Avatar de ${displayName || user.username}`} className="h-full w-full object-cover" />
            ) : (
              userInitials
            )}
          </div>
          <textarea
            rows={1}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder={`Escribe un mensaje en ${room.name}...`}
            className="min-h-[20px] max-h-[72px] flex-1 resize-none bg-transparent text-[13px] leading-6 text-[#c0c4dc] outline-none placeholder:text-[#2e3350]"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSendMessage();
              }
            }}
          />
          <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c6af7] to-[#5b8aea] text-white transition hover:opacity-90" onClick={onSendMessage}>
            <Paperclip className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </section>
  );
}

function RoomSidebar({ room, roomCode, participant, isOwner, error, onSubmit, roomName, setRoomName, loading, onDeleteRoom, ownerLabel }: {
  room: StudyRoom;
  roomCode: string;
  participant: Participant;
  isOwner: boolean;
  error: string;
  onSubmit: (event: FormEvent) => Promise<void>;
  roomName: string;
  setRoomName: (value: string) => void;
  loading: boolean;
  onDeleteRoom: () => Promise<void>;
  ownerLabel: string;
}) {
  return (
    <aside className="flex w-full min-h-0 flex-col overflow-hidden border-t border-white/5 bg-[#111320] xl:w-[340px] xl:min-w-[340px] xl:border-l xl:border-t-0 xl:border-white/5">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Section title="Sala">
        <div className="grid gap-3 text-sm text-slate-300">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Código</p>
            <p className="mt-2 font-mono text-sm text-slate-100">{roomCode}</p>
            <p className="mt-2 text-xs text-slate-500">Sala: {room.name}</p>
            <p className="mt-1 text-xs text-slate-500">Propietario: {ownerLabel || room.ownerUsername}</p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Participantes</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: participant.accent }}>
                {participant.avatarSrc ? (
                  <img src={participant.avatarSrc} alt={`Avatar de ${participant.name}`} className="h-full w-full rounded-full object-cover" />
                ) : (
                  participant.initials
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">{participant.name}</p>
                <p className="text-xs text-slate-500">Usuario activo</p>
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-emerald-100">active</span>
            </div>
          </div>

          {isOwner ? (
            <form className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-slate-950/40 p-4" onSubmit={onSubmit} noValidate>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Editar nombre</p>
                <input
                  className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  placeholder="Nuevo nombre de sala"
                />
              </div>

              {error ? <p role="alert" className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}

              <div className="flex flex-wrap gap-2">
                <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:cursor-progress disabled:opacity-60" disabled={loading}>
                  <PencilLine className="h-4 w-4" /> {loading ? "Guardando..." : "Editar sala"}
                </button>
                <button type="button" className="inline-flex h-10 items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 text-sm font-medium text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-progress disabled:opacity-60" onClick={() => void onDeleteRoom()} disabled={loading}>
                  <Trash2 className="h-4 w-4" /> Eliminar sala
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
              No eres el creador de esta sala, así que solo puedes interactuar con el chat y salir de la sala.
            </div>
          )}
        </div>
      </Section>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-white/5 px-4 py-4 first:border-t-0">
      <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.6px] text-[#3a3f5a]">{title}</div>
      {children}
    </section>
  );
}

function QuickChip({ icon: Icon, label, compact }: { icon: typeof Paperclip; label: string; compact?: boolean }) {
  return (
    <button type="button" className={`inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-[#4a4f6a] transition hover:bg-white/10 hover:text-[#9498b4] ${compact ? "px-2" : ""}`}>
      <Icon className="h-3.5 w-3.5" />
      {label ? <span>{label}</span> : null}
    </button>
  );
}

function SkeletonMessage({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[1.5rem] border border-white/10 bg-white/5 p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
          <div className="h-2.5 w-16 animate-pulse rounded-full bg-white/5" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full animate-pulse rounded-full bg-white/10" />
        <div className="h-3 w-5/6 animate-pulse rounded-full bg-white/10" />
        <div className="h-3 w-3/4 animate-pulse rounded-full bg-white/5" />
      </div>
    </div>
  );
}
