'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PaymentMethods, OdooPaymentMethod } from './PaymentMethods';
import { CashPayment } from './CashPayment';
import { CardPayment } from './CardPayment';
import { CartItem } from '@/lib/pos/types';
import { Printer, CheckCircle2, AlertCircle, RefreshCw, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FISCAL_STAMP_AMOUNT = 1;
const PAYMENT_REQUEST_TIMEOUT_MS = 30000;

interface PaymentModalProps {
  open: boolean;
  subtotal: number;
  tax: number;
  total: number;
  cart: CartItem[];
  customer: any | null;
  sessionId: string | null;
  uid: string | number | null;
  onClose: () => void;
  onPaymentComplete: (cartSnapshot: CartItem[], total: number) => void;
  initialMethodId?: number | null;
  onRefreshSession?: () => void;
  imeiRequiredCategories?: string[];
}

export function PaymentModal({
  open,
  subtotal,
  tax,
  total,
  cart,
  customer,
  sessionId,
  uid,
  onClose,
  onPaymentComplete,
  onRefreshSession,
  initialMethodId = null,
  imeiRequiredCategories = [],
}: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<OdooPaymentMethod | null>(null);
  const [methods, setMethods] = useState<OdooPaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [pendingMethod, setPendingMethod] = useState<{ id: number; name: string; change?: number } | null>(null);
  const [createOdooInvoice, setCreateOdooInvoice] = useState(true);
  const activePaymentRequestRef = useRef(0);
  const [receiptData, setReceiptData] = useState<{
    cartSnapshot: CartItem[];
    subtotal: number;
    tax: number;
    total: number;
    method: string;
    change?: number;
    timestamp: Date;
    orderReference?: string | null;
    invoiceNumber?: string | null;
    invoiceId?: number | null;
    ticketId?: number | null;
    documentType: 'invoice' | 'ticket_caisse';
    createOdooInvoice: boolean;
    includeFiscalStamp: boolean;
  } | null>(null);
  const includeFiscalStamp = createOdooInvoice;
  const totalToPay = total + (includeFiscalStamp ? FISCAL_STAMP_AMOUNT : 0);

  const missingImeiItems = cart.filter(item => 
    (item.product.requiresImei || imeiRequiredCategories.includes(item.product.category)) && !item.imei
  );
  const hasMissingImeis = missingImeiItems.length > 0;
  const isCustomerSelected = !!customer;

  useEffect(() => {
    if (!isProcessing) return;

    const watchdogId = window.setTimeout(() => {
      activePaymentRequestRef.current += 1;
      setPaymentError("Odoo ne répond pas. Le traitement a été arrêté côté interface, vérifiez Odoo avant de réessayer.");
      setIsProcessing(false);
    }, PAYMENT_REQUEST_TIMEOUT_MS + 2000);

    return () => window.clearTimeout(watchdogId);
  }, [isProcessing]);

  useEffect(() => {
    if (open && sessionId) {
      setLoadingMethods(true);
      fetch(`/api/odoo/payment-methods?session_id=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.methods && data.methods.length > 0) {
            setMethods(data.methods);
            if (initialMethodId) {
              const initial = data.methods.find((m: any) => m.id === initialMethodId);
              if (initial) setPaymentMethod(initial);
            }
          } else {
            setMethods([]);
          }
        })
        .catch((err) => console.error(err))
        .finally(() => setLoadingMethods(false));
    } else {
      setPaymentMethod(null);
      setPaymentError(null);
      setReceiptData(null);
      setCreateOdooInvoice(true);
    }
  }, [open, sessionId]);

  const handlePaymentComplete = async (methodId: number, methodName: string, change?: number) => {
    setIsProcessing(true);
    setPaymentError(null);
    setPendingMethod({ id: methodId, name: methodName, change });
    const requestId = activePaymentRequestRef.current + 1;
    activePaymentRequestRef.current = requestId;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), PAYMENT_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`/api/odoo/orders?session_id=${sessionId}`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart,
          total: totalToPay,
          tax,
          subtotal,
          customer,
          uid,
          paymentMethodId: methodId,
          createOdooInvoice,
          includeFiscalStamp,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la création de la commande');
      }

      if (activePaymentRequestRef.current !== requestId) return;

      setReceiptData({
        cartSnapshot: [...cart],
        subtotal,
        tax,
        total,
        method: methodName,
        change,
        timestamp: new Date(),
        orderReference: data.order?.reference || data.order?.name || data.ticketId,
        invoiceNumber: data.order?.invoiceNumber || null,
        invoiceId: data.order?.invoiceId || null,
        ticketId: data.order?.ticketId || data.ticketId || null,
        documentType: data.type || data.order?.documentType || (createOdooInvoice ? 'invoice' : 'ticket_caisse'),
        createOdooInvoice,
        includeFiscalStamp,
      });
      setPendingMethod(null);
    } catch (err: any) {
      if (activePaymentRequestRef.current !== requestId) return;

      if (err?.name === 'AbortError') {
        setPaymentError("Odoo ne répond pas après 30 secondes. Vérifiez dans Odoo si la commande a été créée avant de réessayer.");
        return;
      }
      setPaymentError(err.message || 'Échec du paiement. Veuillez réessayer.');
    } finally {
      window.clearTimeout(timeoutId);
      if (activePaymentRequestRef.current === requestId) {
        setIsProcessing(false);
      }
    }
  };

  useEffect(() => {
    if (receiptData) {
      const timer = setTimeout(() => {
        handlePrintTicket();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [receiptData]);

  const handleRetry = () => {
    if (pendingMethod) {
      handlePaymentComplete(pendingMethod.id, pendingMethod.name, pendingMethod.change);
    }
  };

  const handleDone = () => {
    if (receiptData) {
      onPaymentComplete(receiptData.cartSnapshot, receiptData.total);
    }
    setPaymentMethod(null);
    setReceiptData(null);
    onClose();
  };

  const handlePrintFacture = () => {
    if (!receiptData) return;

    const storeName = process.env.NEXT_PUBLIC_STORE_NAME || 'GSM Store';
    const storeAddress = process.env.NEXT_PUBLIC_STORE_ADDRESS || '';
    const dateStr = receiptData.timestamp.toLocaleDateString('fr-FR');
    const orderRef = receiptData.invoiceNumber || receiptData.orderReference || `FAC-${Date.now()}`;
    const isOdooInvoice = receiptData.documentType === 'invoice' || !!receiptData.invoiceNumber;
    const taxRate = 8;

    const itemRows = receiptData.cartSnapshot.map((item) => {
      const gross = item.product.price * item.quantity;
      const lineTotal = gross - (item.discountAmount || 0);
      return `
        <tr>
          <td><div style="font-weight:600">${item.product.name}</div>${item.imei ? `<div style="font-size:9px;color:#3b82f6">IMEI: ${item.imei}</div>` : ''}</td>
          <td>${item.quantity.toFixed(2).replace('.', ',')}</td>
          <td>${item.product.price.toFixed(2)}</td>
          <td>${taxRate}%</td>
          <td>${lineTotal.toFixed(2)} DT</td>
        </tr>`;
    }).join('');

    const factureHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Facture - ${orderRef}</title>
        <meta charset="UTF-8"/>
        <style>
          body { font-family: 'Inter', Arial, sans-serif; font-size: 11px; padding: 32px 44px; max-width: 800px; margin: 0 auto; background: #fff; }
          .header { display: flex; justify-content: space-between; margin-bottom: 30px; align-items: flex-start; }
          .logo-container { display: flex; align-items: center; gap: 12px; }
          .logo-img { height: 50px; width: auto; object-fit: contain; }
          .title { font-size: 22px; font-weight: 700; margin-bottom: 20px; color: #1e293b; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { text-align: left; padding: 10px 5px; border-bottom: 2px solid #e2e8f0; font-size: 9px; text-transform: uppercase; color: #64748b; }
          td { padding: 10px 5px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
          .totals { margin-left: auto; width: 250px; }
          .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
          .grand-total { font-size: 14px; font-weight: 700; border-bottom: none; color: #1d4ed8; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-container">
            <img src="/gsmguidelogo.png" class="logo-img" onerror="this.style.display='none'"/>
            <div>
              <div style="font-weight:700; font-size: 16px; color: #1d4ed8;">${storeName}</div>
              <div style="color: #64748b;">${storeAddress}</div>
            </div>
          </div>
          ${customer ? `<div style="text-align:right"><div style="font-weight:700; font-size: 14px;">${customer.name}</div></div>` : ''}
        </div>
        <div class="title">${isOdooInvoice ? 'Facture' : 'Reçu'} ${orderRef}</div>
        <table>
          <thead><tr><th>Description</th><th>Qté</th><th>Prix HT</th><th>Tva</th><th>Total</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div class="totals">
          <div class="total-row"><span>Sous-total</span><span>${receiptData.subtotal.toFixed(2)} DT</span></div>
          ${receiptData.includeFiscalStamp ? `<div class="total-row"><span>Timbre Fiscal</span><span>1,000 DT</span></div>` : ''}
          <div class="total-row grand-total"><span>Total TTC</span><span>${(receiptData.total + (receiptData.includeFiscalStamp ? FISCAL_STAMP_AMOUNT : 0)).toFixed(2)} DT</span></div>
        </div>
      </body>
      </html>
    `;
    printHtml(factureHtml);
  };

  const handlePrintTicket = () => {
    if (!receiptData) return;

    const storeName = process.env.NEXT_PUBLIC_STORE_NAME || 'GSM Guide';
    const storeAddress = process.env.NEXT_PUBLIC_STORE_ADDRESS || '';
    const dateStr = receiptData.timestamp.toLocaleString('fr-FR');
    const orderRef = String(receiptData.orderReference || `REF-${Date.now()}`).replace('GSM menzah', 'GSM Guide');

    const itemRows = receiptData.cartSnapshot.map((item) => {
      const gross = item.product.price * item.quantity;
      const lineTotal = gross - (item.discountAmount || 0);
      return `
        <div class="ticket-row"><span class="item-name">${item.product.name}</span><span>${lineTotal.toFixed(2)}</span></div>
        ${item.imei ? `<div class="ticket-row-meta" style="font-weight:bold">IMEI: ${item.imei}</div>` : ''}
        <div class="ticket-row-meta"><span>${item.quantity.toFixed(0)} x ${item.product.price.toFixed(2)}</span></div>`;
    }).join('');

    const ticketHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket - ${orderRef}</title>
        <meta charset="UTF-8"/>
        <style>
          body { font-family: 'Courier New', Courier, monospace; font-size: 13px; width: 80mm; padding: 5mm; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 3mm 0; }
          .ticket-row { display: flex; justify-content: space-between; margin-top: 2mm; }
          .ticket-row-meta { font-size: 11px; margin-bottom: 1mm; }
          .logo-ticket { max-width: 40mm; height: auto; margin-bottom: 3mm; }
          @media print { body { width: 80mm; padding: 2mm; } }
        </style>
      </head>
      <body>
        <div class="center">
          <img src="/gsmguidelogo.png" class="logo-ticket" onerror="this.style.display='none'"/>
          <div class="bold" style="font-size:16px">${storeName}</div>
          <div>${storeAddress}</div>
          <div class="divider"></div>
          <div>TICKET DE CAISSE</div>
          <div class="bold">${orderRef}</div>
          ${customer ? `<div class="bold">CLIENT: ${customer.name}</div>` : ''}
          <div>${dateStr}</div>
          <div>Mode: ${receiptData.method}</div>
        </div>
        <div class="divider"></div>
        <div>${itemRows}</div>
        <div class="divider"></div>
        ${receiptData.includeFiscalStamp ? `<div class="ticket-row"><span>Timbre Fiscal</span><span>1.000 DT</span></div>` : ''}
        <div class="ticket-row bold"><span>TOTAL</span><span>${(receiptData.total + (receiptData.includeFiscalStamp ? FISCAL_STAMP_AMOUNT : 0)).toFixed(2)} DT</span></div>
        ${receiptData.change ? `<div class="ticket-row"><span>RENDU</span><span>${receiptData.change.toFixed(2)} DT</span></div>` : ''}
        <div class="divider"></div>
        <div class="center" style="margin-top:5mm">Merci de votre visite !</div>
      </body>
      </html>
    `;
    printHtml(ticketHtml);
  };

  const printHtml = (html: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute'; iframe.style.width = '0px'; iframe.style.height = '0px'; iframe.style.border = 'none'; iframe.style.left = '-9999px';
    document.body.appendChild(iframe);
    if (iframe.contentWindow) {
      iframe.contentWindow.document.open(); iframe.contentWindow.document.write(html); iframe.contentWindow.document.close();
      iframe.contentWindow.focus();
      setTimeout(() => { iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { if (receiptData) handleDone(); else onClose(); }}>
      <DialogContent showCloseButton={true} className="sm:max-w-[1000px] w-[95vw] h-[85vh] p-0 overflow-hidden border border-border bg-white dark:bg-zinc-900 rounded-xl shadow-2xl flex flex-col md:flex-row gap-0">
        
        {/* Left Summary Panel - White */}
        <div className="w-full md:w-[320px] bg-white dark:bg-zinc-900 p-8 border-r border-border flex flex-col flex-shrink-0">
          <DialogTitle className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground mb-8">Résumé</DialogTitle>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
            {cart.map((item) => (
              <div key={item.product.id} className="space-y-1 pb-4 border-b border-border/50">
                <div className="flex justify-between items-start gap-4">
                  <p className="text-[14px] font-bold text-foreground leading-tight flex-1">{item.product.name}</p>
                  <span className="text-[14px] font-bold text-foreground tabular-nums">{(item.product.price * item.quantity).toFixed(2)}</span>
                </div>
                <p className="text-[12px] text-muted-foreground font-medium">Qté: {item.quantity}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-8 space-y-3 pt-6 border-t border-border">
            <div className="flex justify-between items-center text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Sous-total</span>
              <span className="tabular-nums">{total.toFixed(2)} DT</span>
            </div>
            
            {includeFiscalStamp && (
              <div className="flex justify-between items-center text-[12px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                <span>Timbre Fiscal</span>
                <span className="tabular-nums">1.000 DT</span>
              </div>
            )}

            <div className="pt-4 flex justify-between items-end">
              <span className="text-[12px] font-black uppercase tracking-widest text-foreground">Total à Payer</span>
              <div className="text-right">
                <span className="text-4xl font-black text-blue-600 tabular-nums">
                   {totalToPay.toFixed(2)}
                </span>
                <span className="text-sm font-bold text-blue-600 ml-1">DT</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden relative">
          {!receiptData && !isProcessing && !paymentError && (
            <div className="px-10 pt-10 pb-6 flex-shrink-0">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Paiement</h2>
              <DialogDescription className="text-sm text-muted-foreground mt-2">
                Choisissez un mode de paiement pour finaliser la commande.
              </DialogDescription>
              <div className="h-px bg-border/50 w-full mt-6" />
            </div>
          )}

          {/* Accessibility fallbacks */}
          {(receiptData || isProcessing || paymentError) && (
            <div className="sr-only">
              <DialogTitle>Traitement du paiement</DialogTitle>
              <DialogDescription>Détails de la transaction en cours.</DialogDescription>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-10 pb-10 custom-scrollbar">
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 animate-in fade-in zoom-in duration-300 py-20">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">
                  {createOdooInvoice ? 'Synchronisation Odoo...' : 'Creation ticket de caisse...'}
                </p>
              </div>
            ) : paymentError ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
                <div className="p-4 bg-red-100 dark:bg-red-900/20 rounded-full">
                  <AlertCircle className="h-10 w-10 text-red-600" />
                </div>
                <h3 className="text-sm font-bold uppercase">Transaction échouée</h3>
                <p className="text-xs text-muted-foreground max-w-xs">{paymentError}</p>
                <div className="flex flex-col gap-2 mt-4 w-full max-w-xs">
                  <Button onClick={handleRetry} className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest h-12">Réessayer</Button>
                  {(paymentError.toLowerCase().includes('fermée') || paymentError.toLowerCase().includes('fermé') || paymentError.toLowerCase().includes('closed')) && (
                    <Button 
                      onClick={() => {
                        onClose();
                        if (onRefreshSession) onRefreshSession();
                      }} 
                      variant="outline" 
                      className="text-[10px] font-bold uppercase tracking-widest h-10"
                    >
                      Session fermée ? Réinitialiser
                    </Button>
                  )}
                </div>
              </div>
            ) : receiptData ? (
              <div className="flex flex-col gap-8 animate-in slide-in-from-bottom-4 duration-500 py-6">
                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-xl p-8 flex items-center gap-6">
                  <div className="p-3 bg-emerald-500 rounded-full flex-shrink-0">
                    <CheckCircle2 className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-emerald-900 dark:text-emerald-400">
                      {receiptData.documentType === 'invoice' ? 'Facture créée' : 'Ticket de caisse créé'}
                    </h4>
                    <p className="text-xs font-medium text-emerald-600 mt-1 opacity-70">
                      Ref: {receiptData.invoiceNumber || receiptData.orderReference || receiptData.ticketId}
                    </p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button onClick={handlePrintTicket} className="h-16 w-full max-w-sm bg-slate-900 dark:bg-zinc-800 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 rounded-xl shadow-lg">
                    <Printer className="h-5 w-5" /> Ticket de Caisse
                  </Button>
                </div>
              </div>
            ) : paymentMethod === null ? (
              <div className="animate-in fade-in duration-300 pb-10">
                {hasMissingImeis && (
                  <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-xl flex items-start gap-4">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-900 dark:text-amber-400">IMEI Requis</p>
                      <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                        Les articles suivants nécessitent un numéro IMEI avant de procéder au paiement :
                        <ul className="list-disc list-inside mt-2 font-bold">
                          {missingImeiItems.map(item => (
                            <li key={item.product.id}>{item.product.name}</li>
                          ))}
                        </ul>
                      </p>
                    </div>
                  </div>
                )}
                
                <PaymentMethods 
                  methods={methods} 
                  isLoading={loadingMethods} 
                  onMethodSelect={(method) => {
                    if (!hasMissingImeis) setPaymentMethod(method);
                  }}
                  disabled={hasMissingImeis}
                />
                
                <div className="mt-8 pt-8 border-t border-border">
                  <div className="flex items-center justify-between p-5 rounded-xl border border-border bg-slate-50/50 dark:bg-zinc-800/20">
                    <div className="flex items-center gap-4">
                      <Printer className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-bold text-foreground">Facture Client Odoo</p>
                        <p className="text-[10px] text-muted-foreground font-medium italic">Inclut le timbre fiscal (+1.000 DT)</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setCreateOdooInvoice(!createOdooInvoice)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all ${createOdooInvoice ? 'bg-blue-600' : 'bg-slate-300 dark:bg-zinc-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all ${createOdooInvoice ? 'translate-x-6 shadow-md' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            ) : paymentMethod.isCash ? (
              <div className="h-full">
                 <CashPayment 
                  total={totalToPay}
                  onPaymentComplete={(change) => handlePaymentComplete(paymentMethod.id, paymentMethod.name, change)} 
                  onBack={() => setPaymentMethod(null)} 
                 />
              </div>
            ) : (
              <div className="h-full">
                 <CardPayment 
                  total={totalToPay}
                  paymentMethodName={paymentMethod.name} 
                  onPaymentComplete={() => handlePaymentComplete(paymentMethod.id, paymentMethod.name)} 
                  onBack={() => setPaymentMethod(null)} 
                 />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
