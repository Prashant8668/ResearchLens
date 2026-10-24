
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Input({ className, ...props }) {
  return (
    <input 
      className={twMerge(clsx("w-full px-4 py-2.5 bg-dark-secondary border border-dark-border rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary outline-none transition-all placeholder:text-text-muted font-medium text-text-primary", className))}
      {...props}
    />
  );
}
