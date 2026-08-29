'use client';

import React, { memo } from 'react';
import { Navigation } from 'lucide-react';

interface AppLogoProps {
  size?: number;
  className?: string;
  onClick?: () => void;
}

const AppLogo = memo(function AppLogo({ size = 40, className = '', onClick }: AppLogoProps) {
  const glyph = Math.max(14, Math.round(size * 0.5));
  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-[30%] bg-primary text-white shadow-sm ring-1 ring-black/5 ${onClick ? 'cursor-pointer transition-transform hover:scale-[1.03] active:scale-95' : ''} ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      aria-label="Raahi"
    >
      <Navigation size={glyph} strokeWidth={2.35} fill="currentColor" className="-rotate-12" />
      <span className="absolute bottom-[16%] right-[15%] h-[18%] w-[18%] rounded-full bg-amber-400 ring-2 ring-primary" aria-hidden="true" />
    </div>
  );
});

export default AppLogo;
