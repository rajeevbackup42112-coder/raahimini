'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function RealtimeRefreshBoundary({
  children,
  routeFromSearchParams = false,
}: {
  children: React.ReactNode;
  routeFromSearchParams?: boolean;
}) {
  const searchParams = useSearchParams();
  const routeId = routeFromSearchParams ? searchParams.get('route_id') : null;
  const [version, setVersion] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const config: any = {
      event: 'INSERT',
      schema: 'public',
      table: 'raahi_invalidation_events',
    };
    if (routeId) config.filter = `route_id=eq.${routeId}`;

    const channel = supabase
      .channel(`raahi_projection_invalidation_${routeId || 'global'}_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', config, () => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          setVersion((current) => current + 1);
          timerRef.current = null;
        }, 180);
      })
      .subscribe();

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      supabase.removeChannel(channel);
    };
  }, [routeId]);

  return <React.Fragment key={version}>{children}</React.Fragment>;
}
