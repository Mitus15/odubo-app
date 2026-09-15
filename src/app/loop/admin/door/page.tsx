import Link from "next/link";
import DoorScanner from "./DoorScanner";

export const metadata = { title: "The Door — Loop Soul" };
export const dynamic = "force-dynamic";

/**
 * /loop/admin/door — the host's phone at the door. Gated by middleware like the
 * rest of /loop/admin. A ticket QR encodes this URL with ?c=, so a scan from a
 * plain camera app lands here with the pass in hand; the page's own scanner
 * does the same thing without leaving it.
 */
export default async function DoorPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-4 pb-10 pt-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-extrabold">The Door</h1>
        <Link href="/loop/admin" className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-60">
          Admin
        </Link>
      </div>
      <DoorScanner initialCode={c ?? null} />
    </main>
  );
}
