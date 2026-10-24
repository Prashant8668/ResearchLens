import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { X, Search } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';

export function MobileDrawer({ isOpen, onClose }) {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleLogout = () => {
    logout();
    onClose();
    navigate('/');
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-dark-bg/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-xs bg-dark-secondary shadow-2xl flex flex-col h-full animate-in slide-in-from-left-full">
        <div className="h-16 flex items-center justify-between px-6 border-b border-dark-border">
          <Link to="/" className="flex items-center gap-2 text-text-primary font-bold text-xl" onClick={onClose}>
            <Search className="w-6 h-6 text-brand-primary" />
            ResearchLens
          </Link>
          <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto">
          <Link to="/" onClick={onClose} className="text-lg font-medium text-text-primary">Home</Link>
          <Link to="/analyze" onClick={onClose} className="text-lg font-medium text-text-primary">Analyze</Link>
          <Link to="/about" onClick={onClose} className="text-lg font-medium text-text-primary">About</Link>
          <hr className="border-dark-border" />
          {user ? (
            <>
              <div className="text-sm text-text-muted mb-[-12px]">Signed in as <span className="text-text-primary font-bold">{user.name}</span></div><Link to="/dashboard" onClick={onClose} className="text-lg font-medium text-text-primary">Dashboard</Link>
              <button onClick={handleLogout} className="text-left text-lg font-medium text-red-400">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={onClose} className="text-lg font-medium text-text-primary">Log In</Link>
              <Link to="/register" onClick={onClose} className="bg-brand-primary text-text-primary hover:bg-brand-bright transition-colors text-center py-3 rounded-xl font-medium mt-2">Get Started &rarr;</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

