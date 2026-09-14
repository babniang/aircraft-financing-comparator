export default function LoadingState() {
  return (
    <div className="border border-rule" aria-busy="true" aria-live="polite">
      <div className="border-b border-rule bg-blue050 px-4 py-1.5">
        <span className="eyebrow text-blue700">···</span>
      </div>
      <div className="animate-pulse space-y-2 p-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-6 w-full bg-blue050" />
        ))}
      </div>
    </div>
  );
}
