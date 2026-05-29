import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, LogOut, Sparkles } from "lucide-react";
import { ToastProvider } from "./components/ui/Toast";
import { AuthPage } from "./components/auth/AuthPage";
import { UsernameSelection } from "./components/auth/UsernameSelection";
import { Dashboard } from "./components/dashboard/Dashboard";
import { RoomPage } from "./components/room/RoomPage";
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

    const room = await createRoom({ name }, session?.accessToken ?? "", activeUser.id);
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
        element={activeUser && roomId ? <RoomPage room={activeRoom} roomLoading={activeRoomLoading} user={activeUser} accessToken={session?.accessToken ?? ""} onBack={() => navigate("/dashboard")} onOpenProfile={() => navigate("/perfil")} onSettings={() => navigate("/configuracion")} onLogout={handleLogout} onRenameRoom={handleRenameRoom} onDeleteRoom={handleDeleteRoom} /> : <Navigate to="/login" replace />}
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

export default App;
