import React from 'react';
import AppHeader from './AppHeader';
import BottomNav from './BottomNav';

interface AppLayoutProps {
  children: React.ReactNode;
  showBottomNav?: boolean;
  headerTitle?: string;
  headerBack?: boolean;
}

export default function AppLayout({
  children,
  showBottomNav = true,
  headerTitle,
  headerBack = false,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader title={headerTitle} showBack={headerBack} />
      <main className="flex-1 pb-20">
        {children}
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  );
}