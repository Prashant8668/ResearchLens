import React, { useState, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Menu, LogOut, User } from 'lucide-react';
import { Button } from './ui/Button';
import { MobileDrawer } from './MobileDrawer';
import { AuthContext } from '../contexts/AuthContext';

export function Header() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  
  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const linkClass = "hover:text-text-primary h-full flex items-center border-b-2 transition-colors";
  const activeClass = "text-brand-primary border-brand-primary font-semibold";
  const inactiveClass = "border-transparent";

  return (
    <>
      <header className="bg-dark-bg border-b border-dark-border sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 w-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-text-primary font-bold text-xl">
            <Search className="w-6 h-6 text-brand-primary" />
            ResearchLens
          </Link>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-text-muted h-full items-center">
            <Link to="/" className={linkClass + " " + (isActive('/') ? activeClass : inactiveClass)}>Home</Link>
            <Link to="/analyze" className={linkClass + " " + (isActive('/analyze') ? activeClass : inactiveClass)}>Analyze</Link>
            <Link to="/about" className={linkClass + " " + (isActive('/about') ? activeClass : inactiveClass)}>About</Link>
          </nav>
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <Link to="/dashboard" className="text-sm font-medium text-text-secondary hover:text-brand-primary transition-colors flex items-center gap-2">
                  <User size={16} /> {user.name}
                </Link>
                <button onClick={handleLogout} className="text-sm font-medium text-text-secondary hover:text-red-400 transition-colors flex items-center gap-2">
                  <LogOut size={16} /> Logout
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-text-secondary hover:text-brand-primary transition-colors">Log In</Link>
                <Link to="/register">
                  <Button variant="primary">Get Started &rarr;</Button>
                </Link>
              </>
            )}
          </div>
          <button className="md:hidden text-text-secondary p-2 hover:text-text-primary" onClick={() => setIsMobileOpen(true)}>
            <Menu size={24} />
          </button>
        </div>
      </header>
      <MobileDrawer isOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)} />
    </>
  );
}

