interface GoogleAuthButtonProps {
  onClick: () => Promise<void>;
  loading?: boolean;
}

export function GoogleAuthButton({ onClick, loading = false }: GoogleAuthButtonProps) {
  return (
    <button
      type="button"
      className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/10 disabled:cursor-progress disabled:opacity-60"
      onClick={onClick}
      disabled={loading}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden="true" />
          Conectando con Google...
        </span>
      ) : (
        <span className="inline-flex items-center gap-3">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-white to-slate-300 text-xs font-black text-slate-900">G</span>
          Continuar con Google
        </span>
      )}
    </button>
  );
}