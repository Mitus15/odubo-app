"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * "Simulate a ticket purchase": mints a `sim:` pass and sends the pass email
 * to the address given (or a test address), so the buy → email → claim path
 * can be walked without spending money. The admin copy told the owner to
 * press this button for two days before it existed.
 */
export function SimulatePurchase() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function simulate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/loop/admin/simulate-purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(email.trim() ? { email: email.trim() } : {}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        code?: string;
        email?: string;
        delivered?: boolean;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      setResult(
        `${data.code} minted for ${data.email}. ${data.delivered ? "Pass email sent." : "The email did not send."}`,
      );
      router.refresh();
    } catch (err) {
      setResult((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={simulate} className="mt-4 grid gap-2">
      <div className="flex gap-2">
        <input
          type="email"
          inputMode="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Send the pass to (optional)"
          className="min-h-[44px] flex-1 rounded-full border border-ink/20 bg-transparent px-4 text-sm outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-[44px] rounded-full bg-ink px-4 text-xs font-bold text-sand disabled:opacity-50"
        >
          {busy ? "Minting…" : "Simulate a ticket purchase"}
        </button>
      </div>
      {result && <p className="text-xs opacity-80">{result}</p>}
      <p className="text-[11px] opacity-60">
        Mints a test pass (never counted as a sale) and sends the real pass email. Delete it from the codes
        list when you are done, or leave it: sim passes never count.
      </p>
    </form>
  );
}

export default SimulatePurchase;
