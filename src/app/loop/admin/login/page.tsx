"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import LoopLoader from "@/components/loop/brand/LoopLoader";

/**
 * /admin/login — password gate for the marketing control surface. On success the
 * server sets the signed `ls_admin` cookie and we return to where they were
 * headed (the `?from=` set by middleware, defaulting to /admin).
 */
export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/loop/admin";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/loop/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.replace(from);
      router.refresh();
      return;
    }
    setBusy(false);
    setError(res.status === 401 ? "Incorrect password." : "Admin login isn't configured.");
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-extrabold">Loop Soul · Admin</h1>
      <p className="mt-2 text-sm opacity-70">
        Enter the team password — if none is set yet, just tap Enter.
      </p>

      <form onSubmit={submit} className="mt-8 grid gap-4">
        <label className="grid gap-2">
          <span className="text-xs font-bold uppercase tracking-widest opacity-70">Password</span>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-2xl border border-ink/15 bg-ink/5 px-4 py-3 outline-none focus:border-ink"
          />
        </label>

        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-2xl border border-ink bg-ink px-5 py-3 font-bold text-sand transition-opacity disabled:opacity-50"
        >
          {busy ? <LoopLoader size={24} label="Signing in" /> : "Enter"}
        </button>
      </form>
    </main>
  );
}
