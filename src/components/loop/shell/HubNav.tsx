import Link from "next/link";
import Logo from "@/components/loop/brand/Logo";
import { phaseLabel, type EventPhase } from "@/lib/loop/hub";

/**
 * Persistent top nav. The current-event entry is named for the phase
 * (The Gathering / Tonight / Legacy). Legacy is the permanent content hub,
 * but before the night it is a page about a year that has not happened yet,
 * so it is not offered until the doors open.
 *
 * Store is here rather than only on the front door because the front door's
 * only route to it is the Pieces rail, which renders nothing when the shelf is
 * empty or Shopify is unreachable — a shop that disappears with its stock is
 * a shop nobody can find their way back to.
 */
export function HubNav({ phase }: { phase: EventPhase }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-5 py-3 backdrop-blur-sm">
      <Link href="/loop" aria-label="Loop Soul home" className="shrink-0">
        <Logo width={76} />
      </Link>
      <nav className="flex items-center gap-4 text-sm font-medium">
        <Link href="/loop" className="opacity-80 hover:opacity-100 transition-opacity">
          {phaseLabel(phase)}
        </Link>
        <Link href="/loop/store" className="opacity-80 hover:opacity-100 transition-opacity">
          Store
        </Link>
        {phase !== "pre" && (
          <Link href="/loop/legacy" className="opacity-80 hover:opacity-100 transition-opacity">
            Legacy
          </Link>
        )}
      </nav>
    </header>
  );
}

export default HubNav;
