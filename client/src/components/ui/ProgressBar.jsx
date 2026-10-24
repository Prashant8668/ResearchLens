
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function ProgressBar({ progress, colorClass = "bg-brand-primary", className }) {
  return (
    <div className={twMerge(clsx("h-2.5 w-full bg-dark-elevated rounded-full overflow-hidden flex", className))}>
      <div className={clsx("h-full rounded-full transition-all duration-1000", colorClass)} style={{ width: `${progress}%` }}></div>
    </div>
  );
}
