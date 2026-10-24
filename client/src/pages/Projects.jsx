
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Folder, Loader, X } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { fetchApi } from '../utils/api';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDomain, setNewProjectDomain] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const navigate = useNavigate();

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await fetchApi('/api/projects');
      setProjects(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    
    setIsCreating(true);
    setCreateError(null);
    
    try {
      const data = await fetchApi('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: newProjectName, domain: newProjectDomain })
      });
      
      setProjects(prev => [...prev, data]);
      setIsModalOpen(false);
      setNewProjectName('');
      setNewProjectDomain('');
      
      // Navigate to the newly created project's upload page to start
      navigate(`/projects/${data._id}/upload`);
    } catch (err) {
      setCreateError(err.message || 'Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-6xl w-full mx-auto relative px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 sm:mb-10 gap-4 mt-2 sm:mt-4">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">My Research Projects</h1>
        <Button variant="primary" className="flex items-center gap-2 w-max shadow-sm" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> New Project
        </Button>
      </div>
      
      {error && (
        <div className="p-4 mb-8 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center justify-between">
          <span>{error}</span>
          {error.toLowerCase().includes('token') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                navigate('/login');
              }}
            >
              Log In Again
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader className="animate-spin text-brand-primary" size={32} />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <Folder size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg">No projects yet.</p>
          <p className="text-sm">Create a new project to start analyzing research papers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {projects.map(proj => (
            <Card key={proj._id} className="p-6 flex flex-col hover:-translate-y-1 transition-all duration-300 hover:shadow-lg border-dark-border">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3.5 bg-brand-primary/10 text-brand-primary rounded-2xl border border-brand-primary/20 shadow-sm">
                  <Folder size={28} />
                </div>
                <div className="pt-1 min-w-0">
                  <h3 className="font-bold text-text-primary text-lg leading-tight mb-1 truncate">{proj.name}</h3>
                  <p className="text-sm font-medium text-text-muted truncate">{proj.domain || 'General Research'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-text-secondary mb-8 bg-dark-elevated p-4 rounded-xl border border-dark-border">
                <span className="font-bold text-text-primary text-xs tracking-wider uppercase">{proj.status || 'PENDING'}</span>
                <span className="font-medium text-text-muted">
                  {new Date(proj.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <Link to={`/projects/${proj._id}/analysis`} className="mt-auto">
                <Button variant="secondary" className="w-full font-bold">Open Project</Button>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark-bg/80 backdrop-blur-sm" onClick={() => !isCreating && setIsModalOpen(false)}></div>
          <Card className="relative w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">Create New Project</h2>
              <button onClick={() => !isCreating && setIsModalOpen(false)} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={20} />
              </button>
            </div>
            {createError && <div className="mb-4 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{createError}</div>}
            <form onSubmit={handleCreateProject} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">Project Name <span className="text-brand-primary">*</span></label>
                <Input 
                  placeholder="e.g. Quantum Computing Survey" 
                  value={newProjectName} 
                  onChange={(e) => setNewProjectName(e.target.value)}
                  disabled={isCreating}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">Research Domain (Optional)</label>
                <Input 
                  placeholder="e.g. Physics" 
                  value={newProjectDomain} 
                  onChange={(e) => setNewProjectDomain(e.target.value)}
                  disabled={isCreating}
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)} disabled={isCreating}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={isCreating || !newProjectName.trim()}>
                  {isCreating ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
