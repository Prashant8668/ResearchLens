const fs = require('fs');
const path = require('path');

const files = {
  'src/layouts/PublicLayout.jsx': `
import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Search, Menu, X } from 'lucide-react';

export default function PublicLayout() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 w-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-navy font-bold text-xl">
            <Search className="w-6 h-6 text-brand" />
            ResearchLens
          </Link>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-brand transition-colors">Home</Link>
            <Link to="/analyze" className="hover:text-brand transition-colors">Analyze</Link>
            <Link to="/projects/1/trends" className="hover:text-brand transition-colors">Trends</Link>
            <Link to="/about" className="hover:text-brand transition-colors">About</Link>
          </nav>
          <div className="hidden md:flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-brand transition-colors">Log In</Link>
            <Link to="/dashboard" className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
              Get Started &rarr;
            </Link>
          </div>
          <button className="md:hidden text-slate-600 p-2" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {isOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 p-4 flex flex-col gap-4 shadow-lg absolute top-16 left-0 w-full z-40">
            <Link to="/" onClick={() => setIsOpen(false)} className="text-slate-600 font-medium">Home</Link>
            <Link to="/analyze" onClick={() => setIsOpen(false)} className="text-slate-600 font-medium">Analyze</Link>
            <Link to="/projects/1/trends" onClick={() => setIsOpen(false)} className="text-slate-600 font-medium">Trends</Link>
            <Link to="/about" onClick={() => setIsOpen(false)} className="text-slate-600 font-medium">About</Link>
            <hr className="border-slate-100" />
            <Link to="/login" onClick={() => setIsOpen(false)} className="text-slate-600 font-medium">Log In</Link>
            <Link to="/dashboard" onClick={() => setIsOpen(false)} className="bg-brand text-white text-center py-2.5 rounded-xl font-medium">Get Started &rarr;</Link>
          </div>
        )}
      </header>
      <main className="flex-1 flex flex-col w-full">
        <Outlet />
      </main>
      <footer className="bg-white border-t border-slate-200 py-8 text-center text-sm text-slate-500 mt-auto">
        <p>ResearchLens &copy; 2026. AI-Powered Research Intelligence Platform.</p>
      </footer>
    </div>
  );
}
`,
  'src/layouts/SidebarLayout.jsx': `
import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Search, LayoutDashboard, TrendingUp, AlertTriangle, Lightbulb, FileText, Upload, User, LogOut, Menu, X } from 'lucide-react';

export default function SidebarLayout() {
  const location = useLocation();
  const isActive = (path) => location.pathname.includes(path);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50 w-full relative">
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/20 z-40 lg:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}
      
      <aside className={\`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 \${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}\`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2 text-navy font-bold text-xl">
            <Search className="w-6 h-6 text-brand shrink-0" />
            <span className="truncate">ResearchLens</span>
          </Link>
          <button className="lg:hidden text-slate-500 p-1" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="p-4 flex-1 flex flex-col gap-1 overflow-y-auto">
          <Link to="/dashboard" className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 hover:text-slate-600 transition-colors flex items-center justify-between">
            <span>Projects</span>
            <span className="text-[10px]">&larr; Back</span>
          </Link>
          
          <NavItem to="/projects/1/analysis" icon={LayoutDashboard} label="Dashboard" active={isActive('/analysis')} onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem to="/projects/1/upload" icon={Upload} label="Upload / Analyze" active={isActive('/upload') || isActive('/analyze')} onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem to="/projects/1/trends" icon={TrendingUp} label="Trend Analysis" active={isActive('/trends')} onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem to="/projects/1/gaps" icon={AlertTriangle} label="Gap Analysis" active={isActive('/gaps')} onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem to="/projects/1/novelty" icon={Lightbulb} label="Novelty Check" active={isActive('/novelty')} onClick={() => setIsMobileMenuOpen(false)} />
          <NavItem to="/projects/1/report" icon={FileText} label="Report" active={isActive('/report')} onClick={() => setIsMobileMenuOpen(false)} />
        </div>
        <div className="p-4 border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
              <User size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">Dr. Researcher</p>
            </div>
            <Link to="/login" className="text-slate-400 hover:text-slate-600 shrink-0">
              <LogOut size={16} />
            </Link>
          </div>
        </div>
      </aside>

      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen w-full transition-all duration-300">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4 h-full">
            <button className="lg:hidden text-slate-600 p-1" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <nav className="hidden sm:flex gap-6 text-sm font-medium text-slate-500 h-full items-center">
              <Link to="/" className="hover:text-slate-900">Home</Link>
              <Link to="/analyze" className={\`hover:text-slate-900 h-full flex items-center \${isActive('/upload') || isActive('/analyze') ? 'text-brand border-b-2 border-brand font-semibold' : ''}\`}>Analyze</Link>
              <Link to="/projects/1/trends" className={\`hover:text-slate-900 h-full flex items-center \${isActive('/trends') ? 'text-brand border-b-2 border-brand font-semibold' : ''}\`}>Trends</Link>
              <Link to="/about" className="hover:text-slate-900">About</Link>
            </nav>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer hover:bg-slate-200 transition-colors">
            <User size={16} />
          </div>
        </header>
        <div className="p-4 sm:p-8 flex-1 w-full max-w-full overflow-x-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, active, onClick }) {
  return (
    <Link to={to} onClick={onClick} className={\`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all \${active ? 'bg-blue-50 text-brand' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}\`}>
      <Icon size={18} />
      {label}
    </Link>
  );
}
`
};

for (const [filePath, content] of Object.entries(files)) {
  const fullPath = path.join(__dirname, filePath);
  fs.writeFileSync(fullPath, content);
}
console.log('Responsive layouts updated successfully.');
