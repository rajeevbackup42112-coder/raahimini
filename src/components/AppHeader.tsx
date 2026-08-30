'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Car, ChevronLeft, LogOut, Map, MapPin, Phone, ShieldCheck, User } from 'lucide-react';
import BrandLockup from '@/components/ui/BrandLockup';
import { useAuth } from '@/contexts/AuthContext';

interface AppHeaderProps { title?: string; showBack?: boolean; }

export default function AppHeader({ title, showBack = false }: AppHeaderProps) {
  const router = useRouter(); const pathname = usePathname(); const { user, profile, signOut } = useAuth();
  const [locationName, setLocationName] = useState('Location'); const [showUserMenu, setShowUserMenu] = useState(false);
  useEffect(() => { const saved = localStorage.getItem('raahi_last_location_name'); if (saved) setLocationName(saved); }, []);
  const handleSignOut = async () => { setShowUserMenu(false); try { await signOut(); router.push('/'); } catch {} };
  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initial = displayName.slice(0, 1).toUpperCase();
  const homeHref = profile?.role === 'driver' ? '/driver-route-selection' : profile?.role === 'admin' ? '/admin-panel' : '/';

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-screen-xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        {showBack ? <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-muted active:scale-95" aria-label="Go back"><ChevronLeft size={22} /></button> : <Link href={homeHref} className="shrink-0"><BrandLockup size={34}/></Link>}
        {title ? <h1 className="min-w-0 flex-1 truncate text-base font-bold">{title}</h1> : <div className="flex-1" />}
        {!showBack && <nav className="hidden items-center gap-1 md:flex">{profile?.role === 'driver' ? <Link href="/driver-route-selection" className={`nav-item ${pathname === '/driver-route-selection' ? 'active' : ''}`}><Car size={16} />Driver Home</Link> : profile?.role === 'admin' ? <Link href="/admin-panel" className={`nav-item ${pathname.startsWith('/admin-panel') ? 'active' : ''}`}><ShieldCheck size={16} />Admin Home</Link> : <><Link href="/" className={`nav-item ${pathname === '/' ? 'active' : ''}`}><Map size={16} />Home</Link>{user && <Link href="/profile" className={`nav-item ${pathname === '/profile' ? 'active' : ''}`}><User size={16} />Profile</Link>}</>}</nav>}
        <div className="flex items-center gap-2">
          {(profile?.role === 'passenger' || !user) && !showBack ? <Link href="/" className="hidden items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground sm:flex"><MapPin size={14} /><span className="max-w-[90px] truncate">{locationName}</span></Link> : null}
          {!user ? (pathname === '/login' ? null : <Link href="/login" className="btn-primary px-4 py-2 text-sm">Sign in</Link>) : <div className="relative"><button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 rounded-xl bg-muted px-2 py-1.5 transition-colors hover:bg-secondary" aria-label="Account"><span className="gradient-primary flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white">{initial}</span><span className="hidden max-w-[140px] text-left leading-tight sm:block"><span className="block truncate text-sm font-semibold text-foreground">{displayName}</span></span></button>{showUserMenu && <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-border bg-card shadow-lg"><div className="border-b px-4 py-3"><p className="truncate text-sm font-bold">{displayName}</p></div><Link href="/profile" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-muted"><Phone size={14} />Profile & phone</Link>{profile?.role === 'driver' && <Link href="/driver-route-selection" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-muted"><Car size={14} />Driver home</Link>}{profile?.role === 'admin' && <Link href="/admin-panel" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-muted"><ShieldCheck size={14} />Admin panel</Link>}<button onClick={handleSignOut} className="flex w-full items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50"><LogOut size={14} />Sign out</button></div>}</div>}
        </div>
      </div>{showUserMenu && <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />}
    </header>
  );
}
