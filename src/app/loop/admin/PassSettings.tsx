"use client";

import { useCallback, useEffect, useState } from "react";

type Settings = {
  checkoutUrl: string | null;
  sku: string | null;
  productId: string | null;
  mode: "mock" | "shopify";
};
type Capacity = { total: number; sold: number; remaining: number };

/**
 * Pass sales — sell tickets through Shopify without touching env vars.
 * The two Shopify-side steps (product + webhook) are listed right here; the
 * rest goes live the moment the fields are saved.
 */
export function PassSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [sku, setSku] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/loop/admin/pass-settings", { cache: "no-store" });
      if (!res.ok) throw new Error(`Couldn't load pass settings (${res.status})`);
      const data = await res.json();
      setSettings(data.settings);
      setCapacity(data.capacity);
      setCheckoutUrl(data.settings.checkoutUrl ?? "");
      setSku(data.settings.sku ?? "");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(extra?: { mode?: "mock" | "shopify" }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/loop/admin/pass-settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          checkoutUrl: checkoutUrl.trim() || null,
          sku: sku.trim() || null,
          ...extra,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
      setSettings(data.settings);
      setCapacity(data.capacity);
      flash("Saved");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const live = settings?.mode === "shopify";
  const ready = Boolean((checkoutUrl.trim() || settings?.checkoutUrl) && (sku.trim() || settings?.sku));

  return (
    <div className="mt-4">
      {capacity && (
        <div className="rounded-2xl border border-ink/15 bg-ink/5 px-5 py-3 text-sm">
          <b className="tabular-nums">{capacity.sold}</b> sold ·{" "}
          <b className="tabular-nums">{capacity.remaining}</b> of{" "}
          <b className="tabular-nums">{capacity.total}</b> left
          <span className="ml-2 rounded-full border border-ink/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
            {live ? "Shopify · live" : "mock counter"}
          </span>
        </div>
      )}

      <ol className="mt-3 list-decimal space-y-1 rounded-2xl border border-ink/15 bg-ink/5 px-5 py-4 pl-9 text-sm opacity-80">
        <li>
          In Shopify: create the pass product — SKU <b className="font-mono">LOOP-PASS-VOL1</b>,
          inventory 75, your price.
        </li>
        <li>
          Shopify → Settings → Notifications → Webhooks: topic <b>Order payment</b>, JSON, URL{" "}
          <b className="break-all font-mono text-xs">
            {typeof window !== "undefined" ? window.location.origin : ""}/api/loop/pass/webhook
          </b>
        </li>
        <li>Paste the product&apos;s checkout link + SKU below, save, then go live.</li>
      </ol>

      <div className="mt-3 grid gap-2">
        <input
          type="url"
          value={checkoutUrl}
          onChange={(e) => setCheckoutUrl(e.target.value)}
          placeholder="Checkout link (https://…)"
          className="rounded-2xl border border-ink/20 bg-transparent px-4 py-3 text-sm outline-none focus:border-ink"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Pass SKU (e.g. LOOP-PASS-VOL1)"
            className="min-w-0 flex-1 rounded-2xl border border-ink/20 bg-transparent px-4 py-3 font-mono text-sm outline-none focus:border-ink"
          />
          <button
            type="button"
            onClick={() => save()}
            disabled={busy}
            className="shrink-0 rounded-full border border-ink/25 px-5 py-3 text-sm font-bold active:scale-95 disabled:opacity-50"
          >
            Save
          </button>
        </div>
        <button
          type="button"
          onClick={() => save({ mode: live ? "mock" : "shopify" })}
          disabled={busy || (!live && !ready)}
          className={`rounded-full py-3 text-sm font-bold transition-transform active:scale-95 disabled:opacity-40 ${
            live ? "border border-ink/25" : "bg-ink text-sand"
          }`}
        >
          {live ? "Pause sales (back to mock counter)" : "Go live — sell passes"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-2xl border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {toast && (
        <div className="pointer-events-none fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-ink px-5 py-2 text-sm font-bold text-sand shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default PassSettings;
