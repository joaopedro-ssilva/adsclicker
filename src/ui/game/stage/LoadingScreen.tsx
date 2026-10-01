/** Shown until the store has booted. Plain markup so the server and the first client render match. */
export function LoadingScreen() {
  return (
    <main className="loading" aria-busy="true">
      <div className="loading-blocks" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <p className="loading-text" role="status">
        Carregando a turma
      </p>
    </main>
  );
}
