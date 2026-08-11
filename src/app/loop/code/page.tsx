import Link from "next/link";
import CodeLookup from "./CodeLookup";

export const metadata = {
  title: "Find your event code — Loop Soul",
};

/**
 * /loop/code — "where's my code?" Public by design: it's the recovery path when
 * the confirmation email doesn't arrive, and the answer at the door when
 * someone can't find it. Entry must never depend on email delivery.
 */
export default function CodePage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 py-12">
      <h1 className="text-2xl font-extrabold">Find your event code</h1>
      <p className="loop-muted mt-2 text-sm leading-relaxed">
        Enter the email you used at checkout and we&apos;ll show the code that came
        with your pass. It&apos;s your ticket at the door and it unlocks the app on
        the night.
      </p>

      <CodeLookup />

      <Link
        href="/loop"
        className="loop-muted mt-10 text-center text-[11px] font-bold uppercase tracking-[0.3em]"
      >
        ← Back to Loop Soul
      </Link>
    </main>
  );
}
