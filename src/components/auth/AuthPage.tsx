import { useState } from "react";
import { BookOpen, ShieldCheck, Sparkles, Video } from "lucide-react";
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
}

const featureCopy = [
  { icon: Video, label: "Videollamadas en tiempo real" },
  { icon: Sparkles, label: "Chat con historial persistente" },
  { icon: ShieldCheck, label: "Salas privadas con acceso controlado" },
  { icon: BookOpen, label: "Colaboración en grupo sincronizada" },
];

export function AuthPage({ activeTab, onTabChange, onLoginSuccess, onRegisterSuccess, onGoogleSignIn }: AuthPageProps) {
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,116,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.08),transparent_26%),linear-gradient(180deg,#070a1f_0%,#030617_100%)] p-4 text-slate-100">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-7xl grid-cols-1 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl shadow-black/20 backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-between gap-8 bg-[linear-gradient(180deg,rgba(15,24,54,0.95),rgba(14,18,44,0.94)),radial-gradient(circle_at_bottom_right,rgba(124,116,255,0.3),transparent_34%)] p-8 sm:p-10 lg:p-12">
          <div className="inline-flex items-center justify-end gap-3 self-end rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
            <BookOpen className="h-4 w-4 text-cyan-300" /> StudyRoom
          </div>

          <div className="max-w-xl space-y-6">
            <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
              Estudia juntos,
              <span className="block bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">logra más.</span>
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-400">
              Plataforma de estudio colaborativo con videollamadas, chat en tiempo real y salas privadas.
            </p>
          </div>

          <div className="grid max-w-xl gap-3">
            {featureCopy.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-slate-200">
                  <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white/5 text-cyan-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium sm:text-base">{item.label}</span>
                </div>
              );
            })}
          </div>

          <p className="text-sm text-slate-500">© 2026 StudyRoom. Todos los derechos reservados.</p>
        </section>

        <main className="flex flex-col gap-6 p-8 sm:p-10 lg:p-12">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
                {activeTab === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta"}
              </h2>
            </div>
            <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              <span className={`h-3 w-3 rounded-full ${"bg-emerald-400"}`}></span>
              StudyRoom
            </div>
          </div>

          <div className="grid grid-cols-2 rounded-full border border-white/10 bg-white/5 p-1">
            {(["login", "register"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`rounded-full px-4 py-3 text-sm font-semibold transition ${activeTab === tab ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/20" : "text-slate-400 hover:text-slate-200"}`}
                onClick={() => onTabChange(tab)}
              >
                {tab === "login" ? "Iniciar sesión" : "Registrarse"}
              </button>
            ))}
          </div>

          <div className="text-sm leading-7 text-slate-400">
            {activeTab === "login"
              ? "Ingresa a tu cuenta para continuar estudiando."
              : "Completa tus datos, valida el username en tiempo real y entra al dashboard."}
          </div>

          {googleError && <p role="alert" aria-live="polite" className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{googleError}</p>}

          <div className="grid gap-5">
            {activeTab === "login" ? <LoginForm onSuccess={onLoginSuccess} /> : <RegisterForm onSuccess={onRegisterSuccess} />}
            <div className="relative flex items-center gap-4 py-1 text-xs uppercase tracking-[0.2em] text-slate-500">
              <span className="h-px flex-1 bg-white/10" />
              o
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <GoogleAuthButton onClick={handleGoogleClick} loading={googleLoading} />
          </div>
        </main>
      </div>
    </div>
  );
}
