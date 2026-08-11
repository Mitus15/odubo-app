"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import LoopLoader from "@/components/loop/brand/LoopLoader";

type Found = { code: string; redeemed: boolean };

/**
 * Look up the codes bought with an email address, then let the buyer use one
 * right here — redeeming binds it to this browser, which is exactly what the
 * Portal checks. No email round-trip anywhere in the flow.
 */
export function CodeLookup() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [codes, setCodes] = useState<Found[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCodes(null);
    try {
      const res = await fetch("/api/loop/pass/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Lookup failed (${res.status})`);
      setCodes(data.codes ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function useCode(code: string) {
    setRedeeming(code);
    setError(null);
    try {
      const res = await fetch("/api/loop/anthem/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        router.push("/loop");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(
        res.status === 409
          ? "That code is already in use on another device."
          : (body.error ?? "Couldn't use that code — try again."),
      );
    } finally {
      setRedeeming(null);
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      /* long-press to copy */
    }
  }

  return (
    <div className="mt-6">
      <form onSubmit={submit} className="grid gap-3">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] bg-transparent px-4 py-3 outline-none placeholder:opacity-50 focus:border-[var(--foreground)]"
        />
        <button
          type="submit"
          disabled={busy || email.trim().length === 0}
          className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--foreground)] px-5 py-3 font-bold text-[var(--background)] disabled:opacity-50"
        >
          {busy ? <LoopLoader size={24} label="Looking" /> : "Find my code"}
        </button>
      </form>

      {error && (
        <p className="loop-panel mt-4 rounded-2xl px-4 py-3 text-sm">{error}</p>
      )}

      {codes && codes.length === 0 && (
        <div className="loop-panel mt-4 rounded-2xl px-5 py-4 text-sm leading-relaxed">
          <strong className="block">No pass found for that email.</strong>
          <span className="loop-muted">
            Check for a typo, or try the address your payment receipt went to. Still
            stuck? Ask at the door — we can look you up.
          </span>
        </div>
      )}

      {codes && codes.length > 0 && (
        <div className="mt-5 grid gap-2">
          <p className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">
            {codes.length === 1 ? "Your code" : `Your ${codes.length} codes`}
          </p>
          {codes.map((c) => (
            <div key={c.code} className="loop-panel rounded-2xl px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xl font-bold tracking-widest">
                  {c.code}
                </span>
                <button
                  type="button"
                  onClick={() => copy(c.code)}
                  className="rounded-full border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] px-3 py-1.5 text-xs font-bold"
                >
                  {copied === c.code ? "Copied" : "Copy"}
                </button>
              </div>
              {c.redeemed ? (
                <p className="loop-muted mt-2 text-xs">
                  Already in use — if that wasn&apos;t you, ask at the door.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => useCode(c.code)}
                  disabled={redeeming !== null}
                  className="mt-3 w-full rounded-full bg-[var(--foreground)] py-3 text-sm font-bold text-[var(--background)] disabled:opacity-50"
                >
                  {redeeming === c.code ? "Unlocking…" : "Use it on this phone"}
                </button>
              )}
            </div>
          ))}
          <p className="loop-muted mt-1 text-xs leading-relaxed">
            Screenshot this, or keep this page handy — one code admits one guest.
          </p>
        </div>
      )}
    </div>
  );
}

export default CodeLookup;
