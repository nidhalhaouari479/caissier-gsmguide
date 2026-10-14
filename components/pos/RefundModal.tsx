'use client';

import { useState, useEffect, useCallback } from 'react';
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
import {
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  ChevronLeft,
  Package,
  X,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface OrderLine {
  id: number;
  productId: number;
  productName: string;
  qty: number;
  price: number;
  discount: number;
  total: number;
}

interface PastOrder {
  id: number;
  name: string;
  reference: string;
  date: string;
  total: number;
  partner: string | null;
  lines: OrderLine[];
}

interface SelectedLine {
  lineId: number;
  productId: number;
  productName: string;
  qty: number;
  price: number;
  discount: number;
}

interface RefundModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onRefreshSession?: () => void;
  sessionId: string | null;
  uid: number | null;
}

export function RefundModal({ open, onClose, onSuccess, onRefreshSession, sessionId, uid }: RefundModalProps) {
  const [step, setStep] = useState<'search' | 'select'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<PastOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PastOrder | null>(null);
  const [selectedLines, setSelectedLines] = useState<Map<number, SelectedLine>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setStep('search');
      setSearchQuery('');
      setOrders([]);
      setSelectedOrder(null);
      setSelectedLines(new Map());
      setError(null);
    }
  }, [open]);

  const handleSearch = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ session_id: sessionId });
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await fetch(`/api/odoo/refund?${params}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
        if (data.orders.length === 0) setError('Aucune commande trouvée.');
      } else {
        setError(data.error || 'Erreur lors de la recherche.');
      }
    } catch {
      setError('Erreur de connexion.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, searchQuery]);

  useEffect(() => {
    if (open && sessionId) {
      handleSearch();
    }
  }, [open, sessionId]);

  const handleSelectOrder = (order: PastOrder) => {
    setSelectedOrder(order);
    const map = new Map<number, SelectedLine>();
    for (const line of order.lines) {
      map.set(line.id, {
        lineId: line.id,
        productId: line.productId,
        productName: line.productName,
        qty: line.qty,
        price: line.price,
        discount: line.discount,
      });
    }
    setSelectedLines(map);
    setStep('select');
  };

  const toggleLine = (line: OrderLine) => {
    setSelectedLines((prev) => {
      const next = new Map(prev);
      if (next.has(line.id)) {
        next.delete(line.id);
      } else {
        next.set(line.id, {
          lineId: line.id,
          productId: line.productId,
          productName: line.productName,
          qty: line.qty,
          price: line.price,
          discount: line.discount,
        });
      }
      return next;
    });
  };

  const updateQty = (lineId: number, qty: number) => {
    setSelectedLines((prev) => {
      const next = new Map(prev);
      const line = next.get(lineId);
      if (line) {
        next.set(lineId, { ...line, qty: Math.max(1, qty) });
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!selectedOrder || selectedLines.size === 0 || !sessionId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/odoo/refund?session_id=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalOrderId: selectedOrder.id,
          lines: Array.from(selectedLines.values()),
          uid,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ description: `Retour enregistré : ${data.refund.reference}` });
        onSuccess(`Retour créé : ${data.refund.reference}`);
        onClose();
      } else {
        toast({ variant: "destructive", description: data.error || 'Erreur lors du retour.' });
      }
    } catch {
      toast({ variant: "destructive", description: 'Erreur réseau.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const refundTotal = Array.from(selectedLines.values()).reduce((sum, l) => {
    return sum + l.price * l.qty * (1 - (l.discount || 0) / 100);
  }, 0);

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val && !isSubmitting) onClose(); }}>
      <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden border border-border bg-white dark:bg-zinc-900 rounded-lg shadow-xl flex flex-col h-[85vh]">
        {/* Clean Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-slate-50/50 dark:bg-zinc-800/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <RotateCcw className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground uppercase tracking-tight">Retour / Remboursement</DialogTitle>
              <DialogDescription className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Rechercher et traiter un retour</DialogDescription>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {step === 'search' && (
            <>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Référence ou numéro de commande..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 h-11 text-sm rounded-lg border-border bg-transparent"
                  />
                </div>
                <Button onClick={handleSearch} disabled={loading} className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rechercher'}
                </Button>
              </div>

              {error && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-lg text-red-800 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <p className="text-xs font-medium">{error}</p>
                  </div>
                  {(error.toLowerCase().includes('fermée') || error.toLowerCase().includes('fermé') || error.toLowerCase().includes('closed')) && (
                    <Button 
                      onClick={() => {
                        onClose();
                        if (onRefreshSession) onRefreshSession();
                      }} 
                      variant="outline" 
                      className="w-full text-[10px] font-bold uppercase tracking-widest h-10"
                    >
                      Session fermée ? Réinitialiser
                    </Button>
                  )}
                </div>
              )}

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Recherche...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {orders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => handleSelectOrder(order)}
                      className="flex items-center justify-between p-4 rounded-lg border border-border bg-slate-50/50 dark:bg-zinc-800/30 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-left group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs">{order.reference}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 truncate">
                          {new Date(order.date).toLocaleDateString()} {order.partner ? `· ${order.partner}` : ''}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold text-sm text-blue-600">{order.total.toFixed(2)} DT</p>
                        <p className="text-[10px] font-bold text-blue-500 uppercase mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Choisir →</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'select' && selectedOrder && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <button
                onClick={() => setStep('search')}
                className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-widest"
              >
                <ChevronLeft className="h-3 w-3" /> Retour
              </button>

              <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-border">
                <p className="text-xs font-bold">{selectedOrder.reference}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">{new Date(selectedOrder.date).toLocaleString()}</p>
              </div>

              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Package className="h-3 w-3" /> Articles à retourner
                </h3>
                <div className="space-y-1">
                  {selectedOrder.lines.map((line) => {
                    const isSelected = selectedLines.has(line.id);
                    const selLine = selectedLines.get(line.id);
                    return (
                      <div
                        key={line.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer',
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-900/30'
                            : 'bg-transparent border-border hover:bg-slate-50 dark:hover:bg-zinc-800'
                        )}
                        onClick={() => toggleLine(line)}
                      >
                        <div className={cn('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0', isSelected ? 'bg-blue-600 border-blue-600' : 'border-border')}>
                          {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs truncate">{line.productName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {line.price.toFixed(2)} DT × {line.qty}
                            {line.discount ? ` (-${line.discount}%)` : ''}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="w-6 h-6 rounded bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 flex items-center justify-center font-bold text-xs"
                              onClick={() => updateQty(line.id, (selLine?.qty || 1) - 1)}
                            >
                              −
                            </button>
                            <span className="w-4 text-center font-bold text-xs">{selLine?.qty || 1}</span>
                            <button
                              className="w-6 h-6 rounded bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 flex items-center justify-center font-bold text-xs"
                              onClick={() => updateQty(line.id, (selLine?.qty || 1) + 1)}
                              disabled={(selLine?.qty || 0) >= line.qty}
                            >
                              +
                            </button>
                          </div>
                        )}
                        <span className="font-bold text-xs ml-2">{line.total.toFixed(2)} DT</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20 mt-auto">
                <span className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-widest">Total à rembourser</span>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">−{refundTotal.toFixed(2)} DT</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border bg-slate-50/50 dark:bg-zinc-800/30 flex justify-end gap-3 flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="text-xs font-bold uppercase tracking-wider h-10 border-border">
            Annuler
          </Button>
          {step === 'select' && (
            <Button
              onClick={handleSubmit}
              disabled={selectedLines.size === 0 || isSubmitting}
              className="h-10 px-8 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-md flex items-center gap-2 transition-all active:scale-95"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Confirmer le retour
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
