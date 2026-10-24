
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Card({ children, className, ...props }) {
  return (
    <div className={twMerge(clsx("bg-dark-card rounded-xl border border-dark-border shadow-sm", className))} {...props}>
      {children}
    </div>
  );
}
