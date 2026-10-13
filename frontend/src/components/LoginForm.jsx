import React, { useState, useEffect } from 'react';
import { Lock, Mail, User, ShieldCheck, AlertCircle, Building2, Landmark, ArrowRight, Loader2 } from 'lucide-react';
import { authAPI } from '../services/api.js';
import { ThemeToggle } from './ThemeToggle.jsx';
import pixxLogo from '../assets/logo.png';

export function LoginForm({ onLoginSuccess }) {
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkInitialSetup = async () => {
      try {
        const res = await authAPI.checkSetup();
        if (res?.data?.needsSetup) {
          setIsSetupMode(true);
        }
      } catch (err) {
        console.error('Setup check error:', err);
      } finally {
        setCheckingSetup(false);
      }
    };
    checkInitialSetup();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSetupMode) {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      setLoading(true);
      try {
        const res = await authAPI.setupInitialUser({
          name: name.trim(),
          email: email.trim(),
          password,
        });

        if (res?.success && res?.data?.token) {
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          onLoginSuccess(res.data.user);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to complete initial operator setup.');
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        const res = await authAPI.login({
          email: email.trim(),
          password,
        });

        if (res?.success && res?.data?.token) {
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          onLoginSuccess(res.data.user);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Invalid email or password.');
      } finally {
        setLoading(false);
      }
    }
  };

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-sm font-medium">Connecting to UK Property Finance System...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4 relative">
      {/* Top Right Mood / Theme Change Button */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl shadow-indigo-600/10 mb-3.5">
            <img src={pixxLogo} alt="Pixx Technologies UK" className="h-16 w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">PIXX TECHNOLOGIES UK</h1>
          <p className="text-xs font-semibold text-indigo-400 tracking-wider uppercase mt-1">
            Property Finance &amp; Mortgage System
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              {isSetupMode ? 'Initial Operator Setup' : 'Authorized Sign In'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {isSetupMode
                ? 'Create the primary authorized account for this UK property management system.'
                : 'Sign in to access your properties, rent collections, and mortgage ledgers.'}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSetupMode && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Operator Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Portfolio Manager"
                    className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@propertyfinance.co.uk"
                  className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {isSetupMode && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 disabled:opacity-50 text-sm cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isSetupMode ? 'Configuring Account...' : 'Authenticating...'}</span>
                </>
              ) : (
                <>
                  <span>{isSetupMode ? 'Create Authorized Account' : 'Sign In to UK Portal'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-indigo-400" />
              <span>GBP Currency (£) · Strict Double-Entry Financial Engine</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
