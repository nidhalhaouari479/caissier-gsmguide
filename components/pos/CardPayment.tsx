'use client';

import { Button } from '@/components/ui/button';
import { CreditCard, ArrowLeft, ArrowRight } from 'lucide-react';

interface CardPaymentProps {
  total: number;
  paymentMethodName: string;
  onPaymentComplete: () => void;
  onBack: () => void;
}

export function CardPayment({ total, paymentMethodName, onPaymentComplete, onBack }: CardPaymentProps) {
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground hover:text-blue-600 transition-colors uppercase tracking-widest"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour
        </button>
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-bold uppercase tracking-widest border border-blue-100 dark:border-blue-900/30">
          <CreditCard className="h-3.5 w-3.5" />
          {paymentMethodName}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-10 text-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 rounded-full animate-ping opacity-20" />
          <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-900/30 shadow-inner">
            <CreditCard className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        
        <div className="max-w-xs space-y-2">
          <h4 className="text-sm font-bold uppercase tracking-tight text-foreground">
            En attente du terminal
          </h4>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest leading-relaxed">
            Veuillez procéder au paiement sur le terminal de paiement électronique (TPE).
          </p>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-zinc-800/30 rounded-xl p-6 border border-border">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total à prélever</p>
            <p className="text-xs font-medium text-muted-foreground">Mode: {paymentMethodName}</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
              {total.toFixed(2)}
            </span>
            <span className="text-[10px] font-bold text-blue-600/60 dark:text-blue-400/60 ml-1 uppercase">DT</span>
          </div>
        </div>
      </div>

      <Button
        id="card-confirm-btn"
        onClick={onPaymentComplete}
        className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        Valider le règlement <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
