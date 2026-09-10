"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * "This is me" — the only rung on the ladder that costs anything.
 *
 * Attending costs nothing and requires nothing: a cookie is enough to hear the
 * single, shoot through the filter and post to the Wall. This is for the
 * person who wants what they did that night to still be theirs on a different
 * phone next year — and the price is a first name and an email, never a
 * password. Nobody types a password at a door in a dark room.
 *
 * The email is a RECOVERY KEY, not an address we send to: claiming one that
 * another attendee already owns re-points this device at them, which is how one
 * person with three phones stays one person. Nothing here promises a message
 * will arrive, because none will — there is no verified sending domain.
 */

type Me = {
  attendee: {
    id: string;
    displayName: string | null;
    email: string | null;
  } | null;
  shotsThisEvent?: number;
  holder?: boolean;
};

export function ClaimRow() {
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/loop/me", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
      .then((d) => {
        if (!d) return;
        setMe(d);
        setName(d.attendee?.displayName ?? "");
        setEmail(d.attendee?.email ?? "");
      })
      .catch(() => {
        /* the section still renders; claiming is optional by design */
      });
  }, []);

  const claim = useCallback(async () => {
    const n = name.trim();
    const e = email.trim();
    if (!n && !e) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/loop/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: n || null, email: e || null }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        attendee?: Me["attendee"];
      };
      if (!res.ok) throw new Error(data.error ?? "That didn't save.");
      setMe((prev) => ({ ...(prev ?? {}), attendee: data.attendee ?? null }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2600);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [name, email]);

  const claimed = Boolean(me?.attendee?.email);
  const shots = me?.shotsThisEvent ?? 0;

  return (
    <div>
      <h2 className="loop-display text-3xl font-bold tracking-tight">You.</h2>
      <p className="loop-muted mt-2 text-sm leading-relaxed">
        {claimed
          ? "Your name travels with your work — on every shot you take, on every phone you use."
          : "Nothing here is required. It's for keeping what you make."}
      </p>

      <ul className="loop-muted mt-6 space-y-2.5 text-[13px] leading-relaxed">
        <li className="border-t border-ink/15 pt-2.5">
          Your name on every shot you take.
        </li>
        <li className="border-t border-ink/15 pt-2.5">
          Your cover, on every phone you own.
        </li>
        <li className="border-t border-ink/15 pt-2.5">
          Your entry code, findable with this email.
        </li>
      </ul>

      {claimed && (
        <p className="mt-5 text-sm font-bold">
          {me?.attendee?.displayName ?? "You"}
          {shots > 0
            ? ` · ${shots} ${shots === 1 ? "shot" : "shots"} credited`
            : ""}
        </p>
      )}

      <div className="mt-6 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First name"
          maxLength={60}
          className="w-full rounded-full border border-ink/25 bg-transparent px-5 py-3.5 text-sm outline-none placeholder:opacity-40 focus:border-ink/60"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email you'd check out with"
          className="w-full rounded-full border border-ink/25 bg-transparent px-5 py-3.5 text-sm outline-none placeholder:opacity-40 focus:border-ink/60"
        />
        <button
          type="button"
          onClick={claim}
          disabled={busy || (!name.trim() && !email.trim())}
          className="w-full rounded-full bg-ink py-3.5 text-sm font-bold text-sand transition-transform active:scale-95 disabled:opacity-35"
        >
          {saved ? "Saved" : busy ? "…" : claimed ? "Update" : "This is me"}
        </button>
      </div>

      {error && <p className="mt-3 text-[13px] font-bold text-wine">{error}</p>}

      <p className="loop-muted mt-5 text-[11px] leading-relaxed">
        No password. The email is how you find yourself again on a new phone —
        we don&apos;t send anything to it.
      </p>
    </div>
  );
}

export default ClaimRow;
