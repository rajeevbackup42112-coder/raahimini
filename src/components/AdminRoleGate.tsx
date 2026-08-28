'use client';

import type { ReactNode } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminRoleGate({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;
  }

  if (!user) {
    return <Access title="Admin Sign In Required" text="Sign in with an Admin account to access this area." />;
  }

  if (profile?.role !== 'admin') {
    return <Access title="Admin Access Only" text="This area is only available to registered Admins." />;
  }

  return children;
}

function Access({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-screen-sm space-y-3 px-4 py-12 text-center">
      <ShieldCheck size={40} className="mx-auto text-muted-foreground opacity-40" />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
