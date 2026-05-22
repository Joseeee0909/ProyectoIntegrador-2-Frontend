import { useEffect } from "react";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  isAllowed: boolean;
  onUnauthorized: () => void;
  children: ReactNode;
}

export function ProtectedRoute({ isAllowed, onUnauthorized, children }: ProtectedRouteProps) {
  useEffect(() => {
    if (!isAllowed) {
      onUnauthorized();
    }
  }, [isAllowed, onUnauthorized]);

  if (!isAllowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(124,116,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(96,165,250,0.08),transparent_26%),linear-gradient(180deg,#070a1f_0%,#030617_100%)] p-4 text-slate-100">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="mx-auto mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">Acceso protegido</div>
          <h2 className="text-2xl font-semibold tracking-tight">Verificando sesión...</h2>
          <p className="mt-3 text-slate-400">Si no hay una sesión activa, volverás al login automáticamente.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}