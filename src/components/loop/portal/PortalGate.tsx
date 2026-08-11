"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import LoopLoader from "@/components/loop/brand/LoopLoader";

/**
 * The event-code gate. A ticket-holder redeems their code to unlock the
 * attendee-only surfaces — the Portal in State 2, the Vault in Legacy. On
 * success we refresh the route — the server re-renders unlocked because
 * `isHolder` is now true for this `ls_voter`. Reuses the existing
 * /api/anthem/redeem endpoint (which binds the code to the voter and marks
 * them a holder). `tone="vault"` restyles for the dark Legacy field.
 */
export function PortalGate({
  title = "Enter your event code",
  copy = "Your pass code unlocks the galleries, Pose Studio, the queue, and the live program.",
  cta = "Unlock the Portal",
  tone = "poster",
}: {
  title?: string;
  copy?: string;
  cta?: string;
  tone?: "poster" | "vault";
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/loop/anthem/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    if (res.ok) {
      router.refresh(); // server re-renders → unlocked Portal
      return;
    }
    setBusy(false);
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(
      res.status === 409
        ? "That code has already been used."
        : body.error === "unknown code" || res.status === 404
          ? "We don’t recognize that code. Check it and try again."
          : "Something went wrong. Try again.",
    );
  }

  const vault = tone === "vault";
  return (
    <div
      className={`mt-12 w-full max-w-md rounded-2xl border px-5 py-6 text-left ${
        vault ? "border-sand/25 bg-sand/5" : "border-ink/15 bg-ink/5"
      }`}
    >
      <div className="font-bold">{title}</div>
      <div className="mt-1 text-sm opacity-70">{copy}</div>

      <form onSubmit={submit} className="mt-5 grid gap-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="e.g. LOOP-XXXX"
          className={`rounded-2xl border px-4 py-3 font-mono uppercase tracking-widest outline-none ${
            vault
              ? "border-sand/30 bg-ink-soft text-bone focus:border-sand"
              : "border-ink/15 bg-bone focus:border-ink"
          }`}
        />
        {error ? (
          <p className={`text-sm font-semibold ${vault ? "text-sand-bright" : "text-red-600"}`}>
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy || code.trim().length === 0}
          className={`flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 font-bold transition-opacity disabled:opacity-50 ${
            vault ? "border-sand bg-sand text-ink" : "border-ink bg-ink text-sand"
          }`}
        >
          {busy ? <LoopLoader size={24} label="Unlocking" /> : cta}
        </button>
      </form>

      {/* Email delivery can't be trusted yet, so the recovery path is always
          one tap away — at the door as much as at home. */}
      <a
        href="/loop/code"
        className="loop-muted mt-4 block text-center text-[11px] font-bold uppercase tracking-[0.2em] underline underline-offset-4"
      >
        Didn&apos;t get your code?
      </a>
    </div>
  );
}

export default PortalGate;
