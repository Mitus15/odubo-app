import type { CoverWinner } from "@/lib/loop/ballots";

/**
 * The cover the night chose, once it is declared. Image, credit, the count,
 * the date. No client JS: it is a fact, laid out. Shown on Legacy above the
 * ballots and at the top of the Journal issue.
 */
export function DeclaredCover({ cover, tone = "vault" }: { cover: CoverWinner; tone?: "vault" | "paper" }) {
  const rule = tone === "vault" ? "border-sand/25" : "border-ink/20";
  const declared = new Date(cover.declaredAt).toLocaleDateString("en-CA", {
    timeZone: "America/Vancouver",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <section className="w-full max-w-md text-left">
      <h2 className="text-xs uppercase tracking-[0.3em] opacity-70">The Cover</h2>
      <div className="relative mt-4 aspect-square w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover.imageSrc} alt="The cover" className="h-full w-full object-cover" />
      </div>
      <div className={`mt-3 border-t ${rule} pt-3`}>
        <p className="font-bold">{cover.credit ? `Shot by ${cover.credit}` : "Shot on the night"}</p>
        <p className="mt-1 text-sm opacity-70">
          {cover.votes} {cover.votes === 1 ? "vote" : "votes"} · declared {declared}
        </p>
        {cover.note && <p className="mt-2 text-sm opacity-70">{cover.note}</p>}
      </div>
    </section>
  );
}

export default DeclaredCover;
