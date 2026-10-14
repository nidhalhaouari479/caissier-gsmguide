'use client';

import { Button } from '@/components/ui/button';
import { Banknote, CreditCard, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OdooPaymentMethod {
  id: number;
  name: string;
  isCash: boolean;
}

interface PaymentMethodsProps {
  methods: OdooPaymentMethod[];
  isLoading: boolean;
  onMethodSelect: (method: OdooPaymentMethod) => void;
  disabled?: boolean;
}

export function PaymentMethods({ methods, isLoading, onMethodSelect, disabled = false }: PaymentMethodsProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-4 animate-in fade-in duration-300">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-[12px] font-bold uppercase tracking-widest">Chargement...</p>
      </div>
    );
  }

  if (methods.length === 0) {
    return (
      <div className="text-center p-6 text-red-600 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20 text-[10px] font-bold uppercase tracking-widest">
        Aucun mode de paiement configuré
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-4", disabled && "opacity-50 pointer-events-none")}>
      {methods.map((method) => {
        const isCash = method.isCash || method.name.toLowerCase().includes('espèce');
        const Icon = isCash ? Banknote : CreditCard;
        
        return (
          <button
            key={method.id}
            onClick={() => !disabled && onMethodSelect(method)}
            disabled={disabled}
            className="flex items-center gap-5 p-5 rounded-xl border border-border bg-white dark:bg-zinc-800/30 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-blue-500 hover:shadow-md transition-all group active:scale-[0.98] disabled:cursor-not-allowed"
          >
            <div className={cn(
              "p-3 rounded-xl transition-colors shadow-sm flex-shrink-0",
              isCash 
                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-100" 
                : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100"
            )}>
              <Icon className="h-6 w-6" />
            </div>
            
            <div className="text-left flex-1 min-w-0">
              <p className="text-[16px] font-bold text-foreground tracking-tight group-hover:text-blue-600 transition-colors truncate">{method.name}</p>
              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
                {isCash ? 'ESPÈCES' : 'TERMINAL'}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
