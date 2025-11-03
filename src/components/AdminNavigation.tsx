
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const adminNavItems = [
  { label: "Dashboard", href: "/admin", icon: "📊" },
  { label: "Videos", href: "/admin/videos", icon: "🎬" },
  { label: "Music", href: "/admin/albums", icon: "🎵" },
  { label: "Featured", href: "/featured/manage", icon: "⭐" },
  { label: "Database", href: "/admin/db", icon: "🗄️" },
  { label: "Storage", href: "/admin/storage", icon: "🗂️" },
  { label: "Users", href: "/admin/users", icon: "👥" },
  { label: "Analytics", href: "/admin/analytics", icon: "📈" },
];

export default function AdminNavigation() {
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  function logout() {
    try {
      localStorage.removeItem('token');
    } catch {}
    // Best-effort redirect to login
    if (typeof window !== 'undefined') window.location.href = '/login';
  }

  return (
    <nav className="bg-gray-900 shadow-sm border-b border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="py-4 font-bold text-lg text-white">
            Admin Panel
          </Link>
          {/* Desktop nav */}
          <div className="hidden md:flex space-x-1 items-center">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-4 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-blue-400 border-b-2 border-blue-400"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
            <button
              className="ml-2 px-3 py-1.5 text-sm rounded border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800"
              onClick={logout}
              title="Log out"
            >
              Log out
            </button>
          </div>
          {/* Hamburger for mobile */}
          <button
            className="md:hidden p-2 text-gray-300 hover:text-white focus:outline-none"
            onClick={() => setOpen((v: boolean) => !v)}
            aria-label="Open navigation menu"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-gray-900 border-t border-gray-700 px-4 py-2">
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-blue-400 bg-gray-800 rounded"
                    : "text-gray-300 hover:text-white"
                }`}
                onClick={() => setOpen(false)}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          <button
            className="mt-2 w-full px-4 py-2 text-left text-sm font-medium text-gray-300 hover:text-white border border-gray-700 rounded"
            onClick={() => { setOpen(false); logout(); }}
          >
            Log out
          </button>
        </div>
      )}
    </nav>
  );
}
