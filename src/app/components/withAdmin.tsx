"use client";
import { useEffect, useState } from "react";

export default function withAdmin<T>(Component: React.ComponentType<T>) {
  return function AdminComponent(props: React.PropsWithChildren<T>) {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

    useEffect(() => {
      // Trust middleware/proxy to guard admin routes.
      // Client-side: simply check for presence of a token cookie/localStorage and render.
      try {
        const hasCookieToken = typeof document !== 'undefined' && document.cookie.includes('token=');
        const hasLocalToken = typeof window !== 'undefined' && !!localStorage.getItem('token');
        setIsAdmin(hasCookieToken || hasLocalToken ? true : false);
      } catch {
        setIsAdmin(false);
      }
    }, []);

    if (isAdmin === null) return null;
    if (!isAdmin) return null;
    return <Component {...props} />;
  };
}
