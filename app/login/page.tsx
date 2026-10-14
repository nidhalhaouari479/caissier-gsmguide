'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Lock, User, LogIn } from 'lucide-react';

interface POSConfig { id: number; name: string; }

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading, sessionId } = useAuth();
  const brandName = process.env.NEXT_PUBLIC_STORE_NAME || 'GSM GUIDE';
  const brandLogo = process.env.NEXT_PUBLIC_STORE_LOGO || '/gsmguidelogo.png';

  const db = process.env.NEXT_PUBLIC_ODOO_DB || 'odoo';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 2: POS session selection
  const [step, setStep] = useState<'login' | 'session'>('login');
  const [configs, setConfigs] = useState<POSConfig[]>([]);
  const [openingConfig, setOpeningConfig] = useState<number | null>(null);
  const [sessionError, setSessionError] = useState('');

  // If already authenticated, check for active session
  useEffect(() => {
    if (!authLoading && isAuthenticated && sessionId) {
      checkAndProceed(sessionId);
    }
  }, [authLoading, isAuthenticated, sessionId]);

  const checkAndProceed = async (sid: string) => {
    // Redirect to home, which will handle session check/opening
    router.push('/');
  };

  if (!authLoading && isAuthenticated && step === 'login') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await login(db, username, password);
      // After login, sessionId is now available via auth context; checkAndProceed fires via useEffect
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSession = async (configId: number) => {
    setOpeningConfig(configId);
    setSessionError('');
    try {
      const res = await fetch(`/api/odoo/pos-session?session_id=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/');
      } else {
        setSessionError(data.error || 'Erreur lors de l\'ouverture de la session.');
      }
    } catch {
      setSessionError('Erreur reseau.');
    } finally {
      setOpeningConfig(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1),transparent_60%)]" />
      </div>

      <div className="relative w-full max-w-md mx-4">
        <div className="backdrop-blur-xl bg-white/[0.07] border border-white/[0.14] rounded-2xl shadow-2xl p-8 ring-1 ring-blue-300/10">

          {step === 'login' ? (
            <>
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/95 shadow-lg shadow-blue-500/30 mb-4 border border-white/40 overflow-hidden">
                  <img
                    src={brandLogo}
                    alt={brandName}
                    className="h-14 w-14 object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <h1 className="text-3xl font-black text-white tracking-tight uppercase">{brandName}</h1>
                <p className="text-xs text-cyan-200/80 mt-1 font-bold uppercase tracking-[0.22em]">Tableau de bord caissier</p>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] mb-6">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-blue-200/50 truncate">{process.env.NEXT_PUBLIC_ODOO_URL || 'http://localhost:8069'}</span>
              </div>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-blue-200/70 uppercase tracking-wider">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300/40" />
                    <input id="pos-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-blue-200/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                      placeholder="e.g. admin" required autoComplete="username" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-blue-200/70 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300/40" />
                    <input id="pos-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-blue-200/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all"
                      placeholder="********" required autoComplete="current-password" />
                  </div>
                </div>
                <button id="pos-login-btn" type="submit" disabled={isLoading || !username || !password}
                  className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Connexion...</> : <><LogIn className="w-4 h-4" />Se connecter</>}
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
               <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
               <p className="text-white/60 text-sm animate-pulse">Initialisation du terminal...</p>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-blue-200/40 mt-6">{brandName} · Powered by Odoo 18</p>
      </div>
    </div>
  );
}

