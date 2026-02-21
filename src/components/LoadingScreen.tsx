export default function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg">
      <h1 className="font-display text-4xl font-700 tracking-tight animate-pulse">
        <span className="text-text">EZ</span>
        <span className="text-primary">SOP</span>
      </h1>
      <p className="mt-3 text-sm text-text-muted">Loading...</p>
    </div>
  );
}
