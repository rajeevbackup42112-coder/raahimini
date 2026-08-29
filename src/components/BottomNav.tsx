'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Car, Map, Ticket, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const passengerNavItems = [
  { href: '/', label: 'Home', icon: Map },
  { href: '/active-car-screen', label: 'Find Ride', icon: Car },
  { href: '/request-status-screen', label: 'My Ride', icon: Ticket },
  { href: '/profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { profile } = useAuth();
  if (profile?.role === 'driver' || profile?.role === 'admin') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm safe-bottom sm:hidden">
      <div className="mx-auto grid w-full max-w-screen-xl grid-cols-4">
        {passengerNavItems.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}>
              <span className={`flex h-8 w-9 items-center justify-center rounded-xl transition-colors ${active ? 'bg-secondary' : ''}`}><Icon size={20} strokeWidth={active ? 2.4 : 1.8} /></span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
