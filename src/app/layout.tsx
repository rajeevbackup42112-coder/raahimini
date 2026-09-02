import React from 'react';
import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import '../styles/tailwind.css';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import RoleRouteGuard from '@/components/RoleRouteGuard';

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-dm-sans', display: 'swap' });
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ride.myraahi.co.in';
const publicDiscovery = process.env.NEXT_PUBLIC_PUBLIC_DISCOVERY_ENABLED === 'true';
const description = 'Explore shared local routes and outstation travel with verified local Drivers. Raahi is live and onboarding verified Driver supply area by area.';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#166534' };

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Raahi — Shared rides and outstation travel',
  description,
  applicationName: 'Raahi',
  alternates: { canonical: '/' },
  icons: {
    icon: [{ url: '/icon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/favicon.ico', type: 'image/x-icon' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.json',
  robots: publicDiscovery ? { index: true, follow: true } : { index: false, follow: false, noarchive: true, nocache: true },
  openGraph: { title: 'Raahi — Shared rides and outstation travel', description, url: '/', siteName: 'Raahi', locale: 'en_IN', type: 'website', images: [{ url: '/og-raahi.png', width: 1200, height: 630, alt: 'Raahi — shared rides and verified local outstation travel' }] },
  twitter: { card: 'summary_large_image', title: 'Raahi — Shared rides and outstation travel', description, images: ['/og-raahi.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={dmSans.variable}><body className={dmSans.className}><AuthProvider><RoleRouteGuard />{children}</AuthProvider><Toaster position="bottom-center" toastOptions={{ style: { borderRadius: '12px', fontFamily: 'var(--font-dm-sans)', fontSize: '14px' } }} /></body></html>;
}