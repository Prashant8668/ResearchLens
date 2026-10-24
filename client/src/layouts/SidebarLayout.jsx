
import React, { useState } from 'react';
import { Outlet, Link, useLocation, useParams } from 'react-router-dom';
import { Menu, User } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { clsx } from 'clsx';

export default function SidebarLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const { projectId } = useParams();
  const isActive = (path) => location.pathname.includes(path);

  const basePath = projectId ? `/projects/${projectId}` : '';

  return (
    <div className="min-h-screen flex bg-dark-bg w-full relative overflow-hidden">
      <Sidebar isMobileOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)} />

      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen w-full transition-all duration-300">
        <header className="h-16 bg-dark-secondary border-b border-dark-border flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30 shrink-0 shadow-sm">
          <div className="flex items-center gap-4 h-full">
            <button className="lg:hidden text-text-secondary p-2 hover:bg-dark-elevated rounded-lg transition-colors" onClick={() => setIsMobileOpen(true)}>
              <Menu size={24} />
            </button>
            <nav className="hidden sm:flex gap-8 text-sm font-medium text-text-muted h-full items-center">
              <Link to="/dashboard" className="hover:text-text-primary border-b-2 border-transparent h-full flex items-center transition-colors">Projects</Link>
              {projectId && (
                <>
                  <Link to={`${basePath}/upload`} className={clsx("hover:text-text-primary h-full flex items-center border-b-2 transition-colors", isActive('/upload') || isActive('/analyze') ? 'text-brand-primary border-brand-primary font-semibold' : 'border-transparent')}>Analyze</Link>
                  <Link to={`${basePath}/trends`} className={clsx("hover:text-text-primary h-full flex items-center border-b-2 transition-colors", isActive('/trends') ? 'text-brand-primary border-brand-primary font-semibold' : 'border-transparent')}>Trends</Link>
                </>
              )}
            </nav>
          </div>
          <div className="w-9 h-9 rounded-full bg-dark-elevated flex items-center justify-center text-text-secondary cursor-pointer hover:bg-dark-card transition-colors border border-dark-border shadow-sm">
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
