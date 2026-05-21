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
      <div className="fullscreen-page">
        <div className="surface-card surface-card--centered">
          <div className="surface-card__eyebrow">Acceso protegido</div>
          <h2>Verificando sesión...</h2>
          <p>Si no hay una sesión activa, volverás al login automáticamente.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}