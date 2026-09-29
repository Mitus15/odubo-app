import FilmEditor from "./FilmEditor";

export const metadata = { title: "Loop Soul · The film" };

/**
 * /loop/admin/film: the story of the one-take film, chapter by chapter.
 * Gated by middleware like every /loop/admin path. Everything is a draft until
 * the owner approves it, and approval refuses anything that names Him, carries
 * an em dash or a link, or cannot be drawn (src/lib/loop/film/naming.ts).
 */
export default function FilmAdminPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <a href="/loop/admin" className="text-sm opacity-60">
        ← Admin
      </a>
      <h1 className="mt-3 text-2xl font-extrabold">The film</h1>
      <p className="mt-2 text-sm opacity-70">
        Recoolman&apos;s flight, one chapter per song. Correct the words, pick the verses, write the flips. Nothing
        reaches a guest until you approve it.
      </p>
      <FilmEditor />
    </main>
  );
}
