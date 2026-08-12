import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentEvent } from "@/lib/loop/hub";
import { getJournalData } from "@/lib/loop/journal-server";
import { ADMIN_COOKIE, verifyAdminSession } from "@/lib/loop/admin-auth";
import HubNav from "@/components/loop/shell/HubNav";
import JournalIssueView from "@/components/loop/journal/JournalIssueView";

export const metadata: Metadata = {
  title: "The Loop Journal — Loop Soul",
  description: "One issue per volume. The anthem, the iconic moments, the night that was.",
};

/**
 * The Loop Journal. Renders in poster mode (sand paper, oxblood ink) — the
 * magazine IS the printed artefact, unlike Legacy's vault chrome. Unpublished
 * issues show a public "being written" state; admins see the live draft, so
 * curation on /admin can be checked against the real page before publishing.
 */
export default async function JournalPage() {
  const event = await getCurrentEvent();
  const data = await getJournalData(event);

  const published = data.issue?.published ?? false;
  let draftPreview = false;
  if (!published) {
    const store = await cookies();
    draftPreview = await verifyAdminSession(store.get(ADMIN_COOKIE)?.value);
  }

  return (
    <>
      <HubNav phaseLabel="The Gathering" />
      {published || draftPreview ? (
        <JournalIssueView event={event} data={data} draftPreview={draftPreview} />
      ) : (
        <main className="mx-auto flex min-h-[70dvh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] opacity-70">
            The Loop Journal
          </p>
          <p
            className="font-script mt-6 text-4xl"
            style={{ fontFamily: "var(--font-script)" }}
          >
            this issue is still being written.
          </p>
          <p className="mt-4 max-w-xs text-sm opacity-70">
            Every volume becomes an issue — the anthem, the iconic moments, the
            night that was. It prints after the night happens.
          </p>
          <Link
            href="/loop"
            className="mt-8 rounded-full bg-ink px-8 py-3.5 text-sm font-bold text-sand transition-transform active:scale-95"
          >
            Be in the next one
          </Link>
        </main>
      )}
    </>
  );
}
