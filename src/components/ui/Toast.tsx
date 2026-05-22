import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  push: (message: string, type?: ToastType, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, type: ToastType = "info", duration = 3500) => {
    const id = crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const t: Toast = { id, type, message };
    setToasts((s) => [t, ...s]);
    window.setTimeout(() => {
      setToasts((s) => s.filter((x) => x.id !== id));
    }, duration);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex w-full max-w-xs flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live={t.type === "error" ? "assertive" : "polite"}
            className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.type === "success" ? "bg-emerald-500/10 border-emerald-400/20 text-emerald-100" : t.type === "error" ? "bg-rose-500/10 border-rose-400/20 text-rose-100" : "bg-white/5 border-white/10 text-slate-100"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return {
    success: (msg: string, duration?: number) => ctx.push(msg, "success", duration),
    error: (msg: string, duration?: number) => ctx.push(msg, "error", duration),
    info: (msg: string, duration?: number) => ctx.push(msg, "info", duration),
  };
}

export default ToastProvider;
