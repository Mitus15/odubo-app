"use client";

import { useEffect, useState } from "react";
import GetPassModal from "./GetPassModal";

type Capacity = { total: number; sold: number; remaining: number };

/**
 * The scarcity counter — [ X / 75 Passes Remaining ]. Polls the capacity
 * endpoint (mock Eventbrite now, live later) so the number stays fresh during
 * a promo without a websocket.
 */
export function ScarcityCounter({ initial }: { initial: Capacity }) {
  const [cap, setCap] = useState<Capacity>(initial);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/loop/capacity", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Capacity;
        if (alive) setCap(data);
      } catch {
        /* keep last known value on failure */
      }
    };
    const id = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const soldOut = cap.remaining <= 0;

  return (
    <div className="flex flex-col items-center">
      <div className="font-sans text-7xl font-extrabold leading-none tabular-nums">
        {cap.remaining}
        <span className="text-3xl font-bold opacity-60"> / {cap.total}</span>
      </div>
      <div className="mt-2 text-sm font-semibold uppercase tracking-widest opacity-70">
        {soldOut ? "Room is full" : "Passes Remaining"}
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={soldOut}
        className="mt-6 rounded-full bg-ink px-10 py-4 text-base font-bold text-electric transition-transform active:scale-95 disabled:opacity-50"
      >
        {soldOut ? "Join the Waitlist" : "Get Pass"}
      </button>

      {open && <GetPassModal capacity={cap} onClose={() => setOpen(false)} />}
    </div>
  );
}

export default ScarcityCounter;
