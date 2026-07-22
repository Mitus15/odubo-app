"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { buildBracket, type Track, type Bracket } from "@/lib/loop/anthem";
import type { Side } from "@/lib/loop/votes";
import type { AnthemState } from "@/lib/loop/anthem-server";
import type { LeaderboardRow } from "@/lib/loop/anthem-candidates";
import type { TrackResult } from "@/lib/loop/music/itunes";
import LoopLoader from "@/components/loop/brand/LoopLoader";
import ArcedTagline from "@/components/loop/brand/ArcedTagline";

/**
 * The Soul Loop Anthem. One component, three stages driven by the server's
 * stage machine for the active monthly event:
 *   nominating → the crowd suggests + upvotes a longlist (admin curates the 8)
 *   bracket    → vote once per matchup, change freely until the round closes
 *   champion   → the room's anthem
 * The bracket is re-derived client-side with the same pure `buildBracket`, so
 * votes (and changes) are optimistic and instant; the server reconciles.
 */
export function AnthemBracket({ initial }: { initial: AnthemState }) {
  const [state, setState] = useState<AnthemState>(initial);
  const offsetRef = useRef(initial.serverNow - Date.now());
  const [, setTick] = useState(0);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  // Track round changes so a returning/idle voter learns the next round opened
  // (or the anthem was crowned) without watching the countdown. `undefined`
  // means "not yet observed" so the first render never announces.
  const prevActiveRef = useRef<number | null | undefined>(undefined);
  const announcedChampionRef = useRef(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const now = useCallback(() => Date.now() + offsetRef.current, []);

  // Tick once a second so countdowns stay live.
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/loop/anthem", { cache: "no-store" });
      if (!r.ok) return;
      const s = (await r.json()) as AnthemState;
      offsetRef.current = s.serverNow - Date.now();
      setState(s);
    } catch {
      /* keep last good state */
    }
  }, []);

  // Poll so others' votes/nominations and stage transitions surface.
  useEffect(() => {
    const i = setInterval(refresh, 15000);
    return () => clearInterval(i);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const togglePlay = useCallback(
    (id: string, previewUrl: string | null) => {
      if (!previewUrl) return;
      const el = audioRef.current ?? new Audio();
      audioRef.current = el;
      if (playingId === id) {
        el.pause();
        setPlayingId(null);
        return;
      }
      el.src = previewUrl;
      el.play().then(
        () => setPlayingId(id),
        () => setToast("Couldn't play preview"),
      );
      el.onended = () => setPlayingId(null);
    },
    [playingId],
  );

  // Re-derive the bracket from optimistic tallies + the ticking clock.
  const bracket: Bracket | null = useMemo(() => {
    if (!state.seeds) return state.bracket;
    const schedule = { closesAt: [state.schedule.qf, state.schedule.sf, state.schedule.final] };
    return buildBracket(state.seeds, state.tallies, schedule, now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.seeds, state.tallies, state.schedule, state.bracket]);

  // Announce a newly-opened round or the crowned anthem (transitions surface on
  // the next poll). This is also the natural hook for a future push notification.
  useEffect(() => {
    if (!bracket) return;
    const active = bracket.activeRound;
    if (prevActiveRef.current === undefined) {
      prevActiveRef.current = active; // first observation — don't announce
    } else if (active !== null && active !== prevActiveRef.current) {
      if (active > (prevActiveRef.current ?? -1)) {
        setToast(`${bracket.rounds[active].name} are live — vote now`);
      }
      prevActiveRef.current = active;
    }
    if (bracket.champion && !announcedChampionRef.current) {
      announcedChampionRef.current = true;
      setToast(`The anthem is “${bracket.champion.title}” 🎉`);
    }
  }, [bracket]);

  async function castVote(matchupId: string, side: Side) {
    if (pending.has(matchupId)) return;
    const prevSide = state.myBallots[matchupId];
    if (prevSide === side) return; // already my pick — nothing to change

    // Optimistic: move my ballot (decrement old side, increment new).
    setState((s) => {
      const tallies = { ...s.tallies };
      const cur = { ...(tallies[matchupId] ?? { a: 0, b: 0 }) };
      if (prevSide) cur[prevSide] = Math.max(0, cur[prevSide] - 1);
      cur[side] += 1;
      tallies[matchupId] = cur;
      return { ...s, tallies, myBallots: { ...s.myBallots, [matchupId]: side } };
    });
    setPending((s) => new Set(s).add(matchupId));

    try {
      const res = await fetch("/api/loop/anthem/vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matchupId, side }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        tallies?: AnthemState["tallies"];
        myBallots?: AnthemState["myBallots"];
      };
      if (!res.ok) {
        setState((s) => ({
          ...s,
          tallies: data.tallies ?? s.tallies,
          myBallots: data.myBallots ?? s.myBallots,
        }));
        setToast("That round just closed — your pick is locked");
        refresh();
      } else if (data.tallies && data.myBallots) {
        setState((s) => ({ ...s, tallies: data.tallies!, myBallots: data.myBallots! }));
      }
    } catch {
      setToast("No connection — vote didn't count");
      refresh();
    } finally {
      setPending((s) => {
        const n = new Set(s);
        n.delete(matchupId);
        return n;
      });
    }
  }

  // ── Stage: champion ────────────────────────────────────────────────────
  if (state.stage === "champion" && bracket?.champion) {
    return (
      <div className="flex flex-col items-center text-center">
        <p className="text-xs font-bold uppercase tracking-[0.3em] opacity-70">
          The Soul Loop Anthem
        </p>
        <ChampionCard
          track={bracket.champion}
          playing={playingId === bracket.champion.id}
          onPlay={togglePlay}
        />
        <p className="mt-4 text-sm opacity-70">Crowned by the room. The DJ has it.</p>
      </div>
    );
  }

  // ── Stage: nominating / seeding ────────────────────────────────────────
  if (state.stage === "nominating" || state.stage === "seeding") {
    return (
      <NominationStage
        state={state}
        open={state.stage === "nominating"}
        canSuggest={state.canSuggest}
        closesIn={state.schedule.nominations - now()}
        playingId={playingId}
        onPlay={togglePlay}
        onChange={setState}
        onToast={setToast}
        toast={toast}
      />
    );
  }

  // ── Stage: bracket ─────────────────────────────────────────────────────
  const active =
    bracket && bracket.activeRound !== null ? bracket.rounds[bracket.activeRound] : null;
  const votableMatchups = active ? active.matchups.filter((m) => m.a && m.b) : [];
  const allVoted =
    votableMatchups.length > 0 && votableMatchups.every((m) => state.myBallots[m.id]);

  return (
    <div className="w-full">
      <div className="flex flex-col items-center text-center">
        <ArcedTagline text="What are you dancing to?" className="text-ink" width={280} />
        <h2 className="-mt-2 text-2xl font-extrabold">Soul Loop Anthem</h2>
        <p className="text-sm opacity-70">
          {active ? active.name : "The bracket"} · vote to advance — change it until the round closes
        </p>
        {bracket?.activeRoundClosesAt != null && (
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-electric-deep">
            Closes in {fmtCountdown(bracket.activeRoundClosesAt - now())}
          </p>
        )}
        {allVoted && (
          <p className="mt-2 text-xs opacity-60">
            You&apos;re all set this round — change a pick anytime, or check back when the next
            round opens.
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-4">
        {active?.matchups
          .filter((m) => m.a && m.b)
          .map((m) => (
            <MatchupCard
              key={m.id}
              matchup={m}
              myPick={state.myBallots[m.id] ?? null}
              busy={pending.has(m.id)}
              playingId={playingId}
              onPlay={togglePlay}
              onVote={castVote}
            />
          ))}
      </div>

      {bracket && <BracketMap bracket={bracket} />}

      {toast && <Toast text={toast} />}
    </div>
  );
}

// ── Nomination stage ───────────────────────────────────────────────────────

function NominationStage({
  state,
  open,
  canSuggest,
  closesIn,
  playingId,
  onPlay,
  onChange,
  onToast,
  toast,
}: {
  state: AnthemState;
  open: boolean;
  canSuggest: boolean;
  closesIn: number;
  playingId: string | null;
  onPlay: (id: string, url: string | null) => void;
  onChange: (updater: (s: AnthemState) => AnthemState) => void;
  onToast: (t: string) => void;
  toast: string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  async function redeemCode() {
    if (!code.trim()) return;
    setRedeeming(true);
    try {
      const res = await fetch("/api/loop/anthem/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as { ok?: boolean; canSuggest?: boolean; error?: string };
      if (res.ok && data.canSuggest) {
        onChange((s) => ({ ...s, canSuggest: true }));
        setCode("");
        onToast("Pass confirmed — suggest away");
      } else {
        onToast(data.error ?? "That code didn't work");
      }
    } catch {
      onToast("No connection — try again");
    } finally {
      setRedeeming(false);
    }
  }

  // Debounced iTunes search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const r = await fetch(`/api/loop/anthem/search?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
        });
        const data = (await r.json()) as { results?: TrackResult[] };
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query]);

  const existingIds = useMemo(
    () => new Set(state.leaderboard.map((r) => r.candidate.id)),
    [state.leaderboard],
  );

  async function suggest(track: TrackResult) {
    setBusyId(track.id);
    try {
      const res = await fetch("/api/loop/anthem/nominate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(track),
      });
      const data = (await res.json()) as { ok?: boolean; leaderboard?: LeaderboardRow[] };
      if (res.ok && data.leaderboard) {
        const lb = data.leaderboard;
        // A new suggestion implicitly likes itself only if a like was free — so
        // recompute likes-used from the authoritative leaderboard.
        onChange((s) => ({ ...s, leaderboard: lb, myUpvotes: lb.filter((r) => r.mine).length }));
        setQuery("");
        setResults([]);
        onToast("Added to the longlist");
      } else {
        onToast("Nominations are closed");
      }
    } catch {
      onToast("No connection — try again");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleUpvote(candidateId: string) {
    const row = state.leaderboard.find((r) => r.candidate.id === candidateId);
    const adding = row ? !row.mine : true;

    // Block a like over the cap before it leaves the device.
    if (adding && state.myUpvotes >= state.upvoteLimit) {
      onToast(`You get ${state.upvoteLimit} likes — unlike one first`);
      return;
    }

    // Optimistic flip (no live re-sort to avoid jumpiness) + adjust likes used.
    const flip = (mine: boolean) => (s: AnthemState) => ({
      ...s,
      myUpvotes: Math.max(0, s.myUpvotes + (mine ? 1 : -1)),
      leaderboard: s.leaderboard.map((r) =>
        r.candidate.id === candidateId
          ? { ...r, mine, votes: Math.max(0, r.votes + (mine ? 1 : -1)) }
          : r,
      ),
    });
    onChange(flip(adding));

    try {
      const res = await fetch("/api/loop/anthem/upvote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      const data = (await res.json()) as { count?: number; error?: string };
      if (!res.ok) {
        onChange(flip(!adding)); // revert
        onToast(data.error ?? "That didn't go through");
      } else if (typeof data.count === "number") {
        onChange((s) => ({ ...s, myUpvotes: data.count! })); // reconcile authoritative count
      }
    } catch {
      onChange(flip(!adding)); // revert
      onToast("No connection — try again");
    }
  }

  const atLimit = state.myUpvotes >= state.upvoteLimit;

  return (
    <div className="w-full">
      <div className="flex flex-col items-center text-center">
        <ArcedTagline text="What should we dance to?" className="text-ink" width={300} />
        <h2 className="-mt-2 text-2xl font-extrabold">Soul Loop Anthem</h2>
        <p className="text-sm opacity-70">
          {open ? "Suggest a song & upvote the longlist" : "The longlist is locked"}
        </p>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-electric-deep">
          {open ? `Nominations close in ${fmtCountdown(closesIn)}` : "The 8 are being chosen…"}
        </p>
      </div>

      {open && !canSuggest && (
        <div className="mt-5 rounded-2xl border border-ink/15 bg-ink/[0.04] p-4">
          <p className="text-sm font-bold">Got a pass? Suggest a song.</p>
          <p className="mt-0.5 text-xs opacity-70">
            Suggesting is for pass-holders. Enter your event code to add a track — anyone can still
            upvote the longlist below.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && redeemCode()}
              placeholder="LOOP-XXXX"
              autoCapitalize="characters"
              className="min-w-0 flex-1 rounded-2xl border border-ink/15 bg-bone/40 px-4 py-3 text-sm uppercase tracking-widest outline-none focus:border-ink/40"
            />
            <button
              type="button"
              disabled={redeeming || !code.trim()}
              onClick={redeemCode}
              className="shrink-0 rounded-full bg-ink px-5 py-3 text-sm font-bold text-electric transition-transform active:scale-95 disabled:opacity-40"
            >
              {redeeming ? <LoopLoader size={18} /> : "Unlock"}
            </button>
          </div>
        </div>
      )}

      {open && canSuggest && (
        <div className="mt-5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a song to suggest…"
            className="w-full rounded-2xl border border-ink/15 bg-bone/40 px-4 py-3 text-sm outline-none focus:border-ink/40"
          />
          {(searching || results.length > 0) && (
            <div className="mt-2 grid gap-1.5">
              {searching && results.length === 0 && (
                <div className="flex justify-center py-3">
                  <LoopLoader size={22} />
                </div>
              )}
              {results.map((t) => {
                const already = existingIds.has(t.id);
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-ink/[0.03] p-2"
                  >
                    <PlayButton
                      artworkUrl={t.artworkUrl}
                      playing={playingId === t.id}
                      onClick={() => onPlay(t.id, t.previewUrl)}
                      label={t.title}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{t.title}</div>
                      <div className="truncate text-xs opacity-70">{t.artist}</div>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === t.id || already}
                      onClick={() => suggest(t)}
                      className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-bold text-electric transition-transform active:scale-95 disabled:opacity-40"
                    >
                      {busyId === t.id ? <LoopLoader size={16} /> : already ? "On list" : "Suggest"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <div className="mb-2 text-center text-xs font-bold uppercase tracking-widest opacity-50">
          The longlist {state.leaderboard.length > 0 && `· ${state.leaderboard.length}`}
        </div>
        <div className="mb-2 text-center text-xs opacity-60">
          {open
            ? `Your likes: ${state.myUpvotes}/${state.upvoteLimit}${atLimit ? " · unlike one to move it" : ""}`
            : "Likes are locked"}
        </div>
        <div className="grid gap-1.5">
          {state.leaderboard.map((row, i) => (
            <div
              key={row.candidate.id}
              className="flex items-center gap-3 rounded-2xl bg-bone/40 p-2"
            >
              <span className="w-5 shrink-0 text-center text-xs font-black tabular-nums opacity-40">
                {i + 1}
              </span>
              <PlayButton
                artworkUrl={row.candidate.artworkUrl}
                playing={playingId === row.candidate.id}
                onClick={() => onPlay(row.candidate.id, row.candidate.previewUrl)}
                label={row.candidate.title}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{row.candidate.title}</div>
                <div className="truncate text-xs opacity-70">{row.candidate.artist}</div>
              </div>
              <button
                type="button"
                disabled={!open || (!row.mine && atLimit)}
                onClick={() => toggleUpvote(row.candidate.id)}
                title={!row.mine && atLimit ? `You get ${state.upvoteLimit} likes` : undefined}
                className={[
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-transform active:scale-95 disabled:opacity-40",
                  row.mine ? "bg-ink text-electric" : "bg-ink/10 text-ink",
                ].join(" ")}
                aria-pressed={row.mine}
              >
                <span>{row.mine ? "♥" : "♡"}</span>
                <span className="tabular-nums">{row.votes}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {toast && <Toast text={toast} />}
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "closing…";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function Toast({ text }: { text: string }) {
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 mx-auto w-fit rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-electric shadow-lg">
      {text}
    </div>
  );
}

function PlayButton({
  artworkUrl,
  playing,
  onClick,
  label,
}: {
  artworkUrl: string | null;
  playing: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink text-electric"
      aria-label={playing ? `Pause ${label}` : `Play ${label}`}
    >
      {artworkUrl ? (
        <Image
          src={artworkUrl}
          alt=""
          width={48}
          height={48}
          className="h-full w-full object-cover opacity-80"
          unoptimized
        />
      ) : null}
      <span className="absolute text-lg">{playing ? "❚❚" : "▶"}</span>
    </button>
  );
}

function pct(a: number, b: number, side: "a" | "b") {
  const total = a + b;
  if (total === 0) return 50;
  return Math.round(((side === "a" ? a : b) / total) * 100);
}

function MatchupCard({
  matchup,
  myPick,
  busy,
  playingId,
  onPlay,
  onVote,
}: {
  matchup: Bracket["rounds"][number]["matchups"][number];
  myPick: Side | null;
  busy: boolean;
  playingId: string | null;
  onPlay: (id: string, url: string | null) => void;
  onVote: (id: string, side: Side) => void;
}) {
  const { a, b, votesA, votesB } = matchup;
  if (!a || !b) return null;
  return (
    <div className="rounded-3xl border border-ink/15 bg-ink/[0.04] p-3">
      <TrackRow
        track={a}
        share={pct(votesA, votesB, "a")}
        mine={myPick === "a"}
        playing={playingId === a.id}
        busy={busy}
        onPlay={onPlay}
        onVote={() => onVote(matchup.id, "a")}
      />
      <div className="my-1.5 text-center text-xs font-black uppercase tracking-widest opacity-40">
        vs
      </div>
      <TrackRow
        track={b}
        share={pct(votesA, votesB, "b")}
        mine={myPick === "b"}
        playing={playingId === b.id}
        busy={busy}
        onPlay={onPlay}
        onVote={() => onVote(matchup.id, "b")}
      />
    </div>
  );
}

function TrackRow({
  track,
  share,
  mine,
  playing,
  busy,
  onPlay,
  onVote,
}: {
  track: Track;
  share: number;
  mine: boolean;
  playing: boolean;
  busy: boolean;
  onPlay: (id: string, url: string | null) => void;
  onVote: () => void;
}) {
  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-bone/40 p-2">
      <div
        className="absolute inset-y-0 left-0 bg-electric-deep/20 transition-[width] duration-500"
        style={{ width: `${share}%` }}
        aria-hidden="true"
      />
      <PlayButton
        artworkUrl={track.artworkUrl}
        playing={playing}
        onClick={() => onPlay(track.id, track.previewUrl)}
        label={track.title}
      />
      <div className="relative z-10 min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{track.title}</div>
        <div className="truncate text-xs opacity-70">{track.artist}</div>
      </div>
      <div className="relative z-10 w-9 text-right text-sm font-bold tabular-nums opacity-70">
        {share}%
      </div>
      <button
        type="button"
        onClick={onVote}
        disabled={busy}
        className={[
          "relative z-10 shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-transform active:scale-95 disabled:opacity-50",
          mine ? "bg-electric text-ink ring-2 ring-ink/20" : "bg-ink text-electric",
        ].join(" ")}
      >
        {busy ? <LoopLoader size={18} /> : mine ? "Voted ✓" : "Vote"}
      </button>
    </div>
  );
}

function ChampionCard({
  track,
  playing,
  onPlay,
}: {
  track: Track;
  playing: boolean;
  onPlay: (id: string, url: string | null) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPlay(track.id, track.previewUrl)}
      className="mt-4 flex items-center gap-4 rounded-3xl bg-ink p-4 text-left text-electric"
    >
      {track.artworkUrl ? (
        <Image
          src={track.artworkUrl}
          alt=""
          width={72}
          height={72}
          className="h-[72px] w-[72px] rounded-2xl object-cover"
          unoptimized
        />
      ) : null}
      <span>
        <span className="block text-xl font-extrabold">{track.title}</span>
        <span className="block text-sm opacity-80">{track.artist}</span>
        <span className="mt-1 block text-xs uppercase tracking-widest opacity-60">
          {playing ? "Playing…" : "Tap to play"}
        </span>
      </span>
    </button>
  );
}

function BracketMap({ bracket }: { bracket: Bracket }) {
  return (
    <div className="mt-8">
      <div className="mb-2 text-center text-xs font-bold uppercase tracking-widest opacity-50">
        The bracket
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        {bracket.rounds.map((round) => (
          <div key={round.round} className="space-y-1">
            <div className="text-center font-bold opacity-50">{round.name}</div>
            {round.matchups.map((m) => {
              const winner = m.winner === "a" ? m.a : m.winner === "b" ? m.b : null;
              return (
                <div
                  key={m.id}
                  className={`rounded-lg border px-2 py-1 ${
                    winner ? "border-ink/30 bg-ink/10" : "border-ink/10 opacity-60"
                  }`}
                >
                  <div className="truncate">{m.a ? m.a.title : "—"}</div>
                  <div className="truncate">{m.b ? m.b.title : "—"}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default AnthemBracket;
