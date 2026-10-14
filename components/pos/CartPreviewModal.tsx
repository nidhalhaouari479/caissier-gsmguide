'use client';

import { CartItem } from '@/lib/pos/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShoppingBasket } from 'lucide-react';

interface CartPreviewModalProps {
  open: boolean;
  items: CartItem[];
  total: number;
  onClose: () => void;
}

export function CartPreviewModal({ open, items, total, onClose }: CartPreviewModalProps) {
  const lines = items.map((item) => {
    const gross = item.product.price * item.quantity;
    const discount = item.discountAmount || 0;
    const lineTotal = gross - discount;
    return {
      id: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: item.product.price,
      discount,
      lineTotal,
    };
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-white border-border">
        <DialogHeader className="px-6 py-4 border-b border-border bg-white">
          <DialogTitle className="flex items-center gap-2 text-base font-extrabold uppercase tracking-wide text-slate-800">
            <ShoppingBasket className="h-4 w-4 text-blue-600" />
            Panier Actuel
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 max-h-[62vh] overflow-y-auto">
          {lines.length === 0 ? (
            <div className="h-40 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-sm font-medium text-slate-500">
              Panier vide
            </div>
          ) : (
            <div className="space-y-3">
              {lines.map((line) => (
                <div
                  key={line.id}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{line.name}</p>
                    <p className="text-sm font-extrabold text-slate-900 whitespace-nowrap">
                      {line.lineTotal.toFixed(2)} DT
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Qte: {line.quantity} x {line.unitPrice.toFixed(2)} DT
                    {line.discount > 0 ? `  |  Remise: ${line.discount.toFixed(2)} DT` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border bg-slate-50">
          <div className="flex items-end justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Total Panier</p>
            <p className="text-2xl font-black text-blue-600 tabular-nums">{total.toFixed(2)} DT</p>
          </div>
          <Button
            type="button"
            onClick={onClose}
            className="h-11 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-wide"
          >
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
