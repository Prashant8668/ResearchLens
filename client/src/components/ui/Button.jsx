
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Button({ children, variant = 'primary', className, ...props }) {
  const baseStyle = "inline-flex items-center justify-center font-medium rounded-xl transition-colors outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-primary";
  const variants = {
    primary: "bg-brand-primary text-text-primary hover:bg-brand-bright shadow-sm px-6 py-2.5 text-sm",
    secondary: "bg-dark-secondary text-text-primary border border-dark-border hover:bg-dark-elevated shadow-sm px-6 py-2.5 text-sm",
    ghost: "bg-transparent text-text-secondary hover:text-brand-primary hover:bg-brand-primary/10 px-4 py-2 text-sm",
    outline: "bg-transparent text-brand-primary border border-brand-primary hover:bg-brand-primary/10 px-4 py-2.5 text-sm"
  };
  return (
    <button className={twMerge(clsx(baseStyle, variants[variant], className))} {...props}>
      {children}
    </button>
  );
}
