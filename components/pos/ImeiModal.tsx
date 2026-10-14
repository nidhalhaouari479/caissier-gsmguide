'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Smartphone, X, ArrowRight, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CartItem } from '@/lib/pos/types';

interface ImeiModalProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  onApplyImei: (productId: string, imei: string) => void;
  defaultProductId?: string | null;
}

export function ImeiModal({ open, onClose, cart, onApplyImei, defaultProductId }: ImeiModalProps) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(defaultProductId || null);
  const [imeiValue, setImeiValue] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      if (defaultProductId) {
        setSelectedProductId(defaultProductId);
      } else if (cart.length === 1) {
        setSelectedProductId(cart[0].product.id);
      }
    }
  }, [open, defaultProductId]);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProductId) {
      onApplyImei(selectedProductId, imeiValue);
      toast({ description: "IMEI appliqué." });
      setImeiValue('');
      setSelectedProductId(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden border border-border bg-white dark:bg-zinc-900 rounded-lg shadow-xl">
        {/* Clean Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-slate-50/50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground uppercase tracking-tight">Saisir IMEI</DialogTitle>
              <DialogDescription className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Associer un IMEI à un article</DialogDescription>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleApply} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sélectionner un Article *</label>
              <select
                value={selectedProductId || ''}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full h-11 rounded-lg border border-border bg-transparent px-3 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                required
              >
                <option value="" disabled>-- Choisir un article --</option>
                {cart.map((item) => (
                  <option key={item.product.id} value={item.product.id}>
                    {item.product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Numéro IMEI *</label>
              <div className="relative group">
                <Input
                  type="text"
                  value={imeiValue}
                  onChange={(e) => setImeiValue(e.target.value)}
                  className="h-12 text-lg font-bold bg-transparent border-border focus-visible:ring-blue-500"
                  placeholder="Entrez le code IMEI..."
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 h-11 text-xs font-bold uppercase tracking-wider"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={!selectedProductId || !imeiValue}
                className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest gap-2 shadow-md active:scale-95 transition-all"
              >
                Appliquer <Check className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
