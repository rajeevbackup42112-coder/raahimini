'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, LayoutDashboard, LogOut, Route, Users } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';

type AdminSection = 'dashboard' | 'users' | 'routes' | 'operations';

const links: { id: AdminSection; label: string; href: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/admin-panel', icon: <LayoutDashboard size={16} /> },
  { id: 'users', label: 'Users', href: '/admin-panel/users', icon: <Users size={16} /> },
  { id: 'routes', label: 'Routes', href: '/admin-panel/route-settings', icon: <Route size={16} /> },
  { id: 'operations', label: 'Operations', href: '/admin-panel/operations', icon: <Activity size={16} /> },
];

export default function AdminPrimaryNav({ active }: { active: AdminSection }) {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const handleSignOut = async () => { try { await signOut(); router.replace('/login'); } catch {} };
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="Raahi home">
          <AppLogo size={28} />
          <span className="font-bold text-foreground">Raahi Admin</span>
        </Link>
        <Link href="/profile" className="ml-auto min-w-0 rounded-xl px-2 py-1 text-right hover:bg-muted" aria-label="Open Admin profile">
          <p className="max-w-[150px] truncate text-xs font-bold text-foreground">{profile?.display_name || 'Admin'}</p>
          <p className="text-[10px] text-muted-foreground">Account · Admin access</p>
        </Link>
        <button onClick={handleSignOut} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
      </div>
      <nav className="mx-auto grid max-w-screen-2xl grid-cols-4 border-t border-border px-1" aria-label="Admin sections">
        {links.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`flex min-h-12 items-center justify-center gap-1.5 border-b-2 px-2 text-xs font-semibold transition-colors ${active === item.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {item.icon}<span className="truncate">{item.label}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
