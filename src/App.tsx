import { useEffect, useMemo, useState } from "react";
import { ConnectToBackend } from "./services/api";
import type { backendStatus } from "./services/api";
import { AuthPage } from "./components/auth/AuthPage";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { UsernameSelection } from "./components/auth/UsernameSelection";
import { Dashboard } from "./components/dashboard/Dashboard";
import { bootstrapAuthState, completeGoogleUsername, signOut, startGoogleSignIn } from "./auth/mockAuth";
import type { AuthScreen, AuthSession, GoogleAuthProfile } from "./auth/types";

function App() {
  const [backendStatus, setBackendStatus] = useState<backendStatus>("loading");
  const [screen, setScreen] = useState<AuthScreen>("login");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [pendingGoogleProfile, setPendingGoogleProfile] = useState<GoogleAuthProfile | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [flashMessage, setFlashMessage] = useState("");

  useEffect(() => {
    ConnectToBackend().then((result) => {
      setBackendStatus(result.status);
    });

    const initialState = bootstrapAuthState();
    setSession(initialState.session);
    setPendingGoogleProfile(initialState.pendingGoogleProfile);
    setScreen(initialState.pendingGoogleProfile ? "username-selection" : initialState.session ? "dashboard" : "login");
    setBootstrapping(false);
  }, []);

  const backendConnected = backendStatus === "Conectado exitosamente";
  const activeUser = useMemo(() => session?.user ?? null, [session]);

  const syncSession = (message: string) => {
    const currentState = bootstrapAuthState();
    setSession(currentState.session);
    setPendingGoogleProfile(currentState.pendingGoogleProfile);
    setScreen(currentState.pendingGoogleProfile ? "username-selection" : currentState.session ? "dashboard" : "login");
    setFlashMessage(message);
  };

  const handleGoogleSignIn = async () => {
    const result = await startGoogleSignIn();
    if (result.requiresUsername) {
      setPendingGoogleProfile(result.profile);
      setSession(null);
      setScreen("username-selection");
      return;
    }

    syncSession("Login con Google completado.");
  };

  const handleLogout = () => {
    signOut();
    setSession(null);
    setPendingGoogleProfile(null);
    setScreen("login");
    setFlashMessage("");
  };

  if (bootstrapping) {
    return (
      <div className="fullscreen-page">
        <div className="surface-card surface-card--centered">
          <div className="surface-card__eyebrow">Cargando</div>
          <h2>Preparando sesión...</h2>
          <p>Verificando el backend y leyendo el estado local.</p>
        </div>
      </div>
    );
  }

  if (screen === "username-selection" && pendingGoogleProfile) {
    return <UsernameSelection profile={pendingGoogleProfile} onComplete={async (username) => {
      await completeGoogleUsername(username);
      syncSession("Perfil completado. Ya puedes usar el dashboard.");
    }} />;
  }

  if (screen === "dashboard") {
    return (
      <ProtectedRoute isAllowed={Boolean(activeUser)} onUnauthorized={handleLogout}>
        {activeUser && (
          <Dashboard
            user={activeUser}
            onLogout={handleLogout}
            flashMessage={flashMessage}
            backendConnected={backendConnected}
          />
        )}
      </ProtectedRoute>
    );
  }

  return (
    <AuthPage
      activeTab={screen === "register" ? "register" : "login"}
      onTabChange={(tab) => setScreen(tab)}
      onLoginSuccess={() => syncSession("Inicio de sesión completado.")}
      onRegisterSuccess={() => syncSession("Registro completado.")}
      onGoogleSignIn={handleGoogleSignIn}
      backendConnected={backendConnected}
    />
  );
}

export default App;
