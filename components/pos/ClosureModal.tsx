'use client';

import { useState, useEffect } from 'react';
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
  Calculator, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Wallet, 
  TrendingUp, 
  History,
  Info,
  Printer,
  ArrowRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ClosureSummary {
  id: number;
  name: string;
  cashierName?: string | null;
  opened_at: string;
  opening_balance: number;
  total_payments: number;
  expected_cash: number;
  sold_products?: Array<{
    name: string;
    qty: number;
    unit_price: number;
    gross: number;
    discount: number;
    net: number;
  }>;
  sales?: {
    gross: number;
    discount: number;
    net: number;
    qty: number;
    order_count: number;
  };
  payments: Array<{
    method: string;
    amount: number;
    methodId: number;
  }>;
}

interface ClosureModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onReset?: () => void;
  sessionId: string | null;
  posSessionId?: number | null;
}

export function ClosureModal({ open, onClose, onSuccess, onReset, sessionId, posSessionId }: ClosureModalProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ClosureSummary | null>(null);
  const [realCash, setRealCash] = useState<string>('');
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && sessionId) {
      fetchSummary();
    } else {
      setSummary(null);
      setRealCash('');
      setError(null);
      setIsDone(false);
    }
  }, [open, sessionId, posSessionId]);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const target = posSessionId ? `&pos_session_id=${posSessionId}` : '';
      let openingOverride = '';
      if (typeof window !== 'undefined' && posSessionId) {
        openingOverride = localStorage.getItem(`pos_opening_balance:${posSessionId}`) || '';
      }
      const overrideParam = openingOverride ? `&opening_override=${encodeURIComponent(openingOverride)}` : '';
      const res = await fetch(`/api/odoo/session?session_id=${sessionId}&summary=true${target}${overrideParam}`);
      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
        setRealCash('');
      } else if (data.no_active_pos_session) {
        toast({ description: "Aucune session active." });
        setError("Aucune session active.");
        return;
      } else {
        const err = String(data.error || "Erreur de rÃ©cupÃ©ration du rÃ©sumÃ©.");
        const lower = err.toLowerCase();
        const isAlreadyClosed =
          lower.includes('fermÃ©e') ||
          lower.includes('fermee') ||
          lower.includes('fermÃ©') ||
          lower.includes('closed') ||
          lower.includes('no open pos session');

        if (isAlreadyClosed) {
          toast({ description: "Cette session est déjà fermée." });
          setError("Cette session est déjà fermée.");
          return;
        }

        setError(err);
      }
    } catch (err) {
      setError("Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!summary || isClosing) return;
    
    setIsClosing(true);
    try {
      const res = await fetch(`/api/odoo/session?session_id=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closingBalance: parseFloat(realCash) || 0,
          posSessionId: posSessionId || null,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        handlePrintClosure();
        setIsDone(true);
        toast({ description: "Session clÃ´turÃ©e avec succÃ¨s." });
      } else {
        const errorMsg = data.error || "Erreur de clÃ´ture.";
        const lower = errorMsg.toLowerCase();
        const isAlreadyClosed =
          lower.includes('fermÃ©e') ||
          lower.includes('fermÃ©') ||
          lower.includes('closed') ||
          lower.includes('no open pos session');

        if (isAlreadyClosed) {
          // Session is already terminated on Odoo side: keep user in final closure step.
          handlePrintClosure();
          setIsDone(true);
          toast({ description: "La session est déjà fermée. Cliquez sur Fermer." });
          return;
        }
        toast({ variant: "destructive", description: errorMsg });
      }
    } catch (err) {
      toast({ variant: "destructive", description: "Erreur rÃ©seau." });
    } finally {
      setIsClosing(false);
    }
  };

  const handlePrintClosure = () => {
    if (!summary) return;

    const storeName = process.env.NEXT_PUBLIC_STORE_NAME || 'GSM Guide';
    const storeAddress = process.env.NEXT_PUBLIC_STORE_ADDRESS || '';
    const storePhone = process.env.NEXT_PUBLIC_STORE_PHONE || '';
    const storeEmail = process.env.NEXT_PUBLIC_STORE_EMAIL || '';
    const storeFooter = process.env.NEXT_PUBLIC_STORE_FOOTER || 'Merci pour votre confiance';
    const logoSrc = process.env.NEXT_PUBLIC_STORE_LOGO || '/gsmguidelogo.png';
    const dateStr = new Date().toLocaleString('fr-FR');
    const openedAt = summary.opened_at ? new Date(summary.opened_at).toLocaleString('fr-FR') : '-';

    const paymentRows = summary.payments.map((p) => `
      <div class="ticket-row">
        <span>${p.method}</span>
        <span>${p.amount.toFixed(2)} DT</span>
      </div>
    `).join('');

    const productRows = (summary.sold_products || []).map((p) => `
      <div class="product-block">
        <div class="ticket-row bold">
          <span class="product-name">${p.name}</span>
          <span>${p.net.toFixed(2)} DT</span>
        </div>
        <div class="ticket-row-meta">QTE: ${p.qty.toFixed(0)} x ${p.unit_price.toFixed(2)} DT</div>
        ${p.discount > 0 ? `<div class="ticket-row-meta">REMISE: -${p.discount.toFixed(2)} DT</div>` : ''}
      </div>
    `).join('');

    const salesGross = summary.sales?.gross || 0;
    const salesDiscount = summary.sales?.discount || 0;
    const salesNet = summary.sales?.net || 0;
    const salesQty = summary.sales?.qty || 0;
    const salesOrders = summary.sales?.order_count || 0;

    const ticketHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cloture - ${summary.name}</title>
        <meta charset="UTF-8"/>
        <style>
          body { font-family: 'Courier New', Courier, monospace; font-size: 13px; width: 80mm; padding: 5mm; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .header { margin-bottom: 5mm; }
          .divider { border-top: 1px dashed #000; margin: 3mm 0; }
          .ticket-row { display: flex; justify-content: space-between; margin-top: 2mm; }
          .ticket-row-meta { font-size: 11px; margin-top: 1mm; color: #333; }
          .product-block { margin-top: 2mm; }
          .product-name { max-width: 50mm; display: inline-block; }
          .logo-ticket { max-width: 40mm; height: auto; margin-bottom: 2mm; }
          @media print { body { width: 80mm; padding: 2mm; } @page { margin: 0; size: 80mm auto; } }
        </style>
      </head>
      <body>
        <div class="header center">
          <img src="${logoSrc}" class="logo-ticket" onerror="this.style.display='none'"/>
          <div class="bold" style="font-size: 16px;">${storeName}</div>
          <div>${storeAddress}</div>
          ${storePhone ? `<div>Tel: ${storePhone}</div>` : ''}
          ${storeEmail ? `<div>Email: ${storeEmail}</div>` : ''}
          <div class="divider"></div>
          <div class="bold">RAPPORT DE CLOTURE</div>
          <div class="bold">${summary.name}</div>
          <div>Caissier: ${summary.cashierName || '-'}</div>
          <div>Ouverture: ${openedAt}</div>
          <div>Cloture: ${dateStr}</div>
        </div>
        <div class="divider"></div>
        <div class="ticket-row"><span>Fonds initial</span><span>${summary.opening_balance.toFixed(2)} DT</span></div>
        <div class="ticket-row"><span>Nb ventes</span><span>${salesOrders}</span></div>
        <div class="ticket-row"><span>Quantite vendue</span><span>${salesQty.toFixed(0)}</span></div>
        <div class="ticket-row"><span>Ventes brutes</span><span>${salesGross.toFixed(2)} DT</span></div>
        <div class="ticket-row"><span>Remises</span><span>-${salesDiscount.toFixed(2)} DT</span></div>
        <div class="ticket-row bold"><span>Ventes nettes</span><span>${salesNet.toFixed(2)} DT</span></div>
        <div class="divider"></div>
        <div class="bold">DETAIL PRODUITS VENDUS:</div>
        ${productRows || '<div class="ticket-row-meta">Aucun produit.</div>'}
        <div class="divider"></div>
        <div class="bold">DETAIL PAIEMENTS:</div>
        ${paymentRows}
        <div class="divider"></div>
        <div class="ticket-row"><span>Especes attendues</span><span>${expectedCash.toFixed(2)} DT</span></div>
        <div class="ticket-row bold"><span>Especes reelles</span><span>${realCashValue.toFixed(2)} DT</span></div>
        <div class="ticket-row bold" style="color: ${difference >= 0 ? 'green' : 'red'};"><span>Difference</span><span>${difference >= 0 ? '+' : ''}${difference.toFixed(2)} DT</span></div>
        <div class="divider"></div>
        <div class="center">
          <div>${storeFooter}</div>
          <div style="margin-top: 3mm; font-size: 10px;">Session ID: ${summary.id}</div>
        </div>
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none'; iframe.style.left = '-9999px';
    document.body.appendChild(iframe);
    if (iframe.contentWindow) {
      iframe.contentWindow.document.open(); iframe.contentWindow.document.write(ticketHtml); iframe.contentWindow.document.close();
      iframe.contentWindow.focus();
      setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 500);
    }
  };

  const expectedCash = summary?.expected_cash || 0;
  const realCashValue = parseFloat(realCash) || 0;
  const difference = realCashValue - expectedCash;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val && !isClosing && !isDone) onClose(); }}>
      <DialogContent
        className="max-w-xl gap-0 p-0 overflow-hidden border border-border bg-white dark:bg-zinc-900 rounded-lg shadow-xl"
        onPointerDownOutside={(e) => { if (isDone) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (isDone) e.preventDefault(); }}
      >
        {/* Clean Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-slate-50/50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Calculator className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground uppercase tracking-tight">Fin de Session</DialogTitle>
              <DialogDescription className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">ClÃ´ture et vÃ©rification des fonds</DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Calcul des totaux...</p>
            </div>
          ) : error ? (
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 p-4 rounded-lg flex items-center gap-3 text-red-700 dark:text-red-400">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
              {(error.toLowerCase().includes('fermÃ©e') || error.toLowerCase().includes('fermÃ©') || error.toLowerCase().includes('closed')) && (
                <Button 
                  onClick={onReset || onSuccess} 
                  className="w-full h-12 bg-slate-900 dark:bg-zinc-800 text-white font-bold uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-colors"
                >
                  DÃ©marrer une nouvelle session
                </Button>
              )}
            </div>
          ) : summary && (
            <div className="space-y-6">
              {!isDone ? (
                <div className="space-y-4">
                  <div className="p-6 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-border">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-4 text-center">
                      Saisir le total espÃ¨ces en caisse
                    </label>
                    <div className="relative max-w-[240px] mx-auto">
                      <Input
                        type="number"
                        step="0.01"
                        value={realCash}
                        onChange={(e) => setRealCash(e.target.value)}
                        className="h-16 text-3xl font-bold px-4 text-center rounded-lg border-border focus-visible:ring-blue-500 transition-all bg-white dark:bg-zinc-900"
                        placeholder="0.00"
                        autoFocus
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">DT</div>
                    </div>
                  </div>


                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 p-5 rounded-lg flex items-center gap-4 text-emerald-800 dark:text-emerald-400">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-tight">Session ClÃ´turÃ©e</h3>
                      <p className="text-[10px] font-medium opacity-80">Rapport de clÃ´ture prÃªt pour impression.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 bg-slate-50 dark:bg-zinc-800/30 rounded-lg border border-border">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Espèces Attendues</p>
                      <p className="text-lg font-bold">{expectedCash.toFixed(2)} DT</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-zinc-800/30 rounded-lg border border-border">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Espèces Réelles</p>
                      <p className="text-lg font-bold">{realCashValue.toFixed(2)} DT</p>
                    </div>
                    <div className={`p-4 rounded-lg border ${
                      difference === 0
                        ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                        : difference > 0
                          ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                          : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                    }`}>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Différence</p>
                      <p className={`text-lg font-bold ${
                        difference === 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : difference > 0
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}>
                        {difference >= 0 ? '+' : ''}{difference.toFixed(2)} DT
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-zinc-800/30 rounded-lg border border-border space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">RÃ©sumÃ© des ventes</p>
                    <div className="flex justify-between text-xs"><span>Caissier</span><span className="font-bold">{summary.cashierName || '-'}</span></div>
                    <div className="flex justify-between text-xs"><span>Nombre de ventes</span><span className="font-bold">{summary.sales?.order_count || 0}</span></div>
                    <div className="flex justify-between text-xs"><span>QuantitÃ© vendue</span><span className="font-bold">{(summary.sales?.qty || 0).toFixed(0)}</span></div>
                    <div className="flex justify-between text-xs"><span>Ventes brutes</span><span className="font-bold">{(summary.sales?.gross || 0).toFixed(2)} DT</span></div>
                    <div className="flex justify-between text-xs"><span>Remises</span><span className="font-bold">-{(summary.sales?.discount || 0).toFixed(2)} DT</span></div>
                    <div className="flex justify-between text-xs"><span>Ventes nettes</span><span className="font-bold">{(summary.sales?.net || 0).toFixed(2)} DT</span></div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-3 w-3" /> Produits vendus
                    </h4>
                    <div className="grid grid-cols-1 gap-1">
                      {(summary.sold_products || []).map((p, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 dark:bg-zinc-800/30 border border-border rounded-lg">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="max-w-[70%] truncate">{p.name}</span>
                            <span>{p.net.toFixed(2)} DT</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1">
                            QtÃ©: {p.qty.toFixed(0)} x {p.unit_price.toFixed(2)} DT
                            {p.discount > 0 ? `  |  Remise: -${p.discount.toFixed(2)} DT` : ''}
                          </div>
                        </div>
                      ))}
                      {(summary.sold_products || []).length === 0 && (
                        <div className="p-3 text-xs text-muted-foreground bg-slate-50 dark:bg-zinc-800/30 border border-border rounded-lg">
                          Aucune ligne produit trouvÃ©e pour cette session.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Wallet className="h-3 w-3" /> Modes de rÃ¨glement
                    </h4>
                    <div className="grid grid-cols-1 gap-1">
                      {summary.payments.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-800/30 border border-border rounded-lg">
                          <span className="text-xs font-medium">{p.method}</span>
                          <span className="text-xs font-bold">{p.amount.toFixed(2)} DT</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border bg-slate-50/50 dark:bg-zinc-800/30 flex justify-end gap-3">
          {!isDone ? (
            <>
              <Button 
                variant="outline" 
                onClick={onClose} 
                disabled={isClosing}
                className="text-xs font-bold uppercase tracking-wider h-10 border-border"
              >
                Annuler
              </Button>
              <Button 
                onClick={handleConfirm} 
                disabled={loading || !!error || isClosing || !realCash}
                className="h-10 px-8 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-md flex items-center gap-2 transition-all active:scale-95"
              >
                {isClosing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                ClÃ´turer & Imprimer
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={onSuccess} 
                className="h-10 px-8 bg-slate-900 dark:bg-blue-600 text-white font-bold text-xs uppercase tracking-widest rounded-lg flex items-center gap-2"
              >
                Fermer <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

