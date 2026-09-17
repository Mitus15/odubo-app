"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { doorUrlFor } from "@/lib/loop/door";
import { publicPassNumber } from "@/lib/loop/passLink";

export type HeldPass = { code: string; serial: number | null };

/**
 * The ticket, on the phone that holds it. The QR is what the door scans; the
 * number is the name of the ticket; the code is what to type on another phone.
 * Same picture as the email, for the guest who cannot find the email.
 */
export function YourTicket({ passes }: { passes: HeldPass[] }) {
  const [qr, setQr] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    Promise.all(
      passes.map(
        async (p) =>
          [
            p.code,
            await QRCode.toDataURL(doorUrlFor(p.code, window.location.origin), {
              margin: 1,
              width: 280,
              color: { dark: "#2a0f0a", light: "#00000000" },
            }),
          ] as const,
      ),
    )
      .then((pairs) => alive && setQr(Object.fromEntries(pairs)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [passes]);

  return (
    <div className="grid gap-6">
      {passes.map((p, i) => {
        const number = publicPassNumber(p.serial);
        return (
          <div key={p.code} className={i > 0 ? "border-t border-ink/15 pt-6" : ""}>
            {passes.length > 1 && (
              <p className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">
                Guest {i + 1} of {passes.length}
              </p>
            )}
            {qr[p.code] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr[p.code]} alt={`Ticket QR for ${p.code}`} width={220} height={220} className="mt-2 rounded-xl bg-white/70 p-2" />
            )}
            {number && <p className="mt-3 text-3xl font-extrabold tracking-tight">{number}</p>}
            <p className="font-mono text-base font-bold tracking-widest opacity-70">{p.code}</p>
            <p className="loop-muted mt-2 text-xs">Show this at the door.</p>
          </div>
        );
      })}
    </div>
  );
}

export default YourTicket;
