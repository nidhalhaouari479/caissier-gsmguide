'use client';

import { useState, useEffect } from 'react';
import { Loader2, Store, Calculator, FileText, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Config { id: number; name: string; }
interface ActiveSession { id: number; name: string; configName: string; startedAt: string; }

interface CashierOpeningScreenProps {
  sessionId: string | null;
  cashierName: string;
  onSessionOpened: (session: ActiveSession) => void;
}

export function CashierOpeningScreen({ sessionId, cashierName, onSessionOpened }: CashierOpeningScreenProps) {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [existingSession, setExistingSession] = useState<ActiveSession | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<Config | null>(null);
  const [openingBalance, setOpeningBalance] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const brandName = process.env.NEXT_PUBLIC_STORE_NAME || 'GSM GUIDE';
  const brandLogo = process.env.NEXT_PUBLIC_STORE_LOGO || '/gsmguidelogo.png';

  useEffect(() => {
    if (sessionId) fetchConfigs();
  }, [sessionId]);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/odoo/pos-session?session_id=${sessionId}`);
      const data = await res.json();
      // If backend returns any existing session, do NOT ask opening fund again.
      if (data.session) {
        setExistingSession(data.session);
      } else {
        setExistingSession(null);
      }
      const cfgs: Config[] = data.configs || [];
      setConfigs(cfgs);

      // If we have an active session that needs opening control, pre-select its config
      if (data.hasActiveSession && data.session && data.needsOpeningControl) {
        const activeCfg = cfgs.find(c => c.id === data.session.config_id[0]);
        if (activeCfg) {
          setSelectedConfig(activeCfg);
        }
      } else if (cfgs.length === 1) {
        setSelectedConfig(cfgs[0]);
      }
    } catch {
      setError('Impossible de rÃ©cupÃ©rer les caisses.');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!selectedConfig) return;
    setOpening(true);
    setError(null);
    
    // Clean input: remove spaces, replace comma with dot
    const cleanedBalance = openingBalance.replace(/\s/g, '').replace(',', '.');
    const balanceNum = parseFloat(cleanedBalance) || 0;

    try {
      const res = await fetch(`/api/odoo/pos-session?session_id=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: selectedConfig.id,
          openingBalance: balanceNum,
          note: note.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.session) {
        if (typeof window !== 'undefined' && data.session.id) {
          localStorage.setItem(`pos_opening_balance:${data.session.id}`, String(balanceNum));
        }
        onSessionOpened(data.session);
      } else {
        setError(data.error || "Erreur lors de l'ouverture.");
      }
    } catch {
      setError('Erreur rÃ©seau.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex flex-col items-center justify-center p-6">
      
      {/* Top greeting */}
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-white shadow-lg border border-blue-100 flex items-center justify-center overflow-hidden">
          <img
            src={brandLogo}
            alt={brandName}
            className="h-12 w-12 object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        <p className="text-blue-600 text-xs font-black uppercase tracking-[0.26em] mb-2">{brandName}</p>
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Tableau de bord caissier</h1>
        <p className="text-slate-500 text-sm mt-2">Bienvenue, {cashierName}. Remplissez les informations avant d'ouvrir la caisse.</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md space-y-4 bg-white/95 border border-slate-200 rounded-2xl shadow-xl ring-1 ring-blue-100/60 p-6">
        {/* Existing opened session */}
        {!loading && existingSession && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 mb-2">
                Session dÃ©jÃ  ouverte
              </p>
              <p className="text-slate-900 font-black text-sm uppercase tracking-tight">{existingSession.name}</p>
            </div>
            <Button
              onClick={() => onSessionOpened(existingSession)}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest rounded-lg"
            >
              Reprendre la Caisse
            </Button>
          </div>
        )}

        {/* Caisse selector â€” shown only if multiple configs */}
        {!loading && !existingSession && configs.length > 1 && (
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block">
              Choisir la caisse
            </label>
            <div className="space-y-2">
              {configs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedConfig(c)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left ${
                    selectedConfig?.id === c.id
                      ? 'border-blue-300 bg-blue-50 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <Store className="h-4 w-4 flex-shrink-0 text-blue-600" />
                  <span className="font-bold text-sm uppercase tracking-tight">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected caisse info (when only one) */}
        {!loading && !existingSession && configs.length === 1 && selectedConfig && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50">
            <Store className="h-4 w-4 text-blue-600" />
            <span className="font-black text-sm text-slate-900 uppercase tracking-tight">{selectedConfig.name}</span>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-slate-500 text-sm">Chargement...</span>
          </div>
        )}

        {!loading && !existingSession && configs.length === 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
            Aucune caisse ne vous est assignee. Verifiez le nom de la caisse dans Odoo (ex: ...-riadh).
          </div>
        )}

        {/* â”€â”€ INPUT 1 : Fonds de caisse â”€â”€ */}
        {!loading && !existingSession && (
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block">
              Fonds de caisse initial
            </label>
            <div className="relative">
              <Calculator className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-600" />
              <input
                type="number"
                step="0.01"
                min="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full h-16 text-xl font-semibold pl-12 pr-16 rounded-2xl border-2 border-slate-200 focus:border-blue-500 outline-none bg-white text-slate-900 transition-all placeholder:text-slate-300 appearance-none"
                placeholder="0.00"
                autoFocus
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 font-black text-sm">DT</span>
            </div>
          </div>
        )}

        {/* â”€â”€ INPUT 2 : Note d'ouverture â”€â”€ */}
        {!loading && !existingSession && (
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block">
              Note d'ouverture <span className="text-slate-400 normal-case font-normal">(optionnel)</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-200 focus:border-blue-500 outline-none bg-white text-slate-900 text-sm transition-all placeholder:text-slate-300 resize-none"
                placeholder="Ex: Monnaie vÃ©rifiÃ©e, caisse OK..."
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 px-4 py-3 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* â”€â”€ BUTTON : Next / Start â”€â”€ */}
        {!loading && !existingSession && (
          <Button
            onClick={handleStart}
            disabled={opening || !selectedConfig}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-widest rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3"
          >
            {opening ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <span>Ouvrir la Caisse</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </Button>
        )}
      </div>

      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-8">
        {brandName} · Powered by Odoo 18
      </p>
    </div>
  );
}

