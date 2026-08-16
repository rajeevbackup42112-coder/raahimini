'use client';
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, User, MapPin } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
}

export default function AppHeader({ title, showBack = false }: AppHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border card-shadow">
      <div className="flex items-center gap-3 px-4 h-14 max-w-screen-2xl mx-auto">
        {showBack ? (
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-muted transition-colors duration-150 active:scale-95 flex-shrink-0"
            aria-label="Go back"
          >
            <ChevronLeft size={22} className="text-foreground" />
          </button>
        ) : (
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <AppLogo size={32} />
            <span className="font-bold text-lg text-foreground tracking-tight hidden sm:block">
              Raahi Mini
            </span>
          </Link>
        )}

        {title && (
          <h1 className="flex-1 text-base font-semibold text-foreground truncate">
            {title}
          </h1>
        )}

        {!title && (
          <div className="flex-1" />
        )}

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 bg-secondary text-secondary-foreground rounded-xl px-3 py-1.5 text-sm font-medium hover:bg-orange-100 transition-colors duration-150"
          >
            <MapPin size={14} />
            <span className="max-w-[80px] truncate">Gomoh</span>
          </Link>
          <button
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted hover:bg-border transition-colors duration-150 active:scale-95"
            aria-label="Account"
          >
            <User size={18} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    </header>
  );
}