interface GoogleAuthButtonProps {
  onClick: () => Promise<void>;
  loading?: boolean;
}

export function GoogleAuthButton({ onClick, loading = false }: GoogleAuthButtonProps) {
  return (
    <button type="button" className="button button--secondary button--full google-button" onClick={onClick} disabled={loading}>
      {loading ? (
        <span className="button__loading">
          <span className="spinner" aria-hidden="true" />
          Conectando con Google...
        </span>
      ) : (
        <span className="google-button__content">
          <span className="google-button__mark" aria-hidden="true">
            G
          </span>
          Continuar con Google
        </span>
      )}
    </button>
  );
}