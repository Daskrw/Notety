"use client";
import { useState } from 'react';
import { Lock, User, Eye, EyeOff, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Tab = 'login' | 'register';

export function Login() {
  const [tab, setTab] = useState<Tab>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const email = (u: string) => `${u.toLowerCase().trim()}@quietnotes.app`;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email(username),
        password,
      });
      if (signInError) {
        setError(signInError.message.includes('Invalid login credentials')
          ? 'Incorrect username or password.'
          : signInError.message
        );
      }
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !displayName.trim() || !password) return;
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError('Username can only contain letters, numbers, and underscores.'); return; }

    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email(username),
        password,
        options: {
          data: {
            username: username.toLowerCase().trim(),
            display_name: displayName.trim(),
            avatar_seed: username.toLowerCase().trim(),
          },
        },
      });
      if (signUpError) {
        setError(signUpError.message.includes('already registered')
          ? 'That username is already taken. Please choose another.'
          : signUpError.message
        );
      }
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setError('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mb-4 shadow-lg bg-white border border-stone-100 flex items-center justify-center">
            <img src="/logo.png" alt="NotetyNew Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-heading font-semibold text-stone-800">NotetyNew</h1>
          <p className="text-sm text-stone-400 mt-1">Your personal note vault</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-stone-100">
            <button
              onClick={() => switchTab('login')}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                tab === 'login'
                  ? 'text-stone-900 bg-white border-b-2 border-stone-900'
                  : 'text-stone-400 hover:text-stone-600 bg-stone-50'
              }`}
            >
              <Lock className="w-3.5 h-3.5 inline mr-2" />
              Login
            </button>
            <button
              onClick={() => switchTab('register')}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                tab === 'register'
                  ? 'text-stone-900 bg-white border-b-2 border-stone-900'
                  : 'text-stone-400 hover:text-stone-600 bg-stone-50'
              }`}
            >
              <User className="w-3.5 h-3.5 inline mr-2" />
              Register
            </button>
          </div>

          {/* Login Form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400 focus:bg-white transition-all placeholder:text-stone-300"
                  placeholder="your_username"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 bg-stone-50 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400 focus:bg-white transition-all placeholder:text-stone-300"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-red-500 text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-stone-900 text-stone-50 py-2.5 rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 mt-2"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Register Form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400 focus:bg-white transition-all placeholder:text-stone-300"
                  placeholder="your_username"
                  autoComplete="username"
                  required
                />
                <p className="text-xs text-stone-400 mt-1">Letters, numbers, and underscores only.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400 focus:bg-white transition-all placeholder:text-stone-300"
                  placeholder="Your Name"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 bg-stone-50 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400 focus:bg-white transition-all placeholder:text-stone-300"
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm outline-none focus:border-stone-400 focus:bg-white transition-all placeholder:text-stone-300"
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  required
                />
              </div>
              {error && <p className="text-xs text-red-500 text-center">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-stone-900 text-stone-50 py-2.5 rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 mt-2"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
