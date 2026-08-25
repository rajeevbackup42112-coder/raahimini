import React from 'react';
import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import '../styles/tailwind.css';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import RoleRouteGuard from '@/components/RoleRouteGuard';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#E8650A',
};

export const metadata: Metadata = {
  title: 'Raahi Mini — Shared Seats',
  description: 'Discover and request shared car seats on Raahi routes — no advance payment, pay the driver directly.',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className={dmSans.className}>
        <AuthProvider>
          <RoleRouteGuard />
          {children}
        </AuthProvider>
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              borderRadius: '12px',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: '14px',
            },
          }}
        />

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fraahimini6162back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.20" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.2" /></body>
    </html>
  );
}
