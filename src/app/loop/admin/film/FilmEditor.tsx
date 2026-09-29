"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { palette, parseHex, hex, defaultField, contrast, INK, SAND, type RGB } from "@/lib/loop/film/palette";
import { storyIssues, type StoryIssue } from "@/lib/loop/film/naming";
import type { Card, Chapter, ShadowMode, WorldEntry } from "@/lib/loop/film/store";

type ShapeSong = {
  slug: string;
  bpm: number;
  bpmAlternate: number | null;
  fallsAwayAt: number | null;
  loudestAt: number;
  integratedLufs: number;
  contour16: number[];
};
type Data = { chapters: Chapter[]; cards: Card[]; world: WorldEntry[]; shape: { songs: ShapeSong[] } };
type Verse = { ref: string; text: string };
type LyricSegment = { start: number; end: number; text: string };

const FPS = 30;

async function post(action: string, payload: Record<string, unknown>) {
  const res = await fetch("/api/loop/admin/film", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; issues?: StoryIssue[] } & Record<string, unknown>;
  if (!res.ok) {
    const detail = data.issues?.map((i) => i.detail).join(" ") ?? data.error ?? `${res.status}`;
    throw new Error(detail);
  }
  return data;
}

/** The little figure on its field: ink, cuts, badge, shadow. */
function Figure({ field }: { field: RGB }) {
  const p = palette(field);
  return (
    <svg viewBox="0 0 80 110" className="h-24 w-[70px] shrink-0 rounded-lg" aria-hidden="true">
      <rect width="80" height="110" fill={hex(p.field)} />
      <ellipse cx="40" cy="98" rx="24" ry="5" fill={hex(p.shadow)} />
      <circle cx="40" cy="22" r="11" fill={hex(p.ink)} />
      <rect x="27" y="33" width="26" height="63" rx="11" fill={hex(p.ink)} />
      <rect x="30" y="38" width="7" height="22" rx="3.5" fill={hex(p.mid)} />
      <rect x="31" y="40" width="3" height="10" rx="1.5" fill={hex(p.highlight)} />
      <circle cx="46" cy="47" r="3.5" fill={hex(p.badge)} />
    </svg>
  );
}

function Issues({ text, maxLinks = 0 }: { text: string; maxLinks?: number }) {
  const issues = storyIssues(text, { drawn: true, maxLinks });
  if (!issues.length) return null;
  return <p className="mt-1 text-xs font-bold text-red-700">{issues.map((i) => i.detail).join(" ")}</p>;
}

function Contour({ song }: { song?: ShapeSong }) {
  if (!song) return null;
  const hi = Math.max(...song.contour16);
  const lo = hi - 20;
  return (
    <div>
      <div className="flex h-8 items-end gap-[2px]" aria-label="Loudness over the song">
        {song.contour16.map((v, i) => (
          <span
            key={i}
            className="w-2 rounded-sm bg-ink/70"
            style={{ height: `${Math.max(6, ((v - lo) / (hi - lo)) * 100)}%` }}
          />
        ))}
      </div>
      <p className="mt-1 text-xs opacity-60">
        {song.bpm} bpm{song.bpmAlternate ? ` (or ${song.bpmAlternate})` : ""} · loudest at {Math.round(song.loudestAt * 100)}%
        {song.fallsAwayAt != null ? ` · lets go at ${song.fallsAwayAt}s` : ""}
      </p>
    </div>
  );
}

/**
 * Pop-art fields in the spirit of the 2004 silhouette ads, tuned so the ink
 * figure still reads on each (contrast checked by the palette tests' rule).
 */
const POP = ["#f5b700", "#fb8944", "#fe7d95", "#d384ff", "#62a9f9", "#28c7a8", "#8bd33a", "#f2e94e"];

