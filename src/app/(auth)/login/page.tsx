// src/app/(auth)/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const isDev = process.env.NODE_ENV !== 'production';
  const [email, setEmail] = useState(isDev ? 'owner@tradestock.com' : '');
  const [password, setPassword] = useState(isDev ? 'password123' : '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fc] relative overflow-hidden flex flex-col justify-center items-center p-4">
      {/* Subtle ambient gradient mesh */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-[#3563e9]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-[#7656e8]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#3563e9] to-[#7656e8] text-white shadow-xl shadow-[#3563e9]/25 mb-4 card-3d">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">TradeStock Pro</h1>
          <p className="text-slate-500 text-sm mt-1">Trading Shop Inventory & Billing System</p>
        </div>

        {/* Card */}
        <div className="card-3d bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Owner Sign In</h2>
            <p className="text-xs text-slate-500 mt-1">Sign in with your shop owner credentials to access the panel.</p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Shop Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="owner@tradestock.com"
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-[#3563e9] to-[#7656e8] hover:opacity-95 active:scale-[0.99] disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-[#3563e9]/25 transition-all focus:outline-none focus:ring-2 focus:ring-[#3563e9] focus:ring-offset-2"
            >
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {isDev && (
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                Development Credentials: <code className="text-[#3563e9] bg-[#3563e9]/10 px-2 py-0.5 rounded-md font-mono font-medium border border-[#3563e9]/20">owner@tradestock.com</code> / <code className="text-[#3563e9] bg-[#3563e9]/10 px-2 py-0.5 rounded-md font-mono font-medium border border-[#3563e9]/20">password123</code>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
