import { type FormEvent, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, BookOpen, Hash, LogOut, PencilLine, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { ToastProvider } from "./components/ui/Toast";
import { AuthPage } from "./components/auth/AuthPage";
import { UsernameSelection } from "./components/auth/UsernameSelection";
import { Dashboard } from "./components/dashboard/Dashboard";
import { ProfilePage } from "./components/profile/ProfilePage";
import { bootstrapAuthState, cancelGoogleSignIn, completeGoogleUsername, isSessionValid, signOut, startGoogleSignIn } from "./auth/mockAuth";
import type { AuthSession, GoogleAuthProfile } from "./auth/types";
import { createRoom, deleteRoom, getRoomById, listRooms, updateRoom, type StudyRoom } from "./services/rooms";

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </BrowserRouter>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState<GoogleAuthProfile | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [flashMessage, setFlashMessage] = useState("");
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState("");
  const [activeRoom, setActiveRoom] = useState<StudyRoom | null>(null);
  const [activeRoomLoading, setActiveRoomLoading] = useState(false);
  const sessionIsValid = useMemo(() => isSessionValid(session), [session]);
  const activeUser = useMemo(() => (sessionIsValid ? session?.user ?? null : null), [session, sessionIsValid]);
  const roomId = useMemo(() => {
    const match = location.pathname.match(/^\/sala\/([^/]+)/);
    return match?.[1] ?? null;
  }, [location.pathname]);

  useEffect(() => {
    const initialState = bootstrapAuthState();
    setSession(initialState.session);
    setPendingGoogleProfile(initialState.pendingGoogleProfile);
    setBootstrapping(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRooms() {
      if (!sessionIsValid || !activeUser) {
        setRooms([]);
        setRoomsError("");
        return;
      }

      setRoomsLoading(true);
      setRoomsError("");

      try {
        const nextRooms = await listRooms(session?.accessToken ?? "");
        if (cancelled) return;
        setRooms(nextRooms);
      } catch (error) {
        if (cancelled) return;
        setRooms([]);
        setRoomsError(error instanceof Error ? error.message : "No pudimos cargar tus salas desde el backend.");
      } finally {
        if (!cancelled) {
          setRoomsLoading(false);
        }
      }
    }

    void loadRooms();

    return () => {
      cancelled = true;
    };
  }, [activeUser, session?.accessToken, sessionIsValid]);

  useEffect(() => {
    let cancelled = false;

    async function loadActiveRoom() {
      if (!sessionIsValid || !activeUser || !roomId) {
        setActiveRoom(null);
        setActiveRoomLoading(false);
        return;
      }

      const cachedRoom = rooms.find((room) => room.id === roomId);
      if (cachedRoom) {
        setActiveRoom(cachedRoom);
        setActiveRoomLoading(false);
        return;
      }

      setActiveRoomLoading(true);

      try {
        const nextRoom = await getRoomById(roomId, session?.accessToken ?? "");
        if (cancelled) return;
        setActiveRoom(nextRoom);
      } catch {
        if (cancelled) return;
        setActiveRoom(null);
      } finally {
        if (!cancelled) {
          setActiveRoomLoading(false);
        }
      }
    }

    void loadActiveRoom();

    return () => {
      cancelled = true;
    };
  }, [activeUser, roomId, rooms, session?.accessToken, sessionIsValid]);

  useEffect(() => {
    if (bootstrapping) return;

    if (location.pathname === "/") {
      navigate(session ? "/dashboard" : "/login", { replace: true });
      return;
    }

    if (session && (location.pathname === "/login" || location.pathname === "/register" || location.pathname === "/auth/google/username")) {
      navigate("/dashboard", { replace: true });
      return;
    }

    if (!session && (location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/perfil") || location.pathname.startsWith("/configuracion") || location.pathname.startsWith("/sala/"))) {
      navigate("/login", { replace: true });
      return;
    }

    if (location.pathname === "/auth/google/username" && !pendingGoogleProfile) {
      navigate("/login", { replace: true });
    }
  }, [bootstrapping, location.pathname, navigate, pendingGoogleProfile, session]);

  const syncSession = (message: string) => {
    const currentState = bootstrapAuthState();
    setSession(currentState.session);
    setPendingGoogleProfile(currentState.pendingGoogleProfile);
    setFlashMessage(message);
    navigate("/dashboard", { replace: true });
  };

  const handleProfileSaved = (message: string) => {
    const currentState = bootstrapAuthState();
    setSession(currentState.session);
    setPendingGoogleProfile(currentState.pendingGoogleProfile);
    setFlashMessage(message);
    navigate("/dashboard", { replace: true });
  };

  const handleGoogleSignIn = async () => {
    const result = await startGoogleSignIn();
    if (result.requiresUsername) {
      setPendingGoogleProfile(result.profile);
      setSession(null);
      navigate("/auth/google/username");
      return;
    }

    syncSession("Login con Google completado.");
  };

  const handleLogout = () => {
    signOut();
    setSession(null);
    setPendingGoogleProfile(null);
    setFlashMessage("");
    navigate("/login", { replace: true });
  };

  const handleCreateRoom = async (name: string) => {
    if (!activeUser) {
      throw new Error("Debes iniciar sesión para crear una sala.");
    }

    const room = await createRoom({ name }, session?.accessToken ?? "");
    setRooms((current) => [room, ...current.filter((existing) => existing.id !== room.id)]);
    setFlashMessage(`Sala "${room.name}" creada con éxito.`);
    navigate(`/sala/${room.id}`);
  };

  const handleRenameRoom = async (roomToRenameId: string, name: string) => {
    if (!activeUser) {
      throw new Error("Debes iniciar sesión para editar una sala.");
    }

    const updatedRoom = await updateRoom(roomToRenameId, { name }, session?.accessToken ?? "");
    setRooms((current) => current.map((room) => (room.id === updatedRoom.id ? updatedRoom : room)));
    setFlashMessage("Sala actualizada correctamente.");
  };

  const handleDeleteRoom = async (roomToDeleteId: string) => {
    if (!activeUser) {
      throw new Error("Debes iniciar sesión para eliminar una sala.");
    }

    await deleteRoom(roomToDeleteId, session?.accessToken ?? "");
    setRooms((current) => current.filter((room) => room.id !== roomToDeleteId));
    setFlashMessage("Sala eliminada correctamente.");
    navigate("/dashboard", { replace: true });
  };

  useEffect(() => {
    if (session && !sessionIsValid) {
      handleLogout();
    }
  }, [session, sessionIsValid]);

  const handleUsernameBack = () => {
    cancelGoogleSignIn();
    setPendingGoogleProfile(null);
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/login", { replace: true });
  };

  if (bootstrapping) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={sessionIsValid ? "/dashboard" : "/login"} replace />} />
      <Route
        path="/login"
        element={
          sessionIsValid ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AuthPage
              activeTab="login"
              onTabChange={(tab) => navigate(tab === "login" ? "/login" : "/register")}
              onLoginSuccess={() => syncSession("Inicio de sesión completado.")}
              onRegisterSuccess={() => syncSession("Registro completado.")}
              onGoogleSignIn={handleGoogleSignIn}
            />
          )
        }
      />
      <Route
        path="/register"
        element={
          sessionIsValid ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AuthPage
              activeTab="register"
              onTabChange={(tab) => navigate(tab === "login" ? "/login" : "/register")}
              onLoginSuccess={() => syncSession("Inicio de sesión completado.")}
              onRegisterSuccess={() => syncSession("Registro completado.")}
              onGoogleSignIn={handleGoogleSignIn}
            />
          )
        }
      />
      <Route
        path="/auth/google/username"
        element={
          pendingGoogleProfile ? (
            <UsernameSelection
              profile={pendingGoogleProfile}
              onBack={handleUsernameBack}
              onComplete={async (username) => {
                await completeGoogleUsername(username);
                syncSession("Perfil completado. Ya puedes usar el dashboard.");
              }}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          activeUser ? (
            <Dashboard
              user={activeUser}
              flashMessage={flashMessage}
              rooms={rooms}
              roomsLoading={roomsLoading}
              roomsError={roomsError}
              onCreateRoom={handleCreateRoom}
              onOpenRoom={(id) => navigate(`/sala/${id}`)}
              onLogout={handleLogout}
              onOpenSettings={() => navigate("/configuracion")}
              onOpenProfile={() => navigate("/perfil")}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/perfil"
        element={activeUser ? <ProfilePage user={activeUser} onCancel={() => navigate("/dashboard")} onSaved={handleProfileSaved} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/configuracion"
        element={activeUser ? <SettingsPage onBack={() => navigate("/dashboard")} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/sala/:roomId"
        element={activeUser && roomId ? <RoomPage room={activeRoom} roomLoading={activeRoomLoading} user={activeUser} onBack={() => navigate("/dashboard")} onSettings={() => navigate("/configuracion")} onLogout={handleLogout} onRenameRoom={handleRenameRoom} onDeleteRoom={handleDeleteRoom} /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to={sessionIsValid ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(124,116,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.08),transparent_26%),linear-gradient(180deg,#070a1f_0%,#030617_100%)] p-4 text-slate-100">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">Cargando</div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">Preparando sesión...</h2>
        <p className="mt-3 text-slate-400">Verificando el backend y leyendo el estado local.</p>
      </div>
    </div>
  );
}

function SettingsPage({ onBack, onLogout }: { onBack: () => void; onLogout: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(124,116,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.08),transparent_26%),linear-gradient(180deg,#070a1f_0%,#030617_100%)] p-4 text-slate-100">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="mx-auto inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
          <BookOpen className="h-4 w-4 text-cyan-300" /> StudyRoom
        </div>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight">Configuración</h1>
        <p className="mt-3 text-slate-400">Pronto</p>

        <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-slate-950/40 p-6 text-slate-300">
          Esta sección estará disponible pronto.
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 transition hover:bg-white/10" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <button type="button" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5" onClick={onLogout}>
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </section>
    </div>
  );
}

function RoomPage({
  room,
  roomLoading,
  user,
  onBack,
  onSettings,
  onLogout,
  onRenameRoom,
  onDeleteRoom,
}: {
  room: StudyRoom | null;
  roomLoading: boolean;
  user: AuthSession["user"];
  onBack: () => void;
  onSettings: () => void;
  onLogout: () => void;
  onRenameRoom: (roomId: string, name: string) => Promise<void>;
  onDeleteRoom: (roomId: string) => Promise<void>;
}) {
  const [roomName, setRoomName] = useState(room?.name ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRoomName(room?.name ?? "");
    setError("");
  }, [room?.id, room?.name]);

  const isOwner = Boolean(room && room.ownerId === user.id);

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

  if (roomLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(124,116,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.08),transparent_26%),linear-gradient(180deg,#070a1f_0%,#030617_100%)] p-4 text-slate-100">
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
      <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(124,116,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.08),transparent_26%),linear-gradient(180deg,#070a1f_0%,#030617_100%)] p-4 text-slate-100">
        <section className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-amber-100">
            <AlertTriangle className="h-4 w-4" /> Sala no encontrada
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight">No pudimos cargar esta sala</h1>
          <p className="mt-3 text-slate-400">Puede haber sido eliminada o todavía no existe. Vuelve al dashboard para crear o abrir otra sala.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 transition hover:bg-white/10" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>
            <button type="button" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5" onClick={onSettings}>
              <Sparkles className="h-4 w-4" /> Configuración
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(124,116,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.08),transparent_26%),linear-gradient(180deg,#070a1f_0%,#030617_100%)] p-4 text-slate-100">
      <section className="w-full max-w-4xl rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
            <BookOpen className="h-4 w-4 text-cyan-300" /> StudyRoom
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">Sala en tiempo real</div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">{room.name}</h1>
            <p className="mt-3 max-w-2xl text-slate-400">Interacción en tiempo real para videollamada, chat y participantes activos. Socket.io queda pendiente de conectar al backend.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">Activa</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">En vivo</span>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.75rem] border border-white/10 bg-slate-950/40 p-5">
            <p className="text-sm text-slate-400">Participantes</p>
            <strong className="mt-2 block text-3xl">1</strong>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-slate-950/40 p-5">
            <p className="text-sm text-slate-400">Chat</p>
            <strong className="mt-2 block text-3xl">0</strong>
          </article>
          <article className="rounded-[1.75rem] border border-white/10 bg-slate-950/40 p-5">
            <p className="text-sm text-slate-400">Estado</p>
            <strong className="mt-2 block text-3xl">Activo</strong>
          </article>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 text-slate-300">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-100">
              <Hash className="h-4 w-4 text-cyan-300" /> Datos de la sala
            </div>
            <p className="mt-3 text-slate-400">ID: {room.id}</p>
            <p className="mt-2 text-slate-400">Propietario: {room.ownerUsername}</p>
            <p className="mt-2 text-slate-400">Creada: {new Date(room.createdAt).toLocaleString()}</p>
            <p className="mt-2 text-slate-400">Actualizada: {new Date(room.updatedAt).toLocaleString()}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10" onClick={onBack}>
                Volver
              </button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10" onClick={onSettings}>
                Configuración
              </button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10" onClick={onLogout}>
                Cerrar sesión
              </button>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/40 p-6 text-slate-300">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-100">
              <ShieldCheck className="h-4 w-4 text-cyan-300" /> Controles de sala
            </div>

            {isOwner ? (
              <form className="mt-4 grid gap-4" onSubmit={handleSubmit} noValidate>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-100" htmlFor="room-name">Nombre</label>
                  <input
                    id="room-name"
                    className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                    placeholder="Nuevo nombre de sala"
                  />
                </div>

                {error && <p role="alert" className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p>}

                <div className="flex flex-wrap gap-3">
                  <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:cursor-progress disabled:opacity-60" disabled={loading}>
                    <PencilLine className="h-4 w-4" />
                    {loading ? "Guardando..." : "Editar sala"}
                  </button>
                  <button type="button" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 text-sm font-medium text-rose-100 transition hover:bg-rose-400/15 disabled:cursor-progress disabled:opacity-60" onClick={() => void handleDelete()} disabled={loading}>
                    <Trash2 className="h-4 w-4" />
                    Eliminar sala
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                No eres el creador de esta sala, así que los botones de editar y eliminar están ocultos.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
