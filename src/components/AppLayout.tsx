import React from 'react';
import Link from 'next/link';
import AppHeader from './AppHeader';
import BottomNav from './BottomNav';

interface AppLayoutProps {
  children: React.ReactNode;
  showBottomNav?: boolean;
  headerTitle?: string;
  headerBack?: boolean;
}

export default function AppLayout({ children, showBottomNav = true, headerTitle, headerBack = false }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader title={headerTitle} showBack={headerBack} />
      <main className="flex-1 pb-20 sm:pb-0">{children}</main>
      <footer className="hidden border-t border-border bg-card/80 sm:block">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4 px-6 py-4 text-xs text-muted-foreground">
          <p>Raahi stays free for passengers and drivers.</p>
          <div className="flex items-center gap-3"><Link href="/offers" className="font-semibold text-primary hover:underline">Local Offers</Link><span>·</span><Link href="/terms" className="font-semibold text-primary hover:underline">Terms</Link><span>·</span><Link href="/privacy" className="font-semibold text-primary hover:underline">Privacy</Link><span>·</span><Link href="/contact" className="font-semibold text-primary hover:underline">Contact Raahi · Suggest an idea · Promote your business</Link></div>
        </div>
      </footer>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
