'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, User, MapPin, LogOut, ShieldCheck } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
}

export default function AppHeader({ title, showBack = false }: AppHeaderProps) {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [locationName, setLocationName] = useState('Location');
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('raahi_last_location_name');
    if (saved) setLocationName(saved);
  }, []);

  const handleSignOut = async () => {
    setShowUserMenu(false);
    try {
      await signOut();
      router.push('/');
    } catch {}
  };

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

        {!title && <div className="flex-1" />}

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 bg-secondary text-secondary-foreground rounded-xl px-3 py-1.5 text-sm font-medium hover:bg-orange-100 transition-colors duration-150"
          >
            <MapPin size={14} />
            <span className="max-w-[80px] truncate">{locationName}</span>
          </Link>

          {/* Driver shortcut for driver role */}
          {profile?.role === 'driver' && (
            <Link
              href="/driver-active-car-screen"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors duration-150 active:scale-95"
              aria-label="Driver Panel"
            >
              <ShieldCheck size={18} className="text-blue-600" />
            </Link>
          )}

          {/* Admin shortcut */}
          {profile?.role === 'admin' && (
            <Link
              href="/admin-panel"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 transition-colors duration-150 active:scale-95"
              aria-label="Admin Panel"
            >
              <ShieldCheck size={18} className="text-red-600" />
            </Link>
          )}

          {/* User button */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors duration-150 active:scale-95 ${
                user ? 'bg-primary/10 hover:bg-primary/20' : 'bg-muted hover:bg-border'
              }`}
              aria-label="Account"
            >
              <User size={18} className={user ? 'text-primary' : 'text-muted-foreground'} />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-11 w-48 bg-card border border-border rounded-2xl shadow-lg z-50 overflow-hidden animate-fade-in">
                {user ? (
                  <>
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {profile?.display_name || user.email || user.phone || 'User'}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{profile?.role || 'passenger'}</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <div className="px-4 py-3">
                    <p className="text-xs text-muted-foreground">Not signed in</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Sign in when you request a seat</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backdrop to close menu */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </header>
  );
}