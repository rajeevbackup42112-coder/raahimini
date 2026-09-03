'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const isAuthPath = (path: string) => path.startsWith('/auth/');
const isProfilePath = (path: string) => path === '/profile';
const isNeutralAccountPath = (path: string) => path === '/drive-with-raahi';
const isAdminPath = (path: string) => path.startsWith('/admin-panel') || path === '/admin-driver-onboarding';

export default function RoleRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (isAuthPath(pathname) || isProfilePath(pathname) || isNeutralAccountPath(pathname)) return;

    if (profile.role === 'admin') {
      if (!isAdminPath(pathname)) router.replace('/admin-panel');
      return;
    }

    if (profile.role === 'driver') {
      if (!pathname.startsWith('/driver-')) router.replace('/driver-route-selection');
      return;
    }

    // Passengers must never enter protected driver/admin operational surfaces.
    // Driver onboarding itself is a neutral account-transition surface and is handled above.
    if (pathname.startsWith('/admin-') || (pathname.startsWith('/driver-') && pathname !== '/driver-login')) {
      router.replace('/');
    }
  }, [loading, pathname, profile, router, user]);

  return null;
}
