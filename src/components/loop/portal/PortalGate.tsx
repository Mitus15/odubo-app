"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import LoopLoader from "@/components/loop/brand/LoopLoader";

/**
 * The Portal (State 2) entry gate. A ticket-holder redeems their event code to
 * unlock the in-room experience. On success we refresh the route — the server
 * re-renders the unlocked Portal because `isHolder` is now true for this
 * `ls_voter`. Reuses the existing /api/anthem/redeem endpoint (which binds the
 * code to the voter and marks them a holder).
 */
export function PortalGate() {
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

  return (
    <div className="mt-12 w-full max-w-md rounded-2xl border border-ink/15 bg-ink/5 px-5 py-6 text-left">
      <div className="font-bold">Enter your event code</div>
      <div className="mt-1 text-sm opacity-70">
        Your pass code unlocks the galleries, Pose Studio, the queue, and the live
        program.
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="e.g. LOOP-XXXX"
          className="rounded-2xl border border-ink/15 bg-bone px-4 py-3 font-mono uppercase tracking-widest outline-none focus:border-ink"
        />
        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || code.trim().length === 0}
          className="flex items-center justify-center gap-2 rounded-2xl border border-ink bg-ink px-5 py-3 font-bold text-electric transition-opacity disabled:opacity-50"
        >
          {busy ? <LoopLoader size={24} label="Unlocking" /> : "Unlock the Portal"}
        </button>
      </form>
    </div>
  );
}

export default PortalGate;
