
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '../components/Header';

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-dark-bg">
      <Header />
      <main className="flex-1 flex flex-col w-full">
        <Outlet />
      </main>
      <footer className="bg-dark-secondary border-t border-dark-border py-8 text-center text-sm font-medium text-text-muted mt-auto shadow-sm">
        <p>ResearchLens &copy; 2026. AI-Powered Research Intelligence Platform.</p>
      </footer>
    </div>
  );
}
