
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Badge({ children, variant = 'default', className }) {
  const variants = {
    default: "bg-dark-elevated text-text-primary border-dark-border",
    success: "bg-status-success/10 text-status-success border-status-success/20",
    warning: "bg-status-warning/10 text-status-warning border-status-warning/20",
    error: "bg-status-error/10 text-status-error border-status-error/20",
    primary: "bg-brand-primary/10 text-brand-primary border-brand-primary/20",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/20"
  };
  return (
    <span className={twMerge(clsx("px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border", variants[variant], className))}>
      {children}
    </span>
  );
}
