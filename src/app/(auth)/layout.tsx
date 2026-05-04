import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In - Cool Wrld',
  description: 'Sign in to your Cool Wrld account',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#843c2d',
          colorBackground: '#0d0c0b',
          colorInputBackground: '#1a1918',
          colorInputText: '#ede8df',
          colorText: '#ede8df',
          colorTextSecondary: '#b2a491',
          borderRadius: '8px',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
