'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Numberpad } from './Numberpad';
import { ArrowLeft, Banknote, Coins, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CashPaymentProps {
  total: number;
  onPaymentComplete: (change: number) => void;
  onBack: () => void;
}

export function CashPayment({ total, onPaymentComplete, onBack }: CashPaymentProps) {
  const [amount, setAmount] = useState<string>('');

  const amountNum = parseFloat(amount) || 0;
  const change = Math.max(0, amountNum - total);
  const isValid = amountNum >= total;

  const handleApplyPreset = (preset: number) => {
    setAmount(preset.toString());
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground hover:text-blue-600 transition-colors uppercase tracking-widest"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour
        </button>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-100 dark:border-emerald-900/30">
          <Banknote className="h-3.5 w-3.5" />
          Règlement Espèces
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Left: Input & Presets */}
        <div className="space-y-4 flex flex-col">
          <div className="bg-white dark:bg-zinc-800/30 rounded-xl p-6 space-y-5 border border-border shadow-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total à payer</p>
                <p className="text-xl font-black text-foreground tabular-nums">{total.toFixed(2)} <span className="text-[10px] font-bold text-muted-foreground uppercase">DT</span></p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rendu Client</p>
                <p className={cn(
                  "text-xl font-black tabular-nums transition-colors",
                  change > 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground/30"
                )}>
                  {change.toFixed(2)} <span className="text-[10px] font-bold uppercase">DT</span>
                </p>
              </div>
            </div>

            <div className="pt-5 border-t border-border/60">
               <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-900/50 rounded-xl p-4 border border-border shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                  <Coins className="h-5 w-5 text-muted-foreground" />
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Montant Saisi</p>
                    <span className="text-2xl font-black tabular-nums text-blue-600 dark:text-blue-400">{amountNum.toFixed(2)} <span className="text-xs uppercase ml-0.5">DT</span></span>
                  </div>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[10, 20, 50, 100].map((preset) => (
              <Button
                key={preset}
                variant="outline"
                onClick={() => handleApplyPreset(preset)}
                className="h-10 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all border-border rounded-lg"
              >
                +{preset} DT
              </Button>
            ))}
             <Button
                variant="outline"
                onClick={() => handleApplyPreset(total)}
                className="col-span-2 h-10 text-[10px] font-bold uppercase tracking-widest bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"
              >
                Montant Exact
              </Button>
          </div>

          <Button
            id="cash-confirm-btn"
            onClick={() => onPaymentComplete(change)}
            disabled={!isValid}
            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl mt-auto shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Confirmer l'encaissement <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Right: Numberpad Integration */}
        <div className="bg-white dark:bg-zinc-900 border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="px-4 py-3 bg-slate-50/50 dark:bg-zinc-800/50 border-b border-border flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Saisie Numérique</span>
          </div>
          <div className="flex-1">
            <Numberpad
              value={amount}
              label="Montant Reçu"
              onNumber={(d) => setAmount(prev => prev + d)}
              onBackspace={() => setAmount(prev => prev.slice(0, -1))}
              onClear={() => setAmount('')}
              onSubmit={() => {
                if (isValid) onPaymentComplete(change);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
