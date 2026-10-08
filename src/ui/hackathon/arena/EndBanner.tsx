interface EndBannerProps {
  won: boolean;
  /** The student still had health: the wave timer ran out. */
  timeout: boolean;
  /** Set while the finish request is being retried after a lost connection. */
  error?: string | null;
}

/** The fight is over: the verdict in big letters while the server counts the rewards. */
export function EndBanner({ won, timeout, error }: EndBannerProps) {
  const title = won ? 'Vitória!' : timeout ? 'Tempo esgotado' : 'Derrota';
  return (
    <div className="ar-end" data-won={won} role="status">
      <div className="ar-end-box">
        <p className="ar-end-title">{title}</p>
        <p className="ar-end-sub">{error ?? 'Contando as recompensas...'}</p>
      </div>
    </div>
  );
}
