"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import LoopLoader from "@/components/loop/brand/LoopLoader";

type Found = { code: string; redeemed: boolean };

/**
 * Find your code, in two steps that prove the inbox.
 *
 *   1. The checkout email. A six-digit code goes to it.
 *   2. The six digits. This phone becomes yours: every pass bought with that
 *      address opens here, and the code is shown for the door, as text and as
 *      a QR the host can scan.
 *
 * Nothing is shown before step two. The email is the proof, because the pass
 * was sent there, and that is the whole reason a stranger who knows your
 * address cannot take your night.
 */
export function CodeLookup() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp" | "done">("email");
  const [codes, setCodes] = useState<Found[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [qr, setQr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (step !== "done") return;
    let alive = true;
    Promise.all(
      codes.map(async (c) => [c.code, await QRCode.toDataURL(c.code, { margin: 1, width: 240, color: { dark: "#2a0f0a", light: "#00000000" } })] as const),
    )
      .then((pairs) => alive && setQr(Object.fromEntries(pairs)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [step, codes]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/loop/pass/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Couldn't send (${res.status})`);
      setStep("otp");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/loop/pass/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code: otp }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; codes?: Found[]; outcome?: string };
      if (!res.ok) {
        if (data.outcome === "burned" || data.outcome === "expired" || data.outcome === "none") {
          setStep("email");
          setOtp("");
        }
        throw new Error(data.error ?? `Couldn't verify (${res.status})`);
      }
      setCodes(data.codes ?? []);
      setStep("done");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
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

  const field =
    "rounded-2xl border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] bg-transparent px-4 py-3 outline-none placeholder:opacity-50 focus:border-[var(--foreground)]";
  const primary =
    "flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[var(--foreground)] px-5 py-3 font-bold text-[var(--background)] disabled:opacity-50";

  return (
    <div className="mt-6">
      {step === "email" && (
        <form onSubmit={sendCode} className="grid gap-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className={field}
          />
          <button type="submit" disabled={busy || email.trim().length === 0} className={primary}>
            {busy ? <LoopLoader size={24} label="Sending" /> : "Send me a code"}
          </button>
          <p className="loop-muted text-xs leading-relaxed">
            If a pass was bought with this address, six digits are on their way to it.
          </p>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={verify} className="grid gap-3">
          <p className="text-sm leading-relaxed">
            Check <strong>{email.trim()}</strong>. Type the six digits here and this phone is yours.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            autoFocus
            className={`${field} text-center font-mono text-2xl tracking-[0.4em]`}
          />
          <button type="submit" disabled={busy || otp.length !== 6} className={primary}>
            {busy ? <LoopLoader size={24} label="Checking" /> : "That's me"}
          </button>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => { setStep("email"); setOtp(""); setError(null); }} className="loop-muted min-h-[44px] underline underline-offset-4">
              Different email
            </button>
            <button type="button" onClick={(e) => void sendCode(e as unknown as React.FormEvent)} disabled={busy} className="loop-muted min-h-[44px] underline underline-offset-4">
              Send it again
            </button>
          </div>
          <p className="loop-muted text-xs leading-relaxed">
            Nothing arrived? Check spam, or the address your receipt went to. Still stuck? Ask at the door.
          </p>
        </form>
      )}

      {error && <p className="loop-panel mt-4 rounded-2xl px-4 py-3 text-sm">{error}</p>}

      {step === "done" && codes.length === 0 && (
        <div className="loop-panel mt-4 rounded-2xl px-5 py-4 text-sm leading-relaxed">
          <strong className="block">That address is yours, but no pass is under it.</strong>
          <span className="loop-muted">Try the address your payment receipt went to, or ask at the door.</span>
        </div>
      )}

      {step === "done" && codes.length > 0 && (
        <div className="mt-2 grid gap-3">
          <div className="loop-panel rounded-2xl px-5 py-4 text-sm leading-relaxed">
            <strong className="block">This phone is yours now.</strong>
            <span className="loop-muted">
              Your pass opens the room here. It still works on any other phone you prove the same way.
            </span>
          </div>
          <p className="loop-muted text-[11px] font-bold uppercase tracking-[0.25em]">
            {codes.length === 1 ? "Your code" : `Your ${codes.length} codes`}
          </p>
          {codes.map((c) => (
            <div key={c.code} className="loop-panel rounded-2xl px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xl font-bold tracking-widest">{c.code}</span>
                <button
                  type="button"
                  onClick={() => copy(c.code)}
                  className="min-h-[44px] rounded-full border border-[color-mix(in_srgb,var(--foreground)_25%,transparent)] px-3 text-xs font-bold"
                >
                  {copied === c.code ? "Copied" : "Copy"}
                </button>
              </div>
              {qr[c.code] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr[c.code]} alt={`QR for ${c.code}`} width={160} height={160} className="mt-3 rounded-xl bg-[var(--background)] p-2" />
              )}
              <p className="loop-muted mt-2 text-xs">Show this at the door. Screenshot it to keep it.</p>
            </div>
          ))}
          <button type="button" onClick={() => { router.push("/loop"); router.refresh(); }} className={`${primary} mt-2`}>
            Into the room
          </button>
          <a href="/loop/album" className="loop-muted mt-1 min-h-[44px] text-center text-xs underline underline-offset-4">
            The record, when it lands →
          </a>
        </div>
      )}
    </div>
  );
}

export default CodeLookup;
