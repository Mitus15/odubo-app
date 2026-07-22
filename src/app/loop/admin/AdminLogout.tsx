"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Clears the `ls_admin` session cookie and returns to the login screen. */
export function AdminLogout() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/loop/admin/login", { method: "DELETE" });
    router.replace("/loop/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="shrink-0 rounded-full border border-ink/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest opacity-70 transition-opacity hover:opacity-100 disabled:opacity-40"
    >
      {busy ? "…" : "Log out"}
    </button>
  );
}

export default AdminLogout;
