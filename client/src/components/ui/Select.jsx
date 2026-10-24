
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Select({ className, children, ...props }) {
  return (
    <select 
      className={twMerge(clsx("w-full px-4 py-2.5 border border-dark-border rounded-xl text-sm font-medium bg-dark-secondary outline-none shadow-sm text-text-primary focus:ring-2 focus:ring-brand-primary/20", className))}
      {...props}
    >
      {children}
    </select>
  );
}
