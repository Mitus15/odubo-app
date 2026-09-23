import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Logo from "@/components/loop/brand/Logo";
import { getCurrentEvent } from "@/lib/loop/hub";
import { getRunOfShow } from "@/lib/loop/content-store";
import { getPassSettings } from "@/lib/loop/pass/settings";
import { getPublicBaseUrl } from "@/lib/loop/publicUrl";
import { priceLabel } from "@/lib/loop/priceLabel";
import { EVENT_CREDITS } from "@/lib/loop/content";
import { bareTime, longDate, programmeTimes } from "@/lib/loop/eventFacts";
import { captions, daysInWords, daysUntil, HASHTAGS } from "@/lib/loop/press/copy";
import manifest from "@/lib/loop/press/manifest.json";
import CopyButton from "./CopyButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Loop Soul · Press kit",
  description: "Everything to promote Loop Soul: the story, the facts, the artwork, the reels, the captions and the single.",
  robots: { index: false, follow: false },
};

/**
 * /loop/press — the promoter's package, as one link.
 *
 * For a stranger who has to sell the night: the story, the facts, the words
 * to post, the artwork, the reels and the single, and one zip with all of it.
 * The facts are read live (date, times, price, days to go). The files come
 * from src/lib/loop/press/manifest.json, written by `npm run loop:press`:
 * images from public/loop/press (static, in git), the reels and the zip from
 * R2 through the presigned media route. See docs/loop/press.md.
 *
 * No hub nav on purpose: this page is handed to people who are not guests, and
 * the nav would sell them the app instead of the night.
 */

type FileEntry = { name: string; href: string; bytes: number; w: number | null; h: number | null };
type Reel = { name: string; href: string; bytes: number; silent: boolean };

const TZ = "America/Vancouver";
const RULE = "border-t border-ink/15";

