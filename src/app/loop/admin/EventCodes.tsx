"use client";

import { useCallback, useEffect, useState } from "react";
import { publicPassNumber } from "@/lib/loop/passLink";

type CodeRow = { code: string; serial: number | null; redeemed: boolean; email: string | null; orderId: string | null };
type Stats = { total: number; redeemed: number };
type Intent = { token: string; email: string; createdAt: string; orderId: string | null };

/**
 * Event codes — generate & issue. Bulk-mint comp codes for the door, watch
 * redemptions tick up, copy the unused batch out to wherever tickets are
 * delivered. Sold passes arrive here from the webhook with a ticket number
 * (OS-######), which is what a guest reads out at the door.
 */
export function EventCodes() {
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, redeemed: 0 });
  const [intents, setIntents] = useState<Intent[]>([]);
  const [count, setCount] = useState("25");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The door's search. A buyer who mistyped their address gets no email and
  // cannot use /loop/code either, because that keys on the same wrong address.
  // Matching on a fragment finds them from a near-miss.
  const [q, setQ] = useState("");
  // Addresses being typed for passes that arrived without one, keyed by code.
  const [attach, setAttach] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/loop/admin/codes", { cache: "no-store" });
      if (!res.ok) throw new Error(`Couldn't load codes (${res.status})`);
      const data = (await res.json()) as { codes?: CodeRow[]; stats?: Stats; intents?: Intent[] };
      setCodes(data.codes ?? []);
      setStats(data.stats ?? { total: 0, redeemed: 0 });
      setIntents(data.intents ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    const n = Math.min(Math.max(parseInt(count, 10) || 0, 1), 100);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/loop/admin/codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count: n }),
      });
      if (!res.ok) throw new Error(`Generation failed (${res.status})`);
      await load();
      flash(`${n} codes minted`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // A paid pass with no address: Shopify sent the order without the buyer's
  // email (Protected Customer Data not granted to the app). The host reads it
  // off the order in Shopify and types it here; the pass email, the ticket QR
  // and the pre-order all happen on this tap.
  async function attachAndSend(code: string) {
    const email = (attach[code] ?? "").trim();
    if (!email) return;
    setSending(code);
    setError(null);
    try {
      const res = await fetch("/api/loop/admin/codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "attach", code, email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; delivered?: boolean };
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      flash(data.delivered ? `Pass sent to ${email}` : `Attached to ${email}, but the email did not send`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(null);
    }
  }

  async function resend(code: string) {
    setSending(code);
    setError(null);
    try {
      const res = await fetch("/api/loop/admin/codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "resend", code }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; delivered?: boolean; email?: string };
      if (!res.ok) throw new Error(data.error ?? `Failed (${res.status})`);
      flash(data.delivered ? `Pass sent again to ${data.email}` : "The email did not send");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(null);
    }
  }

  async function copyUnused() {
    const unused = codes.filter((c) => !c.redeemed).map((c) => c.code);
    try {
      await navigator.clipboard.writeText(unused.join("\n"));
      flash(`${unused.length} unused codes copied`);
    } catch {
      setError("Couldn't reach the clipboard — long-press a code to copy it.");
    }
  }

  // Matching on a fragment of the address OR the code: at the door somebody
  // says "it was something at gmail" and that has to be enough to find them.
  const needle = q.trim().toLowerCase();
  const number = (c: CodeRow) => (c.serial ? publicPassNumber(c.serial) : null);
  const matched = needle
    ? codes.filter(
        (c) =>
          (c.email ?? "").toLowerCase().includes(needle) ||
          c.code.toLowerCase().includes(needle) ||
          (number(c) ?? "").toLowerCase().includes(needle) ||
          (c.orderId ?? "").toLowerCase().includes(needle),
      )
    : codes;
  const visible = needle ? matched : showAll ? codes : codes.slice(0, 24);
  // Real money, no address. These are the ones that hurt.
  const needsAddress = codes.filter((c) => c.orderId && !c.orderId.startsWith("sim:") && !c.email);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className="w-24 rounded-full border border-ink/20 bg-transparent px-4 py-3 text-center font-mono text-sm outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="flex-1 rounded-full bg-ink py-3 text-sm font-bold text-sand transition-transform active:scale-95 disabled:opacity-50"
        >
          {busy ? "Minting…" : "Generate codes"}
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-2xl border border-ink/15 bg-ink/5 px-5 py-3 text-sm">
        <span>
          <b className="tabular-nums">{stats.redeemed}</b> redeemed ·{" "}
          <b className="tabular-nums">{stats.total}</b> issued
        </span>
        {codes.some((c) => !c.redeemed) && (
          <button
            type="button"
            onClick={copyUnused}
            className="rounded-full border border-ink/25 px-3 py-1.5 text-xs font-bold active:scale-95"
          >
            Copy unused
          </button>
        )}
      </div>

      {needsAddress.length > 0 && (
        <div className="mt-3 rounded-2xl border border-red-700/40 bg-red-700/5 px-4 py-3 text-sm">
          <p className="font-bold text-red-800">
            {needsAddress.length} paid {needsAddress.length === 1 ? "pass has" : "passes have"} no address.
          </p>
          <p className="mt-1 text-xs opacity-80">
            Shopify Basic does not let this app read a buyer&apos;s email, so nothing could be sent and they
            cannot find their pass at /loop/code. Buyers who use the pass sheet now type their address before
            checkout and are handled automatically; these are the ones who did not, or who bought before that
            existed. Attach an address and the pass, the QR ticket and the pre-order all go out.
          </p>
          <div className="mt-3 grid gap-2">
            {needsAddress.map((c) => (
              <form
                key={c.code}
                onSubmit={(e) => {
                  e.preventDefault();
                  void attachAndSend(c.code);
                }}
                className="grid gap-1.5"
              >
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-mono font-bold">{c.code}</span>
                  <span className="truncate opacity-60">{c.orderId}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    value={attach[c.code] ?? ""}
                    onChange={(e) => setAttach((m) => ({ ...m, [c.code]: e.target.value }))}
                    placeholder="the email on the Shopify order"
                    className="min-h-[44px] flex-1 rounded-full border border-ink/20 bg-transparent px-4 text-sm outline-none focus:border-ink"
                  />
                  <button
                    type="submit"
                    disabled={sending !== null || !(attach[c.code] ?? "").trim()}
                    className="min-h-[44px] rounded-full bg-ink px-4 text-xs font-bold text-sand disabled:opacity-40"
                  >
                    {sending === c.code ? "Sending…" : "Attach & send pass"}
                  </button>
                </div>
                {/* Addresses typed on the pass sheet that no order claimed.
                    The one typed just before this order is almost certainly
                    the buyer, so it is one tap rather than a hunt in Shopify. */}
                {intents.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Typed on the pass sheet</span>
                    {intents.slice(0, 4).map((i) => (
                      <button
                        key={i.token}
                        type="button"
                        onClick={() => setAttach((m) => ({ ...m, [c.code]: i.email }))}
                        className="rounded-full border border-ink/25 px-2.5 py-1 text-[11px] font-bold"
                        title={new Date(i.createdAt).toLocaleString("en-CA", { timeZone: "America/Vancouver" })}
                      >
                        {i.email}
                      </button>
                    ))}
                  </div>
                )}
              </form>
            ))}
          </div>
        </div>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find by email, code, ticket number or order"
        className="mt-3 w-full rounded-full border border-ink/20 bg-transparent px-5 py-3 text-sm outline-none placeholder:opacity-40 focus:border-ink"
      />
      {needle && (
        <p className="loop-muted mt-2 text-center text-xs">
          {matched.length === 0
            ? "Nothing matches. They may have paid under a different address, or the order never reached us."
            : `${matched.length} ${matched.length === 1 ? "match" : "matches"}`}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-2xl border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-center text-sm opacity-60">Loading…</p>
      ) : codes.length > 0 ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {visible.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(c.code);
                    flash(`${c.code} copied`);
                  } catch {
                    /* long-press fallback */
                  }
                }}
                className={`rounded-xl border px-2 py-2 font-mono text-xs tracking-wider ${
                  c.redeemed
                    ? "border-ink/10 opacity-40 line-through"
                    : "border-ink/20 active:scale-95"
                }`}
                title={c.email ?? undefined}
              >
                {c.code}
                {number(c) && (
                  <span className="loop-muted mt-0.5 block text-[9px] font-bold tracking-widest">{number(c)}</span>
                )}
                {needle && c.email && (
                  <span className="loop-muted mt-0.5 block truncate text-[9px] font-normal normal-case tracking-normal">
                    {c.email}
                  </span>
                )}
              </button>
            ))}
          </div>
          {/* A search that lands on a pass with an address can send it again. */}
          {needle && matched.length > 0 && matched.length <= 6 && (
            <div className="mt-2 grid gap-1.5">
              {matched
                .filter((c) => c.email)
                .map((c) => (
                  <button
                    key={`resend-${c.code}`}
                    type="button"
                    onClick={() => resend(c.code)}
                    disabled={sending !== null}
                    className="min-h-[40px] rounded-full border border-ink/25 px-4 text-xs font-bold disabled:opacity-40"
                  >
                    {sending === c.code ? "Sending…" : `Resend the pass for ${c.code} to ${c.email}`}
                  </button>
                ))}
            </div>
          )}
          {codes.length > visible.length && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-2 w-full rounded-full py-2 text-xs font-bold uppercase tracking-widest opacity-60"
            >
              Show all {codes.length}
            </button>
          )}
        </>
      ) : null}

      {toast && (
        <div className="pointer-events-none fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-5 py-2 text-sm font-bold text-sand shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default EventCodes;
