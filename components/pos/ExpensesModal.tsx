'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowRightLeft, CheckCircle2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExpensesModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
}

export function ExpensesModal({ open, onClose, sessionId }: ExpensesModalProps) {
  const [type, setType] = useState<'out' | 'in'>('out');
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast({
        variant: "destructive",
        description: "Veuillez entrer un montant valide.",
      });
      return;
    }
    if (!reason.trim()) {
      toast({
        variant: "destructive",
        description: "Veuillez entrer un motif.",
      });
      return;
    }
    if (!sessionId) {
      toast({
        variant: "destructive",
        description: "Aucune session active.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const value = type === 'out' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));

      const res = await fetch(`/api/odoo/session/cash-in-out?session_id=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: value, reason }),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          description: type === 'out' ? "Dépense enregistrée avec succès." : "Entrée enregistrée avec succès.",
        });
        setAmount('');
        setReason('');
        onClose();
      } else {
        toast({
          variant: "destructive",
          description: data.error || "Erreur lors de l'enregistrement.",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        description: "Erreur réseau.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val && !isSubmitting) onClose(); }}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden border border-border bg-white dark:bg-zinc-900 rounded-lg shadow-xl">
        {/* Clean Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-slate-50/50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <ArrowRightLeft className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground uppercase tracking-tight">Mouvement de Caisse</DialogTitle>
              <DialogDescription className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Entrée ou sortie de fonds</DialogDescription>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Type Selector */}
          <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg">
            <button
              onClick={() => setType('out')}
              className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                type === 'out' ? 'bg-white dark:bg-zinc-700 shadow-sm text-red-600 dark:text-red-400' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sortie (Dépense)
            </button>
            <button
              onClick={() => setType('in')}
              className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                type === 'in' ? 'bg-white dark:bg-zinc-700 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Entrée (Fonds)
            </button>
          </div>

          <div className="space-y-5">
            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Montant
              </label>
              <div className="relative group">
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-12 text-xl font-bold pl-4 pr-12 rounded-lg border-border focus-visible:ring-blue-500 transition-all bg-transparent"
                  placeholder="0.00"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground group-focus-within:text-blue-600 transition-colors">DT</div>
              </div>
            </div>

            {/* Reason Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Motif du mouvement
              </label>
              <Input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-12 text-sm font-medium px-4 rounded-lg border-border focus-visible:ring-blue-500 transition-all bg-transparent"
                placeholder={type === 'out' ? "Ex: Achat fournitures, Café..." : "Ex: Ajout fonds de caisse"}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-zinc-800/30 flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={isSubmitting}
            className="text-xs font-bold uppercase tracking-wider h-10 border-border hover:bg-slate-100"
          >
            Annuler
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !amount || !reason}
            className={`h-10 px-6 text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-md transition-all active:scale-95 ${
              type === 'out' 
                ? 'bg-red-600 hover:bg-red-700 shadow-red-200 dark:shadow-none' 
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 dark:shadow-none'
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            {type === 'out' ? 'Valider la sortie' : 'Valider l\'entrée'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
