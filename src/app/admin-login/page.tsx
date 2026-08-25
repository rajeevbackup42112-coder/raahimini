'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AdminLoginCompatibilityPage() {
  const router = useRouter();

  useEffect(() => {
    router?.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="animate-spin text-primary" aria-label="Redirecting to sign in" />
    </div>
  );
}
