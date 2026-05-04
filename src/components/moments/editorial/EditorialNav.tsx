"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function EditorialNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: "linear-gradient(to bottom, var(--editorial-bg) 60%, transparent)",
        backdropFilter: "blur(0px)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/moments" className="flex items-center gap-3 group">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:scale-105"
              style={{ background: "var(--editorial-text)" }}
            >
              <svg
                className="w-4 h-4"
                style={{ color: "var(--editorial-bg)" }}
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
              </svg>
            </div>
            <span
              className="text-sm font-semibold tracking-[0.2em] uppercase"
              style={{ color: "var(--editorial-text)" }}
            >
              Moments
            </span>
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/moments/profile"
              className={`
                p-2 rounded-full transition-colors
                ${pathname === "/moments/profile"
                  ? "bg-[var(--editorial-surface)] text-[var(--editorial-text)]"
                  : "text-[var(--editorial-text-secondary)] hover:text-[var(--editorial-text)] hover:bg-[var(--editorial-surface)]"
                }
              `}
              aria-label="Profile"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
