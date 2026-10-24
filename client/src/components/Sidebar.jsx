
import React, { useContext } from 'react';
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { Search, LayoutDashboard, TrendingUp, AlertTriangle, Compass, Lightbulb, FileText, Upload, User, LogOut, X, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { AuthContext } from '../contexts/AuthContext';

export function Sidebar({ isMobileOpen, onClose }) {
  const location = useLocation();
  const { projectId } = useParams();
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const isActive = (path) => location.pathname.includes(path);

  const handleLogout = (e) => {
    e.preventDefault();
    logout();
    if (onClose) onClose();
    navigate('/');
  };

  const basePath = projectId ? `/projects/${projectId}` : '';

  const content = (
    <>
      <div className="h-16 flex items-center justify-between px-6 border-b border-dark-border shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2 text-text-primary font-bold text-xl" onClick={onClose}>
          <Search className="w-6 h-6 text-brand-primary shrink-0" />
          <span className="truncate">ResearchLens</span>
        </Link>
        <button className="lg:hidden text-text-muted p-2 hover:text-text-primary" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      
      <div className="p-4 flex-1 flex flex-col gap-1 overflow-y-auto">
        <Link to="/dashboard" onClick={onClose} className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-3 hover:text-text-primary transition-colors flex items-center justify-between">
          <span>Projects</span>
          <span className="text-[10px]">&larr; Back</span>
        </Link>
        
        {projectId && (
          <>
            <NavItem to={`${basePath}/analysis`} icon={LayoutDashboard} label="Dashboard" active={isActive('/analysis')} onClick={onClose} />
            <NavItem to={`${basePath}/upload`} icon={Upload} label="Upload / Analyze" active={isActive('/upload') || isActive('/analyze')} onClick={onClose} />
            <NavItem to={`${basePath}/trends`} icon={TrendingUp} label="Trend Analysis" active={isActive('/trends')} onClick={onClose} />
            <NavItem to={`${basePath}/gaps`} icon={AlertTriangle} label="Gap Analysis" active={isActive('/gaps')} onClick={onClose} />
            <NavItem to={`${basePath}/recommendations`} icon={Compass} label="Recommendations" active={isActive('/recommendations')} onClick={onClose} />
            <NavItem to={`${basePath}/novelty`} icon={Lightbulb} label="Similarity Screening" active={isActive('/novelty')} onClick={onClose} />
            <NavItem to={`${basePath}/plagiarism`} icon={ShieldCheck} label="Plagiarism Checker" active={isActive('/plagiarism')} onClick={onClose} />
            <NavItem to={`${basePath}/report`} icon={FileText} label="Report" active={isActive('/report')} onClick={onClose} />
          </>
        )}
      </div>
      
      <div className="p-4 border-t border-dark-border shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 bg-dark-card rounded-xl border border-dark-border">
          <div className="w-8 h-8 rounded-full bg-dark-elevated border border-dark-border flex items-center justify-center text-text-primary shrink-0 shadow-sm">
            <User size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{user?.name || 'User'}</p>
          </div>
          <button onClick={handleLogout} className="text-text-muted hover:text-red-400 shrink-0 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {isMobileOpen && (
        <div className="fixed inset-0 bg-dark-bg/80 z-40 lg:hidden backdrop-blur-sm" onClick={onClose}></div>
      )}
      <aside className={clsx(
        "fixed inset-y-0 left-0 z-50 w-64 bg-dark-secondary border-r border-dark-border flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0",
        isMobileOpen ? "translate-x-0 shadow-2xl shadow-black" : "-translate-x-full"
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
      active ? "bg-brand-primary/10 text-brand-primary" : "text-text-secondary hover:bg-dark-elevated hover:text-text-primary"
    )}>
      <Icon size={18} className={active ? "text-brand-primary" : "text-text-muted"} />
      {label}
    </Link>
  );
}
