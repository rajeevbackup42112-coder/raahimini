'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const isAuthPath = (path: string) => path.startsWith('/auth/');
const isProfilePath = (path: string) => path === '/profile';
const isAdminPath = (path: string) => path.startsWith('/admin-panel') || path === '/admin-driver-onboarding';
const isDemoPath = (path: string) => path === '/demo' || path.startsWith('/demo/');

export default function RoleRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (isDemoPath(pathname)) return;
    if (loading || !user || !profile) return;
    if (isAuthPath(pathname) || isProfilePath(pathname)) return;

    if (profile.role === 'admin') {
      if (!isAdminPath(pathname)) router.replace('/admin-panel');
      return;
    }

    if (profile.role === 'driver') {
      if (!pathname.startsWith('/driver-')) router.replace('/driver-route-selection');
      return;
    }

    // Passengers must never enter protected driver/admin operational surfaces.
    // /driver-login remains available so a known future driver can sign in once
    // and wait for trusted Admin activation.
    if (pathname.startsWith('/admin-') || (pathname.startsWith('/driver-') && pathname !== '/driver-login')) {
      router.replace('/');
    }
  }, [loading, pathname, profile, router, user]);

  return null;
}
