import { useState } from "react";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import type { AuthScreen } from "../../auth/types";

interface AuthPageProps {
  activeTab: Extract<AuthScreen, "login" | "register">;
  onTabChange: (tab: Extract<AuthScreen, "login" | "register">) => void;
  onLoginSuccess: () => void;
  onRegisterSuccess: () => void;
  onGoogleSignIn: () => Promise<void>;
  backendConnected: boolean;
}

const featureCopy = [
  "Videollamadas en tiempo real",
  "Chat con historial persistente",
  "Salas privadas con acceso controlado",
  "Colaboración en grupo sincronizada",
];

export function AuthPage({
  activeTab,
  onTabChange,
  onLoginSuccess,
  onRegisterSuccess,
  onGoogleSignIn,
  backendConnected,
}: AuthPageProps) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");

  const handleGoogleClick = async () => {
    setGoogleError("");
    setGoogleLoading(true);
    try {
      await onGoogleSignIn();
    } catch {
      setGoogleError("No pudimos iniciar el flujo con Google. Intenta otra vez.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__hero">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </div>
          <div className="brand-lockup__text">StudyRoom</div>
        </div>

        <section className="auth-hero-copy">
          <h1>
            Estudia juntos,
            <span> logra más.</span>
          </h1>
          <p>
            Plataforma de estudio colaborativo con videollamadas, chat en tiempo real y salas privadas.
          </p>
        </section>

        <div className="feature-grid">
          {featureCopy.map((item, index) => (
            <div key={item} className="mini-card">
              <span className="mini-card__icon" aria-hidden="true">
                {index + 1}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="auth-footer-copy">© 2026 StudyRoom. Todos los derechos reservados.</div>
      </div>

      <main className="auth-card">
        <div className="auth-card__topbar">
          <span className="surface-card__eyebrow">StudyRoom</span>
          <span className="auth-card__status" data-state={backendConnected ? "online" : "offline"}>
            {backendConnected ? "Backend conectado" : "Backend no disponible"}
          </span>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Autenticación">
          {(["login", "register"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={`auth-tabs__button ${activeTab === tab ? "auth-tabs__button--active" : ""}`}
              onClick={() => onTabChange(tab)}
            >
              {tab === "login" ? "Iniciar sesión" : "Registrarse"}
            </button>
          ))}
        </div>

        <div className="auth-card__copy">
          <h2>{activeTab === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta"}</h2>
          <p>
            {activeTab === "login"
              ? "Ingresa a tu cuenta para continuar estudiando."
              : "Completa tus datos, valida el username en tiempo real y entra al dashboard."}
          </p>
        </div>

        {googleError && <p role="alert" aria-live="polite" className="feedback feedback--error">{googleError}</p>}

        <div className="auth-card__forms">
          {activeTab === "login" ? <LoginForm onSuccess={onLoginSuccess} /> : <RegisterForm onSuccess={onRegisterSuccess} />}

          <div className="auth-divider"><span>o</span></div>

          <GoogleAuthButton onClick={handleGoogleClick} loading={googleLoading} />
        </div>
      </main>
    </div>
  );
}