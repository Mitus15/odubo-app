import Link from "next/link";
import PassEntry from "./CodeLookup";
import YourTicket from "@/components/loop/gathering/YourTicket";
import { getCurrentEvent } from "@/lib/loop/hub";
import { currentVoterId } from "@/lib/loop/identity/voter";
import { codesHeldBy } from "@/lib/loop/event-codes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Enter your pass · Loop Soul",
};

/**
 * /loop/code — enter your pass, or, on a phone that already holds one, the
 * ticket itself. Public by design: it is the answer at the door for anyone who
 * cannot find their email.
 */
export default async function CodePage() {
  const [event, voterId] = await Promise.all([getCurrentEvent(), currentVoterId()]);
  const held = await codesHeldBy(event.id, voterId).catch(() => []);

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 py-12">
      <h1 className="text-2xl font-extrabold">{held.length > 0 ? "Your ticket" : "Enter your pass"}</h1>
      {held.length > 0 ? (
        <div className="mt-6">
          <YourTicket passes={held} />
        </div>
      ) : (
        <PassEntry />
      )}

      <Link href="/loop" className="loop-muted mt-10 text-center text-[11px] font-bold uppercase tracking-[0.3em]">
        ← Back to Loop Soul
      </Link>
    </main>
  );
}
