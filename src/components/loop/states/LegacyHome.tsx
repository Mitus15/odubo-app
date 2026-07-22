import ArcedTagline from "@/components/loop/brand/ArcedTagline";
import Lookbook from "@/components/loop/gathering/Lookbook";

/**
 * STATE 3 — Legacy (persistent content hub). The multi-event vault, gated
 * downloads and Iconic Moments still land in the State 3 build task, but the
 * Lookbook (the theme mood board) now lives here — its intended home. Rendered
 * in "vault mode" (ink field, green ink).
 */
export function LegacyHome() {
  return (
    <main className="flex flex-col items-center px-6 pb-24 pt-10 text-center">
      <p className="text-xs uppercase tracking-[0.3em] opacity-70">
        Loop Soul Legacy · The soul of Kamloops, kept
      </p>

      <div className="mt-10">
        <ArcedTagline text="What do you remember?" className="text-electric" />
      </div>

      <section className="mt-12 grid w-full max-w-md grid-cols-1 gap-3 text-left">
        {[
          ["The Vault", "Explore galleries & jams from every past event."],
          ["Iconic Moments", "The shots that became posters."],
          ["Your Downloads", "Saved media — unlocked by your event code."],
        ].map(([title, desc]) => (
          <div
            key={title}
            className="rounded-2xl border border-electric/25 bg-electric/5 px-5 py-4"
          >
            <div className="font-bold">{title}</div>
            <div className="text-sm opacity-70">{desc}</div>
          </div>
        ))}
      </section>

      <section className="mt-14 w-full max-w-2xl text-left">
        <Lookbook />
      </section>
    </main>
  );
}

export default LegacyHome;
