export function BatchSrtIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="BatchSRT icon">
      <rect width="64" height="64" rx="14" fill="#2563eb" />
      <path d="M18 19h28a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H28l-9 7v-7h-1a6 6 0 0 1-6-6V25a6 6 0 0 1 6-6Z" fill="#fff" opacity=".96" />
      <path d="M24 28h18M24 36h10M39 36h5" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
      <path d="M16 16h8M16 12h18" stroke="#bfdbfe" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
