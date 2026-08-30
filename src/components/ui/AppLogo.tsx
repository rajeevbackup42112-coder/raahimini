'use client';

import React, { memo } from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
  onClick?: () => void;
}

const AppLogo = memo(function AppLogo({ size = 40, className = '', onClick }: AppLogoProps) {
  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[28%] bg-white shadow-sm ring-1 ring-black/5 ${onClick ? 'cursor-pointer transition-transform hover:scale-[1.03] active:scale-95' : ''} ${className}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      aria-label="Raahi Carpool"
    >
      <img src="/assets/images/app_logo.png" alt="Raahi" width={size} height={size} className="h-full w-full object-contain" />
    </div>
  );
});

export default AppLogo;
