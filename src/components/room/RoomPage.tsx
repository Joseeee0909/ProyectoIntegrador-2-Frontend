import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Image,
  LogOut,
  Mic,
  MoreVertical,
  Paperclip,
  PencilLine,
  ScreenShare,
  Send,
  Settings,
  Sigma,
  Smile,
  Sparkles,
  Trash2,
  Video,
  BookOpen,
  PhoneOff,
} from "lucide-react";
import { useWebRTC } from "../../hooks/useWebRTC";

import type { ReactNode } from "react";
import type { AuthUser } from "../../auth/types";
import { resolveAvatarSrc } from "../../auth/avatar";
import { type StudyRoom, leaveRoom } from "../../services/rooms";
import { type ChatMessage, fetchRoomMessages, normalizeMessage } from "../../services/messages";
import { initSocket, joinRoom as joinSocketRoom, leaveSocketRoom, sendMessage, onNewMessage, offNewMessage, onMessageError, offMessageError } from "../../services/socket";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [callActive, setCallActive] = useState(false);
  useEffect(() => {
    setRoomName(room?.name ?? "");
    setError("");
    setDraft("");
  }, [room?.id, room?.name]);

  const [micActive, setMicActive] = useState(true);

  const handleToggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await stopScreenShare();
      } else {
        await startScreenShare();
      }
    } catch (err) {
      // NotAllowedError = usuario canceló el picker, no es un error real
      if (err instanceof Error && err.name !== "NotAllowedError") {
        setError(err.message);
      }
    }
  };


  const handleToggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setMicActive((prev) => !prev);
  };

  const { startCall, endCall, localStream: localStreamState, startScreenShare, stopScreenShare, isScreenSharing, localStreamRef, remoteStreams } = useWebRTC({
    roomId: room?.id ?? "",
    accessToken,
  });


  const [cameraActive, setCameraActive] = useState(true);

  const handleToggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    stream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setCameraActive((prev) => !prev);
  };

  const startCallRef = useRef(startCall);
  useEffect(() => {
    startCallRef.current = startCall;
  }, [startCall]);

  useEffect(() => {
    if (!room?.id) return;

    let cancelled = false;

    void (async () => {
      try {
        await startCallRef.current();
        if (!cancelled) setCallActive(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo acceder a cámara y micrófono.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [room?.id]);

  // Assign local stream to video element
  useEffect(() => {
    if (!callActive) return;
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [callActive, localStreamState]);
  

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

  const [participants, setParticipants] = useState<Participant[]>([currentParticipant]);

useEffect(() => {
  if (!room) return;

  const sock = initSocket(accessToken);

  // Listen for the full participants list from the server
  const handleParticipants = ({ participants: userList }: { roomId: string; participants: { socketId: string; username: string }[] }) => {
    const others: Participant[] = userList
      .filter((u) => u.socketId !== sock.id)
      .map((u) => ({
        name: u.username,
        initials: u.username.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?",
        accent: "linear-gradient(135deg,#6366f1,#06b6d4)",
        badge: "active",
      }));
    setParticipants([currentParticipant, ...others]);
  };

  const handleUserJoined = (_data: { socketId: string; username: string }) => {
    setParticipants((prev) => {
      if (prev.some((p) => p.name === _data.username)) return prev;
      return [...prev, {
        name: _data.username,
        initials: _data.username.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?",
        accent: "linear-gradient(135deg,#6366f1,#06b6d4)",
        badge: "active",
      }];
    });
  };

  

  const handleUserLeft = () => {
    // On user-left, just rely on room:participants to get the accurate list
  };

  sock.on("room:participants", handleParticipants);
  sock.on("user-joined", handleUserJoined);
  sock.on("user-left", handleUserLeft);

  return () => {
    sock.off("room:participants", handleParticipants);
    sock.off("user-joined", handleUserJoined);
    sock.off("user-left", handleUserLeft);
  };
  }, [room?.id, accessToken]);
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

  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!room) return;

    setError("");
    setDeleteLoading(true);
    try {
      await onDeleteRoom(room.id);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "No pudimos eliminar la sala.");
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
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

  const handleToggleCall = async () => {
    if (callActive) {
      endCall();
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setCallActive(false);
      setMicActive(true);
      setCameraActive(true);
    } else {
      try {
        const stream = await startCall();
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setCallActive(true);
        setMicActive(true);
        setCameraActive(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo iniciar la llamada.");
      }
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
            onToggleCall={handleToggleCall}
            callActive={callActive}
            onScreenShare={handleToggleScreenShare}
            isScreenSharing={isScreenSharing}
            onToggleCamera={handleToggleCamera}   // 👈
            cameraActive={cameraActive}           // 👈
            onToggleMic={handleToggleMic}         // 👈
            micActive={micActive}                 // 👈
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
            <div className="flex min-h-0 flex-1 flex-col xl:flex">
              <ChatPane
                room={room}
                user={user}
                draft={draft}
                onDraftChange={setDraft}
                onSendMessage={handleSendMessage}
                userInitials={userInitials || user.username.slice(0, 2).toUpperCase()}
                avatarSrc={avatarSrc}
                accessToken={accessToken}
                callActive={callActive}
                localVideoRef={localVideoRef}
                remoteStreams={remoteStreams}
              />
            </div>
            <div className="hidden min-h-0 flex-1 flex-col xl:flex">
              <RoomSidebar
                room={room}
                isOwner={isOwner}
                error={error}
                onSubmit={handleSubmit}
                roomName={roomName}
                setRoomName={setRoomName}
                loading={loading}
                onDeleteRoom={confirmDelete}
                participants={participants}  
                roomCode={roomCode}
                ownerLabel={ownerLabel}
                deleteLoading={deleteLoading}
                onShowDeleteConfirm={handleDelete}
              />
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-slate-950 p-6 shadow-2xl shadow-black/40">
            <h3 className="text-xl font-semibold text-slate-100">
              ¿Quieres eliminar esta sala?
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Si continúas, se eliminará la sala y todos sus datos de forma permanente.
              Esta acción no se puede deshacer.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                No, cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteLoading ? "Eliminando..." : "Sí, eliminar sala"}
              </button>
            </div>
          </div>
        </div>
      )}
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
    <aside className="hidden xl:flex h-full flex-col gap-6 overflow-hidden border-b border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl xl:border-b-0 xl:border-r xl:border-white/10">
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

function RoomHeader({ room, onBack, onSettings, onLeaveRoom, memberActionLoading, onToggleCall, callActive, onToggleMic, micActive , onToggleCamera, cameraActive, onScreenShare, isScreenSharing }: {
  room: StudyRoom;
  onBack: () => void;
  onSettings: () => void;
  onLeaveRoom: () => void;
  memberActionLoading: boolean;
  onToggleCall: () => void;
  callActive: boolean;
  onToggleMic: () => void;
  micActive: boolean;
  onToggleCamera: () => void;
  cameraActive: boolean;
  onScreenShare: () => void;
  isScreenSharing: boolean;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-white/10 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:gap-3 xl:px-7">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[rgba(124,106,247,0.15)] text-[#a89cf5]">
          <Sigma className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate font-[Syne,system-ui] text-[15px] font-bold text-white sm:text-base">{room.name}</div>
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
          <button
            type="button"
            onClick={onToggleMic}
            className={`grid h-8 w-8 place-items-center rounded-xl border transition
              ${micActive
                ? "border-white/10 bg-white/5 text-[#7a7f9a] hover:bg-white/10 hover:text-[#c0c4dc]"
                : "border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15"
              }`}
            title={micActive ? "Silenciar" : "Activar micrófono"}
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
              type="button"
              onClick={onToggleCamera}
              className={`grid h-8 w-8 place-items-center rounded-xl border transition
                ${cameraActive
                  ? "border-white/10 bg-white/5 text-[#7a7f9a] hover:bg-white/10 hover:text-[#c0c4dc]"
                  : "border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15"
                }`}
              title={cameraActive ? "Apagar cámara" : "Encender cámara"}
            >
              <Video className="h-4 w-4" />
            </button>
          <button
            type="button"
            onClick={onToggleCall}
            className={`grid h-8 w-8 place-items-center rounded-xl border transition
              ${callActive
                ? "border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15"
                : "border-white/10 bg-white/5 text-[#7a7f9a] hover:bg-white/10 hover:text-[#c0c4dc]"
              }`}
            title={callActive ? "Colgar" : "Iniciar llamada"}
          >
            <PhoneOff className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onScreenShare}
            className={`grid h-8 w-8 place-items-center rounded-xl border transition
              ${isScreenSharing
                ? "border-green-400/30 bg-green-400/10 text-green-300 hover:bg-green-400/15"
                : "border-white/10 bg-white/5 text-[#7a7f9a] hover:bg-white/10 hover:text-[#c0c4dc]"
              }`}
            title={isScreenSharing ? "Dejar de compartir pantalla" : "Compartir pantalla"}
          >
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
  accessToken,
  callActive,
  localVideoRef,
  remoteStreams
}: {
  room: StudyRoom;
  user: AuthUser;
  draft: string;
  onDraftChange: (value: string) => void;
  onSendMessage: () => void;
  userInitials: string;
  avatarSrc: string | null;
  accessToken: string;
  callActive: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteStreams: Map<string, MediaStream>;
}) {
  const PAGE_SIZE = 30;
  const todayLabel = useMemo(() => getDisplayDate(new Date()), []);
  const displayName = [user.names, user.lastNames].filter((part): part is string => Boolean(part && part.trim())).join(" ").trim();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [chatError, setChatError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  // Auto-scroll to bottom only for new messages (not when loading older)
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Load initial messages (most recent PAGE_SIZE)
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoadingMessages(true);
      setChatError("");
      setHasMore(true);
      isInitialLoad.current = true;
      try {
        const history = await fetchRoomMessages(room.id, accessToken, { limit: PAGE_SIZE });
        if (!cancelled) {
          setMessages(history);
          if (history.length < PAGE_SIZE) {
            setHasMore(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setChatError(err instanceof Error ? err.message : "Error cargando mensajes.");
        }
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      }
    }

    void loadHistory();
    return () => { cancelled = true; };
  }, [room.id, accessToken]);

  // Scroll to bottom after initial load
  useEffect(() => {
    if (!loadingMessages && isInitialLoad.current) {
      isInitialLoad.current = false;
      setTimeout(() => scrollToBottom("instant"), 50);
    }
  }, [loadingMessages]);

  // Load older messages when scrolling to top
  const loadOlderMessages = async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;

    const oldestMessage = messages[0];
    if (!oldestMessage) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const prevScrollHeight = container.scrollHeight;
    const prevScrollTop = container.scrollTop;

    setLoadingOlder(true);
    try {
      const olderMessages = await fetchRoomMessages(room.id, accessToken, {
        limit: PAGE_SIZE,
        before: oldestMessage.id,
      });

      if (olderMessages.length < PAGE_SIZE) {
        setHasMore(false);
      }

      if (olderMessages.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMessages = olderMessages.filter((m) => !existingIds.has(m.id));
          return [...newMessages, ...prev];
        });

        // Restore scroll position after DOM updates
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
          }
        });
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Error cargando mensajes anteriores.");
      setTimeout(() => setChatError(""), 4000);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Scroll event handler for infinite scroll upward
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop < 80 && hasMore && !loadingOlder) {
        void loadOlderMessages();
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [hasMore, loadingOlder, messages]);

  // Connect to socket and listen for real-time messages
  useEffect(() => {
    const sock = initSocket(accessToken);

    const handleConnect = () => {
      joinSocketRoom(room.id, displayName || user.username);
    };

    // If already connected, join immediately
    if (sock.connected) {
      handleConnect();
    } else {
      sock.on("connect", handleConnect);
    }

    const handleNewMessage = (raw: unknown) => {
      const msg = normalizeMessage(raw);
      if (msg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Auto-scroll on new messages
        setTimeout(() => scrollToBottom(), 50);
      }
    };

    const handleError = (error: { message: string }) => {
      setChatError(error.message);
      setTimeout(() => setChatError(""), 4000);
    };

    onNewMessage(handleNewMessage);
    onMessageError(handleError);

    return () => {
      sock.off("connect", handleConnect);
      offNewMessage(handleNewMessage);
      offMessageError(handleError);
      leaveSocketRoom(room.id);
    };
  }, [room.id, accessToken]);

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) return; // Block empty messages

    sendMessage(room.id, trimmed, accessToken);
    onDraftChange("");
    onSendMessage();
  };

  const currentUserId = user.id || user.uid || user.firestoreId || "";

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden xl:min-w-0">
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        {/* Loading older messages indicator */}
        {loadingOlder && (
          <div className="mb-3 flex justify-center py-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-400">
              <div className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-cyan-300" />
              Cargando mensajes anteriores...
            </div>
          </div>
        )}

        {/* No more messages indicator */}
        {!hasMore && messages.length > 0 && (
          <div className="mb-3 flex justify-center py-2">
            <span className="text-[10px] uppercase tracking-[0.5px] text-[#3a3f5a]">— Inicio de la conversación —</span>
          </div>
        )}

        <div className="mb-4 flex items-center gap-3 py-2">
          <hr className="flex-1 border-white/5" />
          <span className="text-[10px] uppercase tracking-[0.5px] text-[#3a3f5a] sm:text-[11px]">hoy — {todayLabel}</span>
          <hr className="flex-1 border-white/5" />
        </div>

        {chatError && (
          <div className="mb-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {chatError}
          </div>
        )}

        {loadingMessages ? (
          <div className="grid min-h-[300px] place-items-center sm:min-h-[420px]">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-cyan-300" />
              <p className="mt-4 text-sm text-slate-400">Cargando mensajes...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="grid min-h-[300px] place-items-center rounded-[1.5rem] border border-dashed border-white/10 bg-slate-950/30 px-4 py-8 text-center sm:min-h-[420px] sm:px-6 sm:py-10">
            <div className="w-full max-w-2xl">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-cyan-300 sm:h-14 sm:w-14">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">No hay mensajes todavía</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">Escribe el primer mensaje para arrancar la conversación de esta sala.</p>

              <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3">
                <SkeletonMessage />
                <SkeletonMessage />
                <SkeletonMessage className="hidden lg:block" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isOwnMessage = msg.senderId === currentUserId;
              return (
                <div key={msg.id} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${isOwnMessage ? "bg-gradient-to-r from-violet-500/20 to-cyan-500/20 border border-violet-400/20" : "border border-white/10 bg-white/5"}`}>
                    {!isOwnMessage && (
                      <p className="mb-1 text-[11px] font-medium text-cyan-300">{msg.senderName || msg.senderId.slice(0, 8)}</p>
                    )}
                    <p className="text-sm leading-6 text-slate-100 break-words">{msg.content}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {new Date(msg.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {callActive && (
        <div className="shrink-0 border-t border-white/5 bg-[#0d0f1a] px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {/* Local video */}
            <div className="relative h-28 w-36 rounded-2xl border border-violet-400/30 bg-black">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full rounded-2xl object-cover"
              />
              <span className="absolute bottom-1 left-2 text-[10px] text-white/70">Tú</span>
            </div>
            {/* Remote videos — one per peer */}
            {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
              <RemoteVideo key={peerId} stream={stream} peerId={peerId} />
            ))}
          </div>
        </div>
      )}

      <footer className="shrink-0 border-t border-white/5 bg-[#0d0f1a] px-3 py-3 sm:px-5 sm:py-4">
        <div className="mb-2 flex flex-wrap gap-2 sm:mb-3">
          <QuickChip icon={Paperclip} label="Adjuntar" />
          <QuickChip icon={Image} label="Imagen" />
          <QuickChip icon={Sigma} label="LaTeX" />
          <QuickChip icon={Smile} label="" compact />
        </div>
        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-[#181b2d] px-3 py-2.5 focus-within:border-violet-500/35 sm:px-3.5 sm:py-3">
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
            className="min-h-[20px] max-h-[88px] flex-1 resize-none bg-transparent text-[14px] leading-6 text-[#c0c4dc] outline-none placeholder:text-[#2e3350] sm:max-h-[96px]"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c6af7] to-[#5b8aea] text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed sm:h-10 sm:w-10"
            onClick={handleSend}
            disabled={!draft.trim()}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </section>
  );
}

function RoomSidebar({room, roomCode, participants, isOwner, error, onSubmit, roomName, setRoomName, loading, onDeleteRoom: _onDeleteRoom, ownerLabel, deleteLoading, onShowDeleteConfirm }: {
  room: StudyRoom;
  roomCode: string;
  participants: Participant[];
  isOwner: boolean;
  error: string;
  onSubmit: (event: FormEvent) => Promise<void>;
  roomName: string;
  setRoomName: (value: string) => void;
  loading: boolean;
  onDeleteRoom: () => Promise<void>;
  ownerLabel: string;
  deleteLoading: boolean;
  onShowDeleteConfirm: () => void;
}) {
  return (
    <aside className="flex w-full min-h-0 flex-col overflow-hidden border-t border-white/5 bg-[#111320] xl:w-[340px] xl:min-w-[340px] xl:border-l xl:border-t-0 xl:border-white/5">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
        <Section title="Sala">
        <div className="grid min-w-0 gap-3 text-sm text-slate-300">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Código</p>
            <p className="mt-2 break-all font-mono text-sm text-slate-100">{roomCode}</p>
            <p className="mt-2 truncate text-xs text-slate-500">Sala: {room.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              Propietario: <span className="block truncate">{ownerLabel || room.ownerUsername}</span>
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Participantes ({participants.length})
            </p>
            <div className="mt-3 grid gap-2">
              {participants.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white"
                    style={{ background: p.accent }}
                  >
                    {p.avatarSrc ? (
                      <img src={p.avatarSrc} alt={p.name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      p.initials
                    )}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-100" title={p.name}>{p.name}</p>
                  <span className="shrink-0 h-2 w-2 rounded-full bg-emerald-400" title="Activo" />
                </div>
              ))}
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

<div className="grid gap-2 sm:grid-cols-2">
                <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:cursor-progress disabled:opacity-60" disabled={loading}>
                  <PencilLine className="h-4 w-4" /> {loading ? "Guardando..." : "Editar sala"}
                </button>
                <button type="button" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 text-sm font-medium text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-progress disabled:opacity-60" onClick={onShowDeleteConfirm} disabled={loading || deleteLoading}>
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
    <section className="border-t border-white/5 px-3 py-4 first:border-t-0 sm:px-4">
      <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.6px] text-[#3a3f5a]">{title}</div>
      {children}
    </section>
  );
}

function RemoteVideo({ stream, peerId }: { stream: MediaStream; peerId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative h-28 w-36 rounded-2xl border border-white/10 bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="h-full w-full rounded-2xl object-cover"
      />
      <span className="absolute bottom-1 left-2 text-[10px] text-white/70">{peerId.slice(0, 6)}</span>
    </div>
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