/** Tap the colour and the hexes open: type one, tap one, or pick freely. */
function HexPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const album = useMemo(() => Array.from({ length: 14 }, (_, i) => hex(defaultField(i, 14))), []);
  const commit = (raw: string) => {
    const rgb = parseHex(raw);
    if (rgb) onChange(hex(rgb));
  };
  const Swatch = ({ h }: { h: string }) => (
    <button
      type="button"
      onClick={() => onChange(h)}
      className={`flex flex-col items-center gap-1 rounded-lg p-1 ${h.toLowerCase() === value.toLowerCase() ? "ring-2 ring-ink" : ""}`}
      title={h}
    >
      <span className="block h-8 w-8 rounded-md border border-ink/15" style={{ background: h }} />
      <span className="font-mono text-[10px] opacity-70">{h.replace("#", "")}</span>
    </button>
  );
  return (
    <div className="text-sm font-bold">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-h-[44px] items-center gap-3">
        Colour
        <span className="block h-8 w-12 rounded border border-ink/20" style={{ background: value }} />
        <span className="font-mono text-xs opacity-70">{value}</span>
        <span className="text-xs font-normal opacity-60">{open ? "close" : "choose"}</span>
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-ink/15 p-3 font-normal">
          <label className="flex items-center gap-2 text-xs font-bold">
            Hex
            <input
              className="w-28 rounded-lg border border-ink/20 bg-transparent px-2 py-1 font-mono text-sm"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (parseHex(e.target.value)) commit(e.target.value);
              }}
              onBlur={() => commit(text)}
              placeholder="#d9aa7a"
            />
            <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-ink/20" aria-label="Pick any colour" />
          </label>
          <p className="mt-3 text-xs font-bold">The album&apos;s wheel</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {album.map((h) => (
              <Swatch key={`a${h}`} h={h} />
            ))}
          </div>
          <p className="mt-3 text-xs font-bold">Pop</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {POP.map((h) => (
              <Swatch key={`p${h}`} h={h} />
            ))}
          </div>
          {contrast(INK, parseHex(value) ?? SAND) < 7 && (
            <p className="mt-2 text-xs font-bold text-red-700">The ink figure is hard to read on this colour. Try a lighter one.</p>
          )}
        </div>
      )}
    </div>
  );
}

const input = "w-full rounded-lg border border-ink/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-ink/60";
const button = "rounded-full border border-ink/30 px-4 py-2 text-sm font-bold disabled:opacity-40";
const primary = "rounded-full bg-ink px-4 py-2 text-sm font-bold text-sand disabled:opacity-40";

