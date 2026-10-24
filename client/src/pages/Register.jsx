import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { fetchApi } from '../utils/api';
import { AuthContext } from '../contexts/AuthContext';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      const data = await fetchApi('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });
      login(data.user, data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-dark-bg">
      <Card className="w-full max-w-md p-8 md:p-10 shadow-lg">
        <h2 className="text-3xl font-bold text-text-primary mb-8 text-center tracking-tight">Create Account</h2>
        {error && <div className="mb-4 text-red-500 text-sm text-center">{error}</div>}
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">Name</label>
            <Input type="text" placeholder="Dr. Jane Doe" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">Email</label>
            <Input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2 uppercase tracking-wide">Password</label>
            <Input type="password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button variant="primary" className="w-full py-3 text-base mt-2" type="submit" disabled={isLoading}>
            {isLoading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>
        <p className="text-center text-sm font-medium text-text-muted mt-8">
          Already have an account? <Link to="/login" className="text-brand-primary hover:text-brand-bright transition-colors">Log in</Link>
        </p>
      </Card>
    </div>
  );
}
