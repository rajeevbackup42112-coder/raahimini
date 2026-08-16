import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function PayWarningBanner() {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
      <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-amber-800">PAY ONLY AFTER YOU MEET THE DRIVER</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Do not pay in advance. Hand cash or UPI directly to the driver once seated.
        </p>
      </div>
    </div>
  );
}