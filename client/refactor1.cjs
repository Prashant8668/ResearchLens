const fs = require('fs');
const path = require('path');

const files = {
  'src/components/ui/Button.jsx': `
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Button({ children, variant = 'primary', className, ...props }) {
  const baseStyle = "inline-flex items-center justify-center font-medium rounded-xl transition-colors outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand";
  const variants = {
    primary: "bg-brand text-white hover:bg-blue-700 shadow-sm px-6 py-2.5 text-sm",
    secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm px-6 py-2.5 text-sm",
    ghost: "bg-transparent text-slate-600 hover:text-brand hover:bg-blue-50 px-4 py-2 text-sm",
    outline: "bg-transparent text-brand border border-brand hover:bg-blue-50 px-4 py-2.5 text-sm"
  };
  return (
    <button className={twMerge(clsx(baseStyle, variants[variant], className))} {...props}>
      {children}
    </button>
  );
}
`,
  'src/components/ui/Card.jsx': `
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Card({ children, className, ...props }) {
  return (
    <div className={twMerge(clsx("bg-white rounded-xl border border-slate-200 shadow-sm", className))} {...props}>
      {children}
    </div>
  );
}
`,
  'src/components/ui/Badge.jsx': `
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Badge({ children, variant = 'default', className }) {
  const variants = {
    default: "bg-slate-100 text-slate-700 border-slate-200",
    success: "bg-green-100 text-green-700 border-green-200",
    warning: "bg-orange-100 text-orange-700 border-orange-200",
    error: "bg-red-100 text-red-700 border-red-200",
    primary: "bg-blue-100 text-brand border-blue-200"
  };
  return (
    <span className={twMerge(clsx("px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border", variants[variant], className))}>
      {children}
    </span>
  );
}
`,
  'src/components/ui/Input.jsx': `
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Input({ className, ...props }) {
  return (
    <input 
      className={twMerge(clsx("w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/50 focus:border-brand outline-none transition-all placeholder:text-slate-400 font-medium text-slate-700", className))}
      {...props}
    />
  );
}
`,
  'src/components/ui/Select.jsx': `
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Select({ className, children, ...props }) {
  return (
    <select 
      className={twMerge(clsx("w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white outline-none shadow-sm text-slate-700 focus:ring-2 focus:ring-brand/20", className))}
      {...props}
    >
      {children}
    </select>
  );
}
`,
  'src/components/ui/ProgressBar.jsx': `
import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function ProgressBar({ progress, colorClass = "bg-brand", className }) {
  return (
    <div className={twMerge(clsx("h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex", className))}>
      <div className={clsx("h-full rounded-full transition-all duration-1000", colorClass)} style={{ width: \`\${progress}%\` }}></div>
    </div>
  );
}
`,
  'src/components/MetricCard.jsx': `
import React from 'react';
import { Card } from './ui/Card';

export function MetricCard({ title, value, icon: Icon, colorClass, bgClass }) {
  return (
    <Card className="p-6 flex items-center gap-5 hover:shadow-md transition-shadow">
      <div className={\`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 \${bgClass} \${colorClass}\`}>
        <Icon size={24}/>
      </div>
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <p className="text-3xl font-bold text-navy leading-none">{value}</p>
      </div>
    </Card>
  );
}
`,
  'src/components/Header.jsx': `
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Menu, X } from 'lucide-react';
import { Button } from './ui/Button';
import { MobileDrawer } from './MobileDrawer';

export function Header() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 w-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-navy font-bold text-xl">
            <Search className="w-6 h-6 text-brand" />
            ResearchLens
          </Link>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-slate-500 h-full items-center">
            <Link to="/" className={\`hover:text-slate-900 h-full flex items-center border-b-2 transition-colors \${isActive('/') ? 'text-brand border-brand font-semibold' : 'border-transparent'}\`}>Home</Link>
            <Link to="/analyze" className={\`hover:text-slate-900 h-full flex items-center border-b-2 transition-colors \${isActive('/analyze') ? 'text-brand border-brand font-semibold' : 'border-transparent'}\`}>Analyze</Link>
            <Link to="/projects/1/trends" className={\`hover:text-slate-900 h-full flex items-center border-b-2 transition-colors \${isActive('/projects/1/trends') ? 'text-brand border-brand font-semibold' : 'border-transparent'}\`}>Trends</Link>
            <Link to="/about" className={\`hover:text-slate-900 h-full flex items-center border-b-2 transition-colors \${isActive('/about') ? 'text-brand border-brand font-semibold' : 'border-transparent'}\`}>About</Link>
          </nav>
          <div className="hidden md:flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-brand transition-colors">Log In</Link>
            <Link to="/dashboard">
              <Button variant="primary">Get Started &rarr;</Button>
            </Link>
          </div>
          <button className="md:hidden text-slate-600 p-2" onClick={() => setIsMobileOpen(true)}>
            <Menu size={24} />
          </button>
        </div>
      </header>
      <MobileDrawer isOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)} />
    </>
  );
}
`,
  'src/components/MobileDrawer.jsx': `
import React from 'react';
import { Link } from 'react-router-dom';
import { X, Search } from 'lucide-react';

export function MobileDrawer({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-xs bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-left-full">
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
          <Link to="/" className="flex items-center gap-2 text-navy font-bold text-xl" onClick={onClose}>
            <Search className="w-6 h-6 text-brand" />
            ResearchLens
          </Link>
          <button onClick={onClose} className="p-2 text-slate-500">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
          <Link to="/" onClick={onClose} className="text-lg font-medium text-slate-700">Home</Link>
          <Link to="/analyze" onClick={onClose} className="text-lg font-medium text-slate-700">Analyze</Link>
          <Link to="/projects/1/trends" onClick={onClose} className="text-lg font-medium text-slate-700">Trends</Link>
          <Link to="/about" onClick={onClose} className="text-lg font-medium text-slate-700">About</Link>
          <hr className="border-slate-100" />
          <Link to="/login" onClick={onClose} className="text-lg font-medium text-slate-700">Log In</Link>
          <Link to="/dashboard" onClick={onClose} className="bg-brand text-white text-center py-3 rounded-xl font-medium mt-2">Get Started &rarr;</Link>
        </div>
      </div>
    </div>
  );
}
`,
  'src/components/Sidebar.jsx': `
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, LayoutDashboard, TrendingUp, AlertTriangle, Lightbulb, FileText, Upload, User, LogOut, X } from 'lucide-react';
import { clsx } from 'clsx';

export function Sidebar({ isMobileOpen, onClose }) {
  const location = useLocation();
  const isActive = (path) => location.pathname.includes(path);

  const content = (
    <>
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2 text-navy font-bold text-xl" onClick={onClose}>
          <Search className="w-6 h-6 text-brand shrink-0" />
          <span className="truncate">ResearchLens</span>
        </Link>
        <button className="lg:hidden text-slate-500 p-2" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      
      <div className="p-4 flex-1 flex flex-col gap-1 overflow-y-auto">
        <Link to="/dashboard" onClick={onClose} className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 hover:text-slate-600 transition-colors flex items-center justify-between">
          <span>Projects</span>
          <span className="text-[10px]">&larr; Back</span>
        </Link>
        
        <NavItem to="/projects/1/analysis" icon={LayoutDashboard} label="Dashboard" active={isActive('/analysis')} onClick={onClose} />
        <NavItem to="/projects/1/upload" icon={Upload} label="Upload / Analyze" active={isActive('/upload') || isActive('/analyze')} onClick={onClose} />
        <NavItem to="/projects/1/trends" icon={TrendingUp} label="Trend Analysis" active={isActive('/trends')} onClick={onClose} />
        <NavItem to="/projects/1/gaps" icon={AlertTriangle} label="Gap Analysis" active={isActive('/gaps')} onClick={onClose} />
        <NavItem to="/projects/1/novelty" icon={Lightbulb} label="Novelty Check" active={isActive('/novelty')} onClick={onClose} />
        <NavItem to="/projects/1/report" icon={FileText} label="Report" active={isActive('/report')} onClick={onClose} />
      </div>
      
      <div className="p-4 border-t border-slate-200 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 shadow-sm">
            <User size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">Dr. Researcher</p>
          </div>
          <Link to="/login" className="text-slate-400 hover:text-brand shrink-0 transition-colors">
            <LogOut size={16} />
          </Link>
        </div>
      </div>
    </>
  );

  return (
    <>
      {isMobileOpen && (
        <div className="fixed inset-0 bg-slate-900/20 z-40 lg:hidden backdrop-blur-sm" onClick={onClose}></div>
      )}
      <aside className={clsx(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0",
        isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}>
        {content}
      </aside>
    </>
  );
}

function NavItem({ to, icon: Icon, label, active, onClick }) {
  return (
    <Link to={to} onClick={onClick} className={clsx(
      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
      active ? "bg-blue-50 text-brand shadow-sm shadow-blue-100/50" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    )}>
      <Icon size={18} className={active ? "text-brand" : "text-slate-400"} />
      {label}
    </Link>
  );
}
`,
  'src/layouts/PublicLayout.jsx': `
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '../components/Header';

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 flex flex-col w-full">
        <Outlet />
      </main>
      <footer className="bg-white border-t border-slate-200 py-8 text-center text-sm font-medium text-slate-500 mt-auto shadow-sm">
        <p>ResearchLens &copy; 2026. AI-Powered Research Intelligence Platform.</p>
      </footer>
    </div>
  );
}
`,
  'src/layouts/SidebarLayout.jsx': `
import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Menu, User } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { clsx } from 'clsx';

export default function SidebarLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const isActive = (path) => location.pathname.includes(path);

  return (
    <div className="min-h-screen flex bg-slate-50 w-full relative overflow-hidden">
      <Sidebar isMobileOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)} />

      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen w-full transition-all duration-300">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30 shrink-0 shadow-sm">
          <div className="flex items-center gap-4 h-full">
            <button className="lg:hidden text-slate-600 p-2 hover:bg-slate-50 rounded-lg transition-colors" onClick={() => setIsMobileOpen(true)}>
              <Menu size={24} />
            </button>
            <nav className="hidden sm:flex gap-8 text-sm font-medium text-slate-500 h-full items-center">
              <Link to="/" className="hover:text-slate-900 border-b-2 border-transparent h-full flex items-center transition-colors">Home</Link>
              <Link to="/analyze" className={clsx("hover:text-slate-900 h-full flex items-center border-b-2 transition-colors", isActive('/upload') || isActive('/analyze') ? 'text-brand border-brand font-semibold' : 'border-transparent')}>Analyze</Link>
              <Link to="/projects/1/trends" className={clsx("hover:text-slate-900 h-full flex items-center border-b-2 transition-colors", isActive('/trends') ? 'text-brand border-brand font-semibold' : 'border-transparent')}>Trends</Link>
              <Link to="/about" className="hover:text-slate-900 border-b-2 border-transparent h-full flex items-center transition-colors">About</Link>
            </nav>
          </div>
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer hover:bg-slate-200 transition-colors border border-slate-200 shadow-sm">
            <User size={18} />
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8 flex-1 w-full max-w-full overflow-x-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
`
};

for (const [filePath, content] of Object.entries(files)) {
  const fullPath = path.join(__dirname, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content);
}
console.log('Core components refactored successfully.');
