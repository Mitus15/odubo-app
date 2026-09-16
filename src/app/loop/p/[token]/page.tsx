import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentVoterId } from "@/lib/loop/identity/voter";
import { claimPassOnDevice } from "@/lib/loop/pass/claim";
import { lookupPassLink } from "@/lib/loop/passLinks";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Loop Soul",
  robots: { index: false, follow: false },
};

/**
 * /loop/p/<token> — the link in the pass email.
 *
 * Opening it binds this phone to the pass, with nothing to type: the email
 * proved the inbox, which is the same proof the six digits give at /loop/code.
 * Then it goes straight to the record (or to the room, with ?to=room). The
 * page itself is never seen unless the link is dead.
 *
 * The voter cookie is minted by middleware on this same request and is
 * readable through cookies() during this render; `currentVoterId` is the only
 * correct way to read it here.
 */
export default async function PassLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ to?: string }>;
}) {
  const [{ token }, { to }] = await Promise.all([params, searchParams]);

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limiter = await rateLimit({ key: `loop:pass:link:${ip}`, limit: 40, windowMs: 10 * 60 * 1000 });
  if (!limiter.allowed) return <Dead title="Give it a minute, then try the link again." />;

  const target = await lookupPassLink(token);
  if (!target) return <Dead />;

  const voterId = await currentVoterId();
  if (voterId === "anonymous") return <Dead title="Open this link in your browser, not a preview." />;

  let held = false;
  try {
    held = await claimPassOnDevice(target.eventId, target.code, voterId);
  } catch (e) {
    console.error("[loop:claim] link could not bind the device:", e);
  }
  if (!held) return <Dead />;

  redirect(to === "room" ? "/loop" : "/loop/album");
}

function Dead({ title = "This link has expired." }: { title?: string }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-12">
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] opacity-60">Loop Soul</p>
      <h1 className="mt-2 text-2xl font-extrabold leading-tight">{title}</h1>
      <div className="mt-8 border-t border-ink/15 pt-4">
        <Link href="/loop/code" className="block min-h-[44px] text-sm font-bold uppercase tracking-[0.2em] underline underline-offset-4">
          Find your pass
        </Link>
      </div>
    </main>
  );
}
