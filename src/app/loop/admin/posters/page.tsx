import Link from "next/link";
import { getCurrentEvent } from "@/lib/loop/hub";
import { getPassSettings } from "@/lib/loop/pass/settings";
import { getPublicBaseUrl } from "@/lib/loop/publicUrl";
import { priceLabel } from "@/lib/loop/priceLabel";
import PosterStudio from "./PosterStudio";

/**
 * /loop/admin/posters — the Marketing Studio (route kept: the promoter has the link). Gated by middleware like every
 * /loop/admin page. Server shell resolves the event for the details block.
 */
export default async function PostersPage() {
  const [event, pass, publicBaseUrl] = await Promise.all([
    getCurrentEvent(),
    getPassSettings(),
    getPublicBaseUrl(),
  ]);
  const dateLabel = new Date(event.date).toLocaleDateString("en-CA", {
    timeZone: "America/Vancouver",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-extrabold">Marketing Studio</h1>
        <Link
          href="/loop/admin"
          className="rounded-full border border-ink/25 px-4 py-2 text-sm font-bold"
        >
          ← Admin
        </Link>
      </div>
      {/* One line, so the piece switch is the first thing you meet rather than
          a paragraph sitting between the title and the work. */}
      <p className="mt-2 text-sm opacity-70">Every piece for the volume, from one workbench.</p>

      <PosterStudio
        eventDetails={{
          title: event.title,
          theme: event.theme,
          venue: event.venue,
          dateLabel,
          price: priceLabel(pass.price, pass.currency),
        }}
        publicBaseUrl={publicBaseUrl}
      />
    </main>
  );
}
