import Link from "next/link";
import CodeLookup from "./CodeLookup";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/identity/voter";
import { codesHeldBy } from "@/lib/loop/event-codes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Find your pass · Loop Soul",
};

/**
 * /loop/code — your ticket, and the way to it on a new phone.
 *
 * A phone that already holds a pass lands straight on the ticket: number, code,
 * the QR the door scans. Any other phone proves the inbox with six digits and
 * then holds it too. Public by design: entry must never depend on an email
 * arriving, and this is the answer at the door for anyone who cannot find
 * theirs.
 */
export default async function CodePage() {
  const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
  const held = await codesHeldBy(event.id, voterId).catch(() => []);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 py-12">
      <h1 className="text-2xl font-extrabold">{held.length > 0 ? "Your ticket" : "Find your pass"}</h1>
      {held.length === 0 && (
        <p className="loop-muted mt-2 text-sm leading-relaxed">The email you paid with. We send six digits to it.</p>
      )}

      <CodeLookup initialHeld={held} />

      <Link
        href="/loop"
        className="loop-muted mt-10 text-center text-[11px] font-bold uppercase tracking-[0.3em]"
      >
        ← Back to Loop Soul
      </Link>
    </main>
  );
}
