export default function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`grid h-8 w-8 place-items-center rounded-lg ${
          inverted ? "bg-accent-ink text-accent" : "bg-accent text-accent-ink"
        }`}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v4h4" />
          <path d="M9 13h6M9 17h4" />
        </svg>
      </span>
      <span className="font-display text-xl tracking-tight">Pagewise</span>
    </div>
  );
}
