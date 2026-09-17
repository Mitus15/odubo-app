"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import LoopLoader from "@/components/loop/brand/LoopLoader";

/**
 * Enter your pass.
 *
 * The code on the ticket is the login (owner, 2026-09-16). Type it and this
 * phone is yours: the record, the cover, the night. There is no second step.
 * Lost the email? The address you paid with gets the pass sent again, and
 * nothing is shown on screen for it, so knowing an address is worth nothing.
 */
export function PassEntry({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"enter" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [lost, setLost] = useState(false);

  async function enter(e: React.FormEvent) {
    e.preventDefault();
    setBusy("enter");
    setError(null);
    try {
      const res = await fetch("/api/loop/pass/enter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Couldn't enter (${res.status})`);
      router.push("/loop");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setBusy("send");
    setError(null);
    try {
      const res = await fetch("/api/loop/pass/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Couldn't send (${res.status})`);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const field =
    "rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] bg-transparent px-4 py-3 outline-none placeholder:opacity-50 focus:border-[var(--foreground)]";
  const primary =
    "flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[var(--foreground)] px-5 py-3 font-bold text-[var(--background)] disabled:opacity-50";

  return (
    <div className="mt-6">
      <form onSubmit={enter} className="grid gap-3">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="LOOP-XXXX"
          autoFocus
          className={`${field} text-center font-mono text-2xl tracking-[0.3em]`}
        />
        <button type="submit" disabled={busy !== null || code.trim().length < 4} className={primary}>
          {busy === "enter" ? <LoopLoader size={24} label="Entering" /> : "Enter"}
        </button>
        <p className="loop-muted text-xs leading-relaxed">It&apos;s on your ticket, under the QR.</p>
      </form>

      {error && (
        <p className="mt-4 border-t border-[color-mix(in_srgb,var(--foreground)_15%,transparent)] pt-3 text-sm font-semibold">
          {error}
        </p>
      )}

      <div className="mt-8 border-t border-[color-mix(in_srgb,var(--foreground)_15%,transparent)] pt-4">
        {!lost ? (
          <button
            type="button"
            onClick={() => setLost(true)}
            className="loop-muted min-h-[44px] text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
          >
            Lost your ticket?
          </button>
        ) : sent ? (
          <p className="text-sm leading-relaxed">
            If a pass was bought with <strong>{email.trim()}</strong>, it&apos;s on its way there again.
          </p>
        ) : (
          <form onSubmit={resend} className="grid gap-3">
            <p className="text-sm leading-relaxed">The email you paid with. We send your pass again.</p>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className={field}
            />
            <button type="submit" disabled={busy !== null || email.trim().length === 0} className={primary}>
              {busy === "send" ? <LoopLoader size={24} label="Sending" /> : "Send my pass again"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default PassEntry;
