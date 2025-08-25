"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function withAdmin<T>(Component: React.ComponentType<T>) {
  return function AdminComponent(props: React.PropsWithChildren<T>) {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

    useEffect(() => {
      const verify = async () => {
        try {
          const res = await fetch('/api/auth/verify-token', { method: 'POST' });
          if (!res.ok) throw new Error('Unauthenticated');
          const data = await res.json() as any;
          const payload = data.decoded;
          if (payload?.is_admin) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
            router.replace('/');
          }
        } catch {
          setIsAdmin(false);
          router.replace('/login');
        }
      };
      verify();
    }, [router]);

    if (isAdmin === null) return null; // Or a loading spinner
    if (!isAdmin) return null;
    return <Component {...props} />;
  };
}
