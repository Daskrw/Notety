"use client";
import { useState } from 'react';
import { useAuthStore } from '@/store/useStore';
import { Lock } from 'lucide-react';

export function Login() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Authentication failed');
      } else {
        if (isRegistering) {
          setIsRegistering(false);
          setError('Registration successful. Please login.');
          setPin(''); // clear pin for login
        } else {
          login(username);
        }
      }
    } catch (err) {
      setError('A network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-sm border border-stone-100 transition-all duration-300">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-stone-900 rounded-xl flex items-center justify-center">
            <Lock className="w-6 h-6 text-stone-50" />
          </div>
        </div>
        
        <h2 className="text-2xl font-heading font-medium text-center text-stone-800 mb-8">
          {isRegistering ? 'Create Vault' : 'Access Vault'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">Identifier</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-stone-400 focus:bg-white transition-all"
              placeholder="Username or Account ID"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-stone-400 focus:bg-white transition-all text-center tracking-[1em]"
              placeholder="••••"
              required
            />
          </div>
          
          {error && (
            <p className={`text-sm text-center ${error.includes('successful') ? 'text-green-500' : 'text-red-500'}`}>
              {error}
            </p>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-900 text-stone-50 py-3 rounded-lg font-medium hover:bg-stone-800 transition-colors mt-4 disabled:opacity-50"
          >
            {loading ? 'Processing...' : (isRegistering ? 'Create Account' : 'Unlock')}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button 
            type="button"
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
          >
            {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
          </button>
        </div>
      </div>
    </div>
  );
}