function mb(bytes: number): string {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

function artworkLabel(name: string): string {
  if (name.includes("-8x11in")) return "Poster · 8×11";
  if (name.includes("-flyer-")) return "Flyer · 5.5×8.5";
  if (name.includes("-feed")) return "Feed · 4:5";
  if (name.includes("-story")) return "Story · 9:16";
  if (name.includes("facebook-cover")) return "Facebook cover";
  if (name.includes("ticket")) return "Ticket";
  if (name.includes("pass-square")) return "Pass card";
  return name;
}

const REEL_LABEL: Record<string, string> = { loop: "The loop", energetic: "The room", calm: "The quiet one" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`mt-14 ${RULE} pt-5`}>
      <h2 className="loop-display text-[11px] font-bold uppercase tracking-[0.3em]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function PressPage() {
  const [event, pass, base] = await Promise.all([getCurrentEvent(), getPassSettings(), getPublicBaseUrl()]);
  const runOfShow = await getRunOfShow(event.id);

  const price = priceLabel(pass.price, pass.currency);
  const times = programmeTimes(runOfShow);
  const doors = bareTime(event.date);
  const out = runOfShow.find((i) => i.id === "out")?.time.replace(/:00$/, "");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const night = new Date(event.date).toLocaleDateString("en-CA", { timeZone: TZ });
  const days = daysUntil(today, night);
  const host = (base ?? "https://www.odubostudio.com").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const site = `${host}/loop`;
  const posts = captions({ doors, album: times?.album ?? "8", price, days, site });

  const artwork = manifest.artwork as FileEntry[];
  const shown = artwork.filter((f) => !f.name.includes("-bleed"));
  const bleedFor = (f: FileEntry) => artwork.find((b) => b.name === f.name.replace(/\.png$/, "-bleed.png"));
  const cover = (manifest.cover as FileEntry[])[0];
  const logos = manifest.logos as FileEntry[];
  const photos = manifest.photos as FileEntry[];
  const reels = manifest.reels as Reel[];
  const reelKinds = ["loop", "energetic", "calm"].filter((k) => reels.some((r) => r.name.includes(`-${k}`)));

  return (
    <main className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-2xl px-6 pb-24 pt-10">
        {/* ── masthead ── */}
        <header className="flex flex-col items-center text-center">
          <Logo className="w-40" />
          <p className="loop-display mt-3 text-[13px] font-medium uppercase tracking-[0.3em]">{EVENT_CREDITS.record}</p>
          <p className="loop-display loop-muted mt-1 text-[10px] font-medium uppercase tracking-[0.3em]">{EVENT_CREDITS.feature}</p>
          <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.3em]">Press kit</p>
        </header>

        <div className={`mt-8 ${RULE} pt-5 text-center`}>
          <p className="text-lg font-extrabold">{longDate(event.date)}</p>
          <p className="mt-1 text-sm">{event.venue} · outdoors, in the courtyard</p>
          <p className="mt-1 text-sm">
            Doors {doors}
            {times ? ` · album live at ${times.album} · 80s floor at ${times.floor}` : ""}
            {out ? ` · out by ${out}` : ""}
          </p>
          <p className="mt-1 text-sm font-bold">
            {price === "FREE ENTRY" ? "Free" : price} · 19+ · dress code 80s · {site}
          </p>
          <p className="loop-muted mt-3 text-[11px] font-bold uppercase tracking-[0.25em]">
            {days === 0 ? "Tonight" : `${daysInWords(days)} ${days === 1 ? "day" : "days"} to go`}
          </p>
          <a
            href={manifest.zip.href}
            className="mt-6 inline-block rounded-full bg-ink px-8 py-4 text-base font-bold text-sand transition-transform active:scale-95"
          >
            Download the kit · {mb(manifest.zip.bytes)}
          </a>
          <p className="loop-muted mt-2 text-[11px]">Every image, the logos, the cover and the release, in one zip.</p>
        </div>

        {/* ── the story ── */}
        <Section title="The story">
          <p className="text-[15px] leading-relaxed">
            A Kamloops musician is performing his album for the first and only time, in a hotel courtyard, for five
            dollars. Fourteen tracks, played live front to back, with Amen the DJ. The record isn&apos;t on Spotify,
            YouTube or anywhere else. October 10th is its first exhibition, and the only night it gets played as a
            set.
          </p>
          <ol className="mt-5">
            {runOfShow.map((i) => (
              <li key={i.id} className={`${RULE} flex gap-4 py-3`}>
                <span className="w-12 shrink-0 font-bold tabular-nums">{i.time}</span>
                <span>
                  <span className="block font-bold">{i.title}</span>
                  {i.detail && <span className="loop-muted block text-sm leading-relaxed">{i.detail}</span>}
                </span>
              </li>
            ))}
          </ol>
        </Section>

        {/* ── the hook ── */}
        <Section title="The hook">
          <p className="text-[15px] leading-relaxed">
            <strong>The audience makes the album cover.</strong> Guests shoot through the Loop Soul filter, ink on sand
            and no faces, and every frame lands on the Wall, a live gallery. Everyone there votes. The winning
            photograph becomes the official cover on streaming, credited to whoever took it, who is paid $50.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed">
            <strong>The pass is also the album.</strong> A $5 pass is emailed as a ticket, opens three tracks right
            away, and the whole record after the night.
          </p>
        </Section>

        {/* ── the single ── */}
        <Section title="The single">
          <Link href="/loop/1984" className="flex items-center gap-4">
            {cover && (
              <Image src={cover.href.split("?")[0]} alt="Loop Soul cover, Mani's version" width={96} height={96} className="h-24 w-24 object-cover" />
            )}
            <span>
              <span className="block text-2xl font-extrabold">1984</span>
              <span className="loop-muted block text-sm">Free to hear, no account · {host}/loop/1984</span>
            </span>
            <span aria-hidden className="loop-muted ml-auto">→</span>
          </Link>
          <p className="loop-muted mt-3 text-sm">Share that link on its own: it unfurls as the song, with the cover.</p>
        </Section>

        {/* ── say this ── */}
        <Section title="What to post">
          <ul className="text-[15px] leading-relaxed">
            {[
              `Put the date, the place and ${price === "FREE ENTRY" ? "that it's free" : price} in every post. Repetition is the strategy.`,
              "19+ goes on everything. It is a licensing condition, not a preference.",
              "It's Loop Soul: an album, performed live, once. Not a launch party, not Volume 1.",
              `Passes are at ${site}, capped at 250. The email is the ticket.`,
              "Photos from the night show no faces. That is the filter, and it is the rule for anything you post of the night.",
              "Don't promise a livestream or an after-party location. Neither is announced.",
            ].map((t) => (
              <li key={t} className={`${RULE} py-3`}>
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            {posts.map((p) => (
              <div key={p.id} className={`${RULE} py-4`}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">
                    {p.label}
                    {p.reel && <span className="loop-muted"> · with {REEL_LABEL[p.reel] ?? p.reel}</span>}
                  </span>
                  <CopyButton text={`${p.text}\n\n${HASHTAGS}`} />
                </div>
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{p.text}</p>
              </div>
            ))}
            <div className={`${RULE} flex items-baseline justify-between gap-4 py-4`}>
              <span className="text-sm">{HASHTAGS}</span>
              <CopyButton text={HASHTAGS} />
            </div>
          </div>
        </Section>

        {/* ── the reels ── */}
        {reelKinds.length > 0 && (
          <Section title="The reels">
            <p className="loop-muted text-sm leading-relaxed">
              Thirty seconds, 9:16, cut to loop. The versions with sound carry Billie Jean, which Instagram may mute.
              Post the silent one and add Billie Jean from the app&apos;s music library instead. Don&apos;t tag the song
              or the artist in the caption.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {reelKinds.map((k) => {
                const sound = reels.find((r) => r.name.includes(`-${k}.`));
                const silent = reels.find((r) => r.name.includes(`-${k}-silent`));
                return (
                  <div key={k}>
                    <video
                      src={(sound ?? silent)!.href}
                      poster={`/loop/press/reels/${k}.jpg`}
                      controls
                      playsInline
                      preload="none"
                      className="aspect-[9/16] w-full bg-ink object-cover"
                    />
                    <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.2em]">{REEL_LABEL[k]}</p>
                    <p className="text-[11px]">
                      {silent && (
                        <a href={silent.href} className="underline underline-offset-4">
                          Silent · {mb(silent.bytes)}
                        </a>
                      )}
                      {sound && silent && " · "}
                      {sound && (
                        <a href={sound.href} className="underline underline-offset-4">
                          Sound
                        </a>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── artwork ── */}
        <Section title="Artwork">
          <p className="loop-muted text-sm">Tap to open full size. Print from the bleed version: it has the trim marks the printer needs.</p>
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            {shown.map((f) => {
              const bleed = bleedFor(f);
              return (
                <div key={f.name}>
                  <a href={f.href} className="block">
                    <Image
                      src={f.href.split("?")[0]}
                      alt={artworkLabel(f.name)}
                      width={f.w ?? 400}
                      height={f.h ?? 400}
                      sizes="(min-width: 640px) 200px, 45vw"
                      className="h-auto w-full"
                    />
                  </a>
                  <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.2em]">{artworkLabel(f.name)}</p>
                  <p className="loop-muted text-[11px]">
                    {f.w && f.h ? `${f.w}×${f.h} · ` : ""}
                    {mb(f.bytes)}
                    {bleed && (
                      <>
                        {" · "}
                        <a href={bleed.href} className="underline underline-offset-4">
                          for the printer
                        </a>
                      </>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── cover, photos, logos ── */}
        <Section title="Cover, photos, logos">
          <ul>
            {cover && (
              <li className={`${RULE} flex items-baseline justify-between gap-4 py-3`}>
                <span>
                  <span className="block font-bold">The album cover</span>
                  <span className="loop-muted block text-sm">Mani&apos;s version. The official cover is chosen on the night; caption it as his.</span>
                </span>
                <a href={cover.href} className="shrink-0 text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4">
                  {mb(cover.bytes)}
                </a>
              </li>
            )}
            {photos.map((f) => (
              <li key={f.name} className={`${RULE} flex items-baseline justify-between gap-4 py-3`}>
                <span className="font-bold">Photo · {f.name.replace(/\.[a-z]+$/i, "")}</span>
                <a href={f.href} className="shrink-0 text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4">
                  {mb(f.bytes)}
                </a>
              </li>
            ))}
            {logos.map((f) => (
              <li key={f.name} className={`${RULE} flex items-baseline justify-between gap-4 py-3`}>
                <span className="font-bold">
                  {f.name.startsWith("loop-soul") ? "Loop Soul" : f.name.startsWith("odubo") ? "Odubo Studio, presenter" : "Scott's Inn & Suites, venue partner"}
                </span>
                <a href={f.href} className="shrink-0 text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4">
                  {f.name.split(".").pop()?.toUpperCase()}
                </a>
              </li>
            ))}
          </ul>
          <p className="loop-muted mt-3 text-sm leading-relaxed">
            On anything printed: presented by Odubo Studio, in partnership with Scott&apos;s Inn &amp; Suites. Partner,
            not sponsor. Scott&apos;s mark in black only.
          </p>
        </Section>

        <Section title="Contact">
          <p className="text-[15px]">
            Mani Odubo ·{" "}
            <a href="mailto:maniodubo@gmail.com" className="underline underline-offset-4">
              maniodubo@gmail.com
            </a>
          </p>
          <p className="loop-muted mt-1 text-sm">The press release is in the zip.</p>
        </Section>

        <Link href="/loop" className="loop-muted mt-16 block text-center text-[11px] font-bold uppercase tracking-[0.3em]">
          ← Loop Soul
        </Link>
      </div>
    </main>
  );
}
