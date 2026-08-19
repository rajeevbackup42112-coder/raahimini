'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, User, MapPin, LogOut, ShieldCheck, Car, Phone, MessageCircle, LogIn } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';

interface AppHeaderProps { title?: string; showBack?: boolean; }

export default function AppHeader({ title, showBack = false }: AppHeaderProps) {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const [locationName, setLocationName] = useState('Location');
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => { const saved = localStorage.getItem('raahi_last_location_name'); if (saved) setLocationName(saved); }, []);
  const handleSignOut = async () => { setShowUserMenu(false); try { await signOut(); router.push('/'); } catch {} };
  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const roleLabel = profile?.role === 'driver' ? 'Driver' : profile?.role === 'admin' ? 'Admin' : 'Passenger';

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border card-shadow">
      <div className="flex items-center gap-3 px-4 h-14 max-w-screen-2xl mx-auto">
        {showBack ? <button onClick={() => router.back()} className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-muted active:scale-95" aria-label="Go back"><ChevronLeft size={22}/></button> : <Link href="/" className="flex items-center gap-2 flex-shrink-0"><AppLogo size={32}/><span className="font-bold text-lg hidden sm:block">Raahi Mini</span></Link>}
        {title ? <h1 className="flex-1 text-base font-semibold truncate">{title}</h1> : <div className="flex-1"/>}
        <div className="flex items-center gap-2">
          {profile?.role === 'passenger' || !user ? <Link href="/" className="flex items-center gap-1.5 bg-secondary text-secondary-foreground rounded-xl px-3 py-1.5 text-sm font-medium"><MapPin size={14}/><span className="max-w-[80px] truncate">{locationName}</span></Link> : null}
          {profile?.role === 'driver' && <Link href="/driver-route-selection" className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl bg-blue-50 hover:bg-blue-100" aria-label="Driver Panel"><ShieldCheck size={18} className="text-blue-600"/></Link>}
          {profile?.role === 'admin' && <Link href="/admin-panel" className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100" aria-label="Admin Panel"><ShieldCheck size={18} className="text-red-600"/></Link>}
          <div className="relative">
            <button onClick={() => setShowUserMenu(!showUserMenu)} className={`flex items-center gap-2 rounded-xl px-2.5 h-9 ${user?'bg-primary/10':'bg-muted'}`} aria-label="Account">
              <User size={18} className={user?'text-primary':'text-muted-foreground'}/>
              {user && <div className="hidden sm:block text-left leading-tight max-w-[130px]"><p className="text-xs font-semibold truncate">{displayName}</p><p className="text-[10px] text-muted-foreground">{roleLabel}</p></div>}
            </button>
            {showUserMenu && <div className="absolute right-0 top-11 w-60 bg-card border border-border rounded-2xl shadow-lg z-50 overflow-hidden">
              {user ? <>
                <div className="px-4 py-3 border-b"><p className="text-sm font-semibold truncate">{displayName}</p><p className="text-xs text-muted-foreground">{roleLabel}</p><p className="text-[11px] text-muted-foreground truncate mt-1">{user.email || user.phone || ''}</p></div>
                <Link href="/profile" onClick={()=>setShowUserMenu(false)} className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-muted"><Phone size={14}/>Profile & phone</Link>
                <Link href="/support" onClick={()=>setShowUserMenu(false)} className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-muted"><MessageCircle size={14}/>Contact support</Link>
                {profile?.role === 'driver' && <Link href="/driver-route-selection" onClick={()=>setShowUserMenu(false)} className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-muted"><Car size={14}/>Driver home</Link>}
                {profile?.role === 'admin' && <Link href="/admin-panel" onClick={()=>setShowUserMenu(false)} className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-muted"><ShieldCheck size={14}/>Admin panel</Link>}
                <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50"><LogOut size={14}/>Sign Out</button>
              </> : <>
                <div className="px-4 py-3 border-b"><p className="text-xs font-semibold">Welcome to Raahi</p><p className="text-xs text-muted-foreground mt-0.5">Browse rides without signing in. Use the same sign-in for Passenger, Driver or Admin.</p></div>
                <Link href="/login" onClick={()=>setShowUserMenu(false)} className="flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-muted"><LogIn size={14}/>Sign in with Google</Link>
              </>}
            </div>}
          </div>
        </div>
      </div>
      {showUserMenu && <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}/>} 
    </header>
  );
}
