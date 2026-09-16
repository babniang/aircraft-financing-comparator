export default function LoadingState() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-live="polite">
      <div className="h-px w-full bg-ink" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 border-b border-rule py-4">
          <div className="h-3.5 w-1/3 bg-rule" />
          <div className="ml-auto h-3.5 w-16 bg-rule" />
          <div className="h-3.5 w-16 bg-rule" />
        </div>
      ))}
    </div>
  );
}
