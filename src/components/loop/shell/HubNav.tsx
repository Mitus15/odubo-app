import Link from "next/link";
import Wordmark from "@/components/loop/brand/Wordmark";

/**
 * Persistent top nav. Legacy is ALWAYS reachable, regardless of event phase —
 * it is the permanent content hub. The current-event entry adapts its label
 * to the phase.
 */
export function HubNav({ phaseLabel }: { phaseLabel: string }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-5 py-3 backdrop-blur-sm">
      <Link href="/loop" aria-label="Loop Soul home" className="shrink-0">
        <Wordmark size="sm" />
      </Link>
      <nav className="flex items-center gap-4 text-sm font-medium">
        <Link href="/loop" className="opacity-80 hover:opacity-100 transition-opacity">
          {phaseLabel}
        </Link>
        <Link
          href="/loop/legacy"
          className="opacity-80 hover:opacity-100 transition-opacity"
        >
          Legacy
        </Link>
      </nav>
    </header>
  );
}

export default HubNav;
