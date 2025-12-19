/**
 * The Hub - Loading State
 */

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-2 border-[var(--hub-accent)] border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-sm text-[var(--hub-text-muted)]">Loading...</p>
    </div>
  );
}