export default function FilmEditor() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<"chapters" | "world">("chapters");
  const [slug, setSlug] = useState<string>("welcome");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/loop/admin/film", { cache: "no-store" });
    if (res.ok) setData((await res.json()) as Data);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (fn: () => Promise<unknown>, done?: string) => {
      setBusy(true);
      setNote(null);
      try {
        await fn();
        await load();
        if (done) setNote(done);
      } catch (err) {
        setNote((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  if (!data) return <p className="mt-8 text-sm opacity-60">Loading…</p>;

  return (
    <div className="mt-8">
      <div className="flex gap-2">
        <button className={tab === "chapters" ? primary : button} onClick={() => setTab("chapters")}>
          Chapters
        </button>
        <button className={tab === "world" ? primary : button} onClick={() => setTab("world")}>
          The world
        </button>
      </div>
      {note && <p className="mt-4 text-sm font-bold">{note}</p>}
      {tab === "chapters" ? (
        <Chapters data={data} slug={slug} setSlug={setSlug} run={run} busy={busy} />
      ) : (
        <World data={data} run={run} busy={busy} />
      )}
    </div>
  );
}

type Run = (fn: () => Promise<unknown>, done?: string) => Promise<void>;

function Chapters({ data, slug, setSlug, run, busy }: { data: Data; slug: string; setSlug: (s: string) => void; run: Run; busy: boolean }) {
  const chapter = data.chapters.find((c) => c.slug === slug) ?? data.chapters[0];
  return (
    <>
      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {data.chapters.map((c) => (
          <button
            key={c.slug}
            onClick={() => setSlug(c.slug)}
            className={`flex h-16 w-16 shrink-0 flex-col justify-between rounded-lg p-1.5 text-left text-[10px] font-bold leading-tight text-ink ${c.slug === chapter.slug ? "ring-2 ring-ink" : ""}`}
            style={{ background: c.field }}
            title={c.title}
          >
            <span>{c.number}</span>
            <span className="truncate">{c.title}</span>
            <span className={`h-1.5 w-1.5 rounded-full ${c.status === "approved" ? (c.revealedAt ? "bg-ink" : "bg-ink/50") : "border border-ink/50"}`} />
          </button>
        ))}
      </div>
      <p className="text-xs opacity-60">Hollow dot: draft. Grey: approved. Solid: approved and revealed.</p>
      {chapter && <ChapterPanel key={chapter.slug} data={data} chapter={chapter} run={run} busy={busy} />}
    </>
  );
}

function ChapterPanel({ data, chapter, run, busy }: { data: Data; chapter: Chapter; run: Run; busy: boolean }) {
  const song = data.shape.songs.find((s) => s.slug === chapter.slug);
  const [title, setTitle] = useState(chapter.title);
  const [thread, setThread] = useState(chapter.thread ?? "");
  const [emotion, setEmotion] = useState(chapter.emotion ?? "");
  const [field, setField] = useState(chapter.field);
  const [shadowMode, setShadowMode] = useState<ShadowMode>(chapter.shadowMode);
  const [shadowLag, setShadowLag] = useState(chapter.shadowLag);
  const [badgeFrom, setBadgeFrom] = useState(chapter.badgeFrom == null ? "" : String(chapter.badgeFrom));
  const segments = useMemo<LyricSegment[]>(() => {
    try {
      return chapter.lyricsDraft ? (JSON.parse(chapter.lyricsDraft).segments as LyricSegment[]) : [];
    } catch {
      return [];
    }
  }, [chapter.lyricsDraft]);
  const [lyrics, setLyrics] = useState(segments.map((s) => s.text.trim()).join("\n"));
  const rgb = parseHex(field) ?? ([217, 170, 122] as RGB);
  const beat = song?.bpm ? Math.round((60 / song.bpm) * FPS) : null;
  const cards = data.cards.filter((c) => c.chapter === chapter.slug);

  const patch = {
    title: title.trim(),
    thread: thread.trim() || null,
    emotion: emotion.trim() || null,
    field,
    shadowMode,
    shadowLag: Number(shadowLag) || 0,
    badgeFrom: badgeFrom.trim() === "" ? null : Number(badgeFrom),
  };

  return (
    <section className="mt-6 border-t border-ink/15 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">
          {chapter.number} · {chapter.title}
        </h2>
        <span className="text-xs font-bold uppercase tracking-widest opacity-60">
          {chapter.status}
          {chapter.revealedAt ? " · revealed" : ""}
        </span>
      </div>

      <div className="mt-4 grid gap-4">
        <label className="block text-sm font-bold">
          Chapter title
          <input className={`${input} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Issues text={title} />
        </label>
        <label className="block text-sm font-bold">
          The thread
          <span className="block text-xs font-normal opacity-60">Where Recoolman is in this song. A line or two, shown, never explained.</span>
          <textarea className={`${input} mt-1`} rows={3} value={thread} onChange={(e) => setThread(e.target.value)} />
          <Issues text={thread} />
        </label>
        <label className="block text-sm font-bold">
          Emotion words
          <span className="block text-xs font-normal opacity-60">They drive the verse search below.</span>
          <input className={`${input} mt-1`} value={emotion} onChange={(e) => setEmotion(e.target.value)} placeholder="dust, breath, rising" />
        </label>

        <div className="flex items-start gap-4">
          <Figure field={rgb} />
          <div className="grid flex-1 gap-3">
            <HexPicker value={field} onChange={setField} />
            <label className="flex flex-wrap items-center gap-3 text-sm font-bold">
              His shadow
              <select className="rounded-lg border border-ink/20 bg-transparent px-2 py-1 text-sm" value={shadowMode} onChange={(e) => setShadowMode(e.target.value as ShadowMode)}>
                <option value="sync">In step (one with the ground)</option>
                <option value="lag">Lagging (The Game pulling)</option>
                <option value="none">None</option>
              </select>
              {shadowMode === "lag" && (
                <span className="flex items-center gap-2 font-normal">
                  <input type="number" min={1} max={120} className="w-20 rounded-lg border border-ink/20 bg-transparent px-2 py-1 text-sm" value={shadowLag} onChange={(e) => setShadowLag(Number(e.target.value))} />
                  frames{beat ? ` (one beat is ${beat})` : ""}
                </span>
              )}
            </label>
            <label className="flex flex-wrap items-center gap-3 text-sm font-bold">
              Badge lands at
              <input className="w-24 rounded-lg border border-ink/20 bg-transparent px-2 py-1 text-sm" value={badgeFrom} onChange={(e) => setBadgeFrom(e.target.value)} placeholder="start" />
              <span className="font-normal opacity-60">seconds into the song; empty means it is there from the start</span>
            </label>
          </div>
        </div>

        <Contour song={song} />

        <div className="flex flex-wrap gap-2">
          <button className={primary} disabled={busy} onClick={() => run(() => post("chapter.update", { slug: chapter.slug, patch }), "Saved.")}>
            Save
          </button>
          {chapter.status === "draft" ? (
            <button className={button} disabled={busy} onClick={() => run(() => post("chapter.update", { slug: chapter.slug, patch: { ...patch, status: "approved" } }), "Approved.")}>
              Approve
            </button>
          ) : (
            <button className={button} disabled={busy} onClick={() => run(() => post("chapter.update", { slug: chapter.slug, patch: { status: "draft", revealedAt: null } }), "Back to draft.")}>
              Back to draft
            </button>
          )}
          {chapter.status === "approved" &&
            (chapter.revealedAt ? (
              <button className={button} disabled={busy} onClick={() => run(() => post("chapter.update", { slug: chapter.slug, patch: { revealedAt: null } }), "Hidden again.")}>
                Hide
              </button>
            ) : (
              <button className={button} disabled={busy} onClick={() => window.confirm("Reveal this chapter to everyone?") && run(() => post("chapter.update", { slug: chapter.slug, patch: { revealedAt: new Date().toISOString() } }), "Revealed.")}>
                Reveal
              </button>
            ))}
        </div>
      </div>

      <div className="mt-10 border-t border-ink/15 pt-6">
        <h3 className="text-lg font-extrabold">The words</h3>
        {segments.length ? (
          <>
            <p className="mt-1 text-xs opacity-60">Transcribed by machine from the separated vocals. Correct it, then save it to the song.</p>
            <textarea className={`${input} mt-2 font-mono`} rows={10} value={lyrics} onChange={(e) => setLyrics(e.target.value)} />
            <button className={`${button} mt-2`} disabled={busy} onClick={() => run(() => post("lyrics.save", { slug: chapter.slug, text: lyrics }), "Saved to the song.")}>
              Save to the song
            </button>
          </>
        ) : (
          <p className="mt-1 text-sm opacity-60">Not transcribed yet. It arrives with `npm run film:transcribe`.</p>
        )}
      </div>

      <div className="mt-10 border-t border-ink/15 pt-6">
        <h3 className="text-lg font-extrabold">Scripture cards</h3>
        <p className="mt-1 text-xs opacity-60">Each approved card becomes one clip: the verse is the sample, the flip is how you cut it.</p>
        {cards.length === 0 && <p className="mt-3 text-sm opacity-60">No cards yet. Find a verse below.</p>}
        {cards.map((c) => (
          <CardRow key={c.id} card={c} run={run} busy={busy} />
        ))}
        <VerseSearch chapter={chapter.slug} emotion={emotion} run={run} busy={busy} />
      </div>
    </section>
  );
}

function CardRow({ card, run, busy }: { card: Card; run: Run; busy: boolean }) {
  const [verseRef, setVerseRef] = useState(card.verseRef);
  const [verseText, setVerseText] = useState(card.verseText);
  const [flip, setFlip] = useState(card.flip ?? "");
  const [start, setStart] = useState(card.filmStart == null ? "" : String(card.filmStart));
  const [end, setEnd] = useState(card.filmEnd == null ? "" : String(card.filmEnd));
  const patch = {
    verseRef: verseRef.trim(),
    verseText: verseText.trim(),
    flip: flip.trim() || null,
    filmStart: start.trim() === "" ? null : Number(start),
    filmEnd: end.trim() === "" ? null : Number(end),
  };
  return (
    <div className="mt-4 border-t border-ink/10 pt-4">
      <div className="flex items-center justify-between gap-2">
        <input className="rounded-lg border border-ink/20 bg-transparent px-2 py-1 text-sm font-bold" value={verseRef} onChange={(e) => setVerseRef(e.target.value)} />
        <span className="text-xs font-bold uppercase tracking-widest opacity-60">{card.status}</span>
      </div>
      <label className="mt-2 block text-xs font-bold">
        The words on the card (trim to the part that lands)
        <textarea className={`${input} mt-1`} rows={3} value={verseText} onChange={(e) => setVerseText(e.target.value)} />
        <Issues text={verseText} />
      </label>
      <label className="mt-2 block text-xs font-bold">
        Your flip
        <input className={`${input} mt-1`} value={flip} onChange={(e) => setFlip(e.target.value)} placeholder="The line a scroller gets at once" />
        <Issues text={flip} />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        Moment in the film
        <input className="w-20 rounded-lg border border-ink/20 bg-transparent px-2 py-1" value={start} onChange={(e) => setStart(e.target.value)} placeholder="from s" />
        <input className="w-20 rounded-lg border border-ink/20 bg-transparent px-2 py-1" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="to s" />
        <span className="opacity-60">(set once the take is in)</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => run(() => post("card.update", { id: card.id, patch }), "Card saved.")}>
          Save
        </button>
        {card.status === "draft" ? (
          <button className={button} disabled={busy} onClick={() => run(() => post("card.update", { id: card.id, patch: { ...patch, status: "approved" } }), "Card approved.")}>
            Approve
          </button>
        ) : (
          <button className={button} disabled={busy} onClick={() => run(() => post("card.update", { id: card.id, patch: { status: "draft" } }), "Card back to draft.")}>
            Back to draft
          </button>
        )}
        {!card.videoId && (
          <button className={button} disabled={busy} onClick={() => window.confirm("Delete this card?") && run(() => post("card.delete", { id: card.id }), "Card deleted.")}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function VerseSearch({ chapter, emotion, run, busy }: { chapter: string; emotion: string; run: Run; busy: boolean }) {
  const [q, setQ] = useState(emotion);
  const [results, setResults] = useState<Verse[] | null>(null);
  const [searching, setSearching] = useState(false);
  async function search(query: string) {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/loop/admin/film?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      const data = (await res.json()) as { verses: Verse[] };
      setResults(data.verses ?? []);
    } finally {
      setSearching(false);
    }
  }
  return (
    <div className="mt-8">
      <h4 className="text-sm font-extrabold">Find a verse</h4>
      <p className="text-xs opacity-60">Words, or a reference like Genesis 2:5-7. Verses that name Him are never offered.</p>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search(q);
        }}
      >
        <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="dust ground breath" />
        <button className={primary} disabled={searching}>
          {searching ? "…" : "Search"}
        </button>
      </form>
      {results && results.length === 0 && <p className="mt-2 text-sm opacity-60">Nothing found.</p>}
      {results?.map((v) => (
        <div key={v.ref} className="mt-3 flex items-start justify-between gap-3 border-t border-ink/10 pt-3">
          <p className="text-sm">
            <span className="font-bold">{v.ref}</span> {v.text}
          </p>
          <button
            className={button}
            disabled={busy}
            onClick={() => run(() => post("card.create", { chapter, verseRef: v.ref, verseText: v.text }), `Added ${v.ref}.`)}
          >
            Add
          </button>
        </div>
      ))}
    </div>
  );
}

function World({ data, run, busy }: { data: Data; run: Run; busy: boolean }) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [line, setLine] = useState("");
  const [revealedWith, setRevealedWith] = useState("");
  return (
    <section className="mt-6">
      <p className="text-sm opacity-70">
        The world page is a sparse map. Each entry is a name and one line, shown when its chapter is revealed. Until then it is
        a silhouette. Nothing is explained.
      </p>
      {data.world.map((w) => (
        <WorldRow key={w.slug} entry={w} chapters={data.chapters} run={run} busy={busy} />
      ))}
      <div className="mt-8 border-t border-ink/15 pt-6">
        <h3 className="text-sm font-extrabold">A new entry</h3>
        <div className="mt-2 grid gap-2">
          <input className={input} value={name} onChange={(e) => { setName(e.target.value); setSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} placeholder="Name" />
          <input className={input} value={line} onChange={(e) => setLine(e.target.value)} placeholder="One line" />
          <Issues text={`${name} ${line}`} />
          <select className="rounded-lg border border-ink/20 bg-transparent px-2 py-2 text-sm" value={revealedWith} onChange={(e) => setRevealedWith(e.target.value)}>
            <option value="">Shown from the start</option>
            {data.chapters.map((c) => (
              <option key={c.slug} value={c.slug}>
                With {c.number} · {c.title}
              </option>
            ))}
          </select>
          <button
            className={primary}
            disabled={busy || !slug || !line.trim()}
            onClick={() =>
              run(
                () => post("world.create", { slug, name: name.trim(), line: line.trim(), revealedWith: revealedWith || null, sort: data.world.length + 1 }),
                "Entry added.",
              ).then(() => {
                setName("");
                setLine("");
                setSlug("");
              })
            }
          >
            Add entry
          </button>
        </div>
      </div>
    </section>
  );
}

function WorldRow({ entry, chapters, run, busy }: { entry: WorldEntry; chapters: Chapter[]; run: Run; busy: boolean }) {
  const [name, setName] = useState(entry.name);
  const [line, setLine] = useState(entry.line);
  const [revealedWith, setRevealedWith] = useState(entry.revealedWith ?? "");
  const patch = { name: name.trim(), line: line.trim(), revealedWith: revealedWith || null };
  return (
    <div className="mt-4 border-t border-ink/15 pt-4">
      <div className="flex items-center justify-between gap-2">
        <input className="rounded-lg border border-ink/20 bg-transparent px-2 py-1 text-sm font-bold" value={name} onChange={(e) => setName(e.target.value)} />
        <span className="text-xs font-bold uppercase tracking-widest opacity-60">{entry.status}</span>
      </div>
      <input className={`${input} mt-2`} value={line} onChange={(e) => setLine(e.target.value)} />
      <Issues text={`${name} ${line}`} />
      <select className="mt-2 rounded-lg border border-ink/20 bg-transparent px-2 py-1 text-sm" value={revealedWith} onChange={(e) => setRevealedWith(e.target.value)}>
        <option value="">Shown from the start</option>
        {chapters.map((c) => (
          <option key={c.slug} value={c.slug}>
            With {c.number} · {c.title}
          </option>
        ))}
      </select>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => run(() => post("world.update", { slug: entry.slug, patch }), "Saved.")}>
          Save
        </button>
        {entry.status === "draft" ? (
          <button className={button} disabled={busy} onClick={() => run(() => post("world.update", { slug: entry.slug, patch: { ...patch, status: "approved" } }), "Approved.")}>
            Approve
          </button>
        ) : (
          <button className={button} disabled={busy} onClick={() => run(() => post("world.update", { slug: entry.slug, patch: { status: "draft" } }), "Back to draft.")}>
            Back to draft
          </button>
        )}
        <button className={button} disabled={busy} onClick={() => window.confirm(`Delete ${entry.name}?`) && run(() => post("world.delete", { slug: entry.slug }), "Deleted.")}>
          Delete
        </button>
      </div>
    </div>
  );
}
