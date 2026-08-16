'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, Car, Ticket, Clock, ShieldCheck } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


const navItems = [
  { href: '/', label: 'Location', icon: MapPin, key: 'nav-location' },
  { href: '/active-car-screen', label: 'Active Car', icon: Car, key: 'nav-active-car' },
  { href: '/request-seat-screen', label: 'Request', icon: Ticket, key: 'nav-request' },
  { href: '/request-status-screen', label: 'Status', icon: Clock, key: 'nav-status' },
  { href: '/driver-active-car-screen', label: 'Driver', icon: ShieldCheck, key: 'nav-driver' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-bottom">
      <div className="flex items-stretch max-w-screen-2xl mx-auto">
        {navItems?.map((item) => {
          const isActive = pathname === item?.href;
          const Icon = item?.icon;
          return (
            <Link
              key={item?.key}
              href={item?.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors duration-150 min-h-[56px] ${
                isActive
                  ? 'text-primary' :'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-colors duration-150 ${isActive ? 'bg-secondary' : ''}`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              </div>
              <span>{item?.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}