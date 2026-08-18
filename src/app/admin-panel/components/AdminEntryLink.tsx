'use client';

import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminEntryLink() {
  const { user, loading } = useAuth();
  if (loading || user) return null;

  return (
    <div className="max-w-md mx-auto px-4 pt-8">
      <Link
        href="/admin-login"
        className="w-full rounded-xl bg-primary text-primary-foreground px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2"
      >
        <LogIn size={16} />
        Sign in to Admin
      </Link>
      <p className="text-xs text-muted-foreground text-center mt-2">
        This entry is only available from the Admin Panel URL and is not shown in public passenger navigation.
      </p>
    </div>
  );
}
