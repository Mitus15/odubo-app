import Link from "next/link";
import { getCurrentEvent } from "@/lib/loop/hub";
import PosterStudio from "./PosterStudio";

/**
 * /loop/admin/posters — Poster Studio. Gated by middleware like every
 * /loop/admin page. Server shell resolves the event for the details block.
 */
export default async function PostersPage() {
  const event = await getCurrentEvent();
  const dateLabel = new Date(event.date).toLocaleDateString("en-CA", {
    timeZone: "America/Vancouver",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-extrabold">Poster Studio</h1>
        <Link
          href="/loop/admin"
          className="rounded-full border border-ink/25 px-4 py-2 text-sm font-bold"
        >
          ← Admin
        </Link>
      </div>
      <p className="mt-2 text-sm opacity-70">
        Build a poster from the brand figures, your own art, or a Wall shot.
        The QR sends people back to the app.
      </p>

      <PosterStudio
        eventDetails={{
          title: event.title,
          theme: event.theme,
          venue: event.venue,
          dateLabel,
        }}
      />
    </main>
  );
}
