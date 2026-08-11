import Link from "next/link";
import DanceyokeyConsole from "./DanceyokeyConsole";

/**
 * /loop/admin/danceyokey — the host console. Gated by middleware like every
 * /loop/admin page. This is the surface the night runs on: the running order
 * in one hand at the back of the room.
 */
export default function DanceyokeyAdminPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Danceyokey</h1>
          <p className="loop-muted mt-1 text-sm">The floor, the list, the running order.</p>
        </div>
        <Link
          href="/loop/admin"
          className="shrink-0 rounded-full border border-ink/25 px-4 py-2 text-sm font-bold"
        >
          ← Admin
        </Link>
      </div>

      <DanceyokeyConsole />
    </main>
  );
}
