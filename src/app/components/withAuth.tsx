"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AuthProps {
  user?: { 
    userId: string; 
    email: string; 
    is_admin: boolean; 
    firstName?: string; 
    lastName?: string; 
  };
}

// Helper function to decode JWT payload without verification
function decodeJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
}

export default function withAuth<T extends AuthProps>(Component: React.ComponentType<T>, adminOnly: boolean = false) {
  return function AuthenticatedComponent(props: React.PropsWithChildren<T>) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<AuthProps['user'] | null>(null);

    useEffect(() => {
      const verify = async () => {
        try {
          const res = await fetch('/api/auth/verify-token', { method: 'POST' });
          if (!res.ok) throw new Error('Unauthenticated');
          const data = await res.json() as any;
          const decoded = data.decoded;
          const user = decoded as AuthProps['user'];
          if (adminOnly && !user?.is_admin) {
            router.replace("/");
            return;
          }
          setCurrentUser(user);
        } catch (e) {
          router.replace('/login');
          return;
        } finally {
          setLoading(false);
        }
      };
      verify();
    }, [router, adminOnly]);

    if (loading) {
      return <div className="h-screen w-screen flex items-center justify-center bg-black text-white">Loading authentication...</div>;
    }

    if (!currentUser && !loading) {
      return null; // Should have been redirected by now
    }

    return <Component {...props} user={currentUser} />;
  };
}
