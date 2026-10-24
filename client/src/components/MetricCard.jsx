
import React from 'react';
import { Card } from './ui/Card';

export function MetricCard({ title, value, icon: Icon, colorClass, bgClass }) {
  return (
    <Card className="p-6 flex items-center gap-5 hover:shadow-md transition-shadow">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${bgClass} ${colorClass}`}>
        <Icon size={24}/>
      </div>
      <div>
        <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">{title}</p>
        <p className="text-3xl font-bold text-text-primary leading-none">{value}</p>
      </div>
    </Card>
  );
}
