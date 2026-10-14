'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { POSLayout } from '@/components/pos/POSLayout';
import { TopBar } from '@/components/pos/TopBar';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { OrderPanel } from '@/components/pos/OrderPanel';
import { PaymentModal } from '@/components/pos/PaymentModal';
import { Numberpad } from '@/components/pos/Numberpad';
import { SearchBar } from '@/components/pos/SearchBar';
import { CategoriesSidebar } from '@/components/pos/CategoriesSidebar';
import { usePOSState } from '@/hooks/usePOSState';
import { useCalculations } from '@/hooks/useCalculations';
import { useAuth } from '@/hooks/useAuth';
import { useOdooProducts } from '@/hooks/useOdooProducts';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { CustomerModal } from '@/components/pos/CustomerModal';
import { ClosureModal } from '@/components/pos/ClosureModal';
import { ExpensesModal } from '@/components/pos/ExpensesModal';
import { RefundModal } from '@/components/pos/RefundModal';
import { ImeiModal } from '@/components/pos/ImeiModal';
import { CashierOpeningScreen } from '@/components/pos/CashierOpeningScreen';
import { CartPreviewModal } from '@/components/pos/CartPreviewModal';

export default function Home() {
  const router = useRouter();
  const { user, sessionId, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const {
    products,
    categories,
    isLoading: productsLoading,
    error: productsError,
    refetch,
  } = useOdooProducts();

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [quickPayId, setQuickPayId] = useState<number | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [numberpadValue, setNumberpadValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [numMode, setNumMode] = useState<'amount' | 'quantity'>('amount');
  const [padMode, setPadMode] = useState<'qty' | 'disc' | 'price'>('qty');
  const [activeCategory, setActiveCategory] = useState('all');
  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const [expensesModalOpen, setExpensesModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [imeiModalOpen, setImeiModalOpen] = useState(false);
  const [cartPreviewOpen, setCartPreviewOpen] = useState(false);
  const [odooMethods, setOdooMethods] = useState<any[]>([
    { id: 'mock-cash', name: 'Espèces', isCash: true },
    { id: 'mock-card', name: 'Carte Bancaire', isCash: false }
  ]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [posSession, setPosSession] = useState<any>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const {
    cart,
    customer,
    selectedProductId,
    setSelectedProductId,
    setCustomer,
    applyItemDiscount,
    addToCart,
    updateQuantity,
    removeFromCart,
    updateImei,
    clearCart,
  } = usePOSState();
  const { subtotal, tax, total } = useCalculations(cart);
  const { toast } = useToast();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const refreshSession = async () => {
    if (!isAuthenticated || !sessionId) return;
    setCheckingSession(true);
    try {
      const res = await fetch(`/api/odoo/pos-session?session_id=${sessionId}`);
      const data = await res.json();
      if (data.hasActiveSession && data.session) {
        setPosSession({
          ...data.session,
          needsOpeningControl: data.needsOpeningControl
        });
      } else {
        setPosSession(null);
      }
    } catch (err) {
      console.error('Failed to refresh session:', err);
      setPosSession(null);
    } finally {
      setCheckingSession(false);
    }
  };

  // Check for active POS session in Odoo on mount and periodically
  useEffect(() => {
    refreshSession();
    const interval = setInterval(refreshSession, 5 * 60 * 1000); // Every 5 minutes
    return () => clearInterval(interval);
  }, [isAuthenticated, sessionId]);

  // Reset active category to 'all' when category list changes (e.g. first load)
  useEffect(() => {
    if (categories.length > 0 && activeCategory !== 'all') {
      const stillExists = categories.some((c) => c.id === activeCategory);
      if (!stillExists) setActiveCategory('all');
    }
  }, [categories]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  // Filter products by active category AND search query
  const filteredProducts = products.filter((product) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = 
      !q ||
      product.name.toLowerCase().includes(q) ||
      (product.defaultCode && product.defaultCode.toLowerCase().includes(q)) ||
      (product.barcode && product.barcode.toLowerCase().includes(q));
    const matchesCategory =
      activeCategory === 'all' || product.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleProductClick = (product: any) => {
    addToCart(product);
    setSelectedProductId(product.id);
    setNumberpadValue('');

    const needsImei = product.requiresImei;

    if (needsImei) {
      setImeiModalOpen(true);
    } else {
      toast({
        description: `${product.name} ajouté — ${product.price.toFixed(2)} DT`,
        duration: 2000,
      });
    }
  };

  const handlePaymentComplete = (cartSnapshot: any[], orderTotal: number) => {
    toast({
      title: 'Payment Successful',
      description: 'Thank you for your purchase!',
      duration: 3000,
    });
    clearCart();
    setNumberpadValue('');
    setPaymentOpen(false);
  };

  const handleClear = () => {
    // Reset local UI state regardless of cart status
    setNumberpadValue('');
    setSelectedProductId(null);

    // Ask for confirmation and clear cart if not empty
    if (cart.length > 0) {
      if (confirm('Voulez-vous vider le panier ?')) {
        clearCart();
        toast({
          description: 'Panier vidé',
          duration: 2000,
        });
      }
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleClosureSuccess = () => {
    setClosureModalOpen(false);
    toast({
      title: 'Session Clôturée',
      description: 'La session a été fermée avec succès dans Odoo.',
      duration: 5000,
    });
    logout();
  };

  const handleSessionReset = () => {
    setClosureModalOpen(false);
    setPosSession(null);
    refreshSession();
  };

  const handleNumberpadDigit = (digit: string) => {
    if (digit === '.') {
      if (!numberpadValue.includes('.')) {
        setNumberpadValue(numberpadValue + digit);
      }
    } else {
      setNumberpadValue(numberpadValue + digit);
    }
  };

  const handleNumberpadBackspace = () => {
    setNumberpadValue(numberpadValue.slice(0, -1));
  };

  const handleNumberpadClear = () => {
    handleClear();
  };

  const handleNumberpadSubmit = () => {
    if (!numberpadValue || !selectedProductId) return;

    const val = parseFloat(numberpadValue);
    if (isNaN(val)) return;

    if (padMode === 'qty') {
      updateQuantity(selectedProductId, val);
      toast({ description: `Quantité : ${val}` });
    } else if (padMode === 'disc') {
      const item = cart.find(i => i.product.id === selectedProductId);
      if (item) {
        const currentDiscount = item.discountAmount || 0;
        const newTotalDiscount = val; // Assuming absolute discount input
        const costPrice = item.product.costPrice || 0;
        const lineTotal = item.product.price * item.quantity;

        if (lineTotal - newTotalDiscount < costPrice * item.quantity) {
          toast({ 
            variant: "destructive", 
            title: "Remise Refusée",
            description: `Marge insuffisante ! Le prix ne peut pas descendre en dessous du prix d'achat.` 
          });
          return;
        }

        applyItemDiscount(selectedProductId, newTotalDiscount);
        toast({ description: `Remise appliquée : ${newTotalDiscount} DT` });
      }
    } else if (padMode === 'price') {
      toast({ description: `Nouveau prix : ${val} DT` });
    }

    setNumberpadValue('');
  };

  // Fetch payment methods on load if needed
  useEffect(() => {
    if (sessionId && odooMethods.length === 0) {
      setLoadingMethods(true);
      fetch(`/api/odoo/payment-methods?session_id=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.methods && data.methods.length > 0) {
            setOdooMethods(data.methods);
          }
        })
        .finally(() => setLoadingMethods(false));
    }
  }, [sessionId, odooMethods.length]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (paymentOpen) return;

      const target = e.target as HTMLElement | null;
      const activeElement = document.activeElement as HTMLElement | null;
      const isTypingInField =
        target?.closest('input, textarea, select, [contenteditable="true"], [data-pos-search-input="true"]') ||
        activeElement?.closest('input, textarea, select, [contenteditable="true"], [data-pos-search-input="true"]') ||
        Boolean(target?.isContentEditable);

      if (isTypingInField) return;

      if (/^[0-9]$/.test(e.key)) {
        handleNumberpadDigit(e.key);
        return;
      }
      if (e.key === '.') {
        handleNumberpadDigit('.');
        return;
      }
      if (e.key === 'Backspace') {
        handleNumberpadBackspace();
        return;
      }
      if (e.key === 'Enter') {
        handleNumberpadSubmit();
        return;
      }
      if (e.key === 'Delete') {
        handleNumberpadClear();
        return;
      }
      if (e.key === 'Escape' && cart.length > 0) {
        handleClear();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [paymentOpen, cart.length, numberpadValue]);

  // Show loading while checking auth or session
  if (authLoading || checkingSession) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render POS if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  // Show cashier opening screen if no active POS session
  if (!posSession) {
    return (
      <CashierOpeningScreen
        sessionId={sessionId}
        cashierName={user?.name || 'Caissier'}
        onSessionOpened={(session) => {
          setPosSession(session);
        }}
      />
    );
  }

  return (
    <>

      <POSLayout
        topBar={
          <TopBar
            cashierName={user?.name || 'Cashier'}
            posSessionName={posSession?.name}
            storeName={user?.company_name}
            boutiqueName={user?.company_name || posSession?.configName}
            storeCompanies={user?.company_names}
            onLogout={handleLogout}
            onClosure={() => setClosureModalOpen(true)}
            onExpenses={() => setExpensesModalOpen(true)}
            onRefreshSession={refreshSession}
          />
        }
        categoriesSidebar={
          categories.length > 1 ? (
            <CategoriesSidebar
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={(id) => {
                setActiveCategory(id);
                setSearchQuery(''); // Clear search when switching category
              }}
            />
          ) : undefined
        }
        main={
          productsLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading products from Odoo...</p>
            </div>
          ) : productsError ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <WifiOff className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Failed to load products</p>
                <p className="text-xs text-muted-foreground mt-1">{productsError}</p>
              </div>
              <button
                onClick={refetch}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          ) : (
            <ProductGrid
              products={filteredProducts}
              onProductClick={handleProductClick}
            />
          )
        }
        orderPanel={
          <OrderPanel
            items={cart}
            total={total}
            selectedProductId={selectedProductId}
            onSelectItem={(id) => {
              setSelectedProductId(id);
              setPadMode('qty');
              setNumberpadValue('');
            }}
            onQtySelectItem={(id) => {
              setSelectedProductId(id);
              setPadMode('qty');
              setNumberpadValue('');
            }}
            onPriceSelectItem={(id) => {
              setSelectedProductId(id);
              setPadMode('price');
              setNumberpadValue('');
            }}
            onImeiSelectItem={(id) => {
              setSelectedProductId(id);
              setImeiModalOpen(true);
            }}
            onQuantityChange={updateQuantity}
            onRemoveItem={removeFromCart}
            onPreviewClick={() => setCartPreviewOpen(true)}
            onPayClick={() => {
              if (!customer) {
                toast({
                  variant: 'destructive',
                  title: 'Client Requis',
                  description: 'Veuillez sélectionner un client avant de procéder au paiement.',
                  duration: 3000,
                });
                setCustomerModalOpen(true);
                return;
              }
              if (!posSession) {
                toast({ 
                  variant: "destructive", 
                  title: "Session Requise", 
                  description: "Veuillez d'abord ouvrir une caisse via le bouton 'Ouvrir Caisse' en haut." 
                });
                refreshSession();
                return;
              }
              setQuickPayId(null); // Opening standard selector
              setPaymentOpen(true);
            }}
          />
        }
        numberpad={
          <div className="flex flex-col gap-3">
            <SearchBar
              value={searchQuery}
              onChange={(val) => {
                setSearchQuery(val);
                if (val) setActiveCategory('all'); // reset category filter when typing
              }}
              onClear={() => setSearchQuery('')}
              placeholder="Rechercher par nom, code-barres ou référence interne..."
            />
            <Numberpad
              onNumber={handleNumberpadDigit}
              onBackspace={handleNumberpadBackspace}
              onClear={handleNumberpadClear}
              onSubmit={handleNumberpadSubmit}
              onCustomer={() => setCustomerModalOpen(true)}
              customerName={customer?.name || null}
              activeMode={padMode}
              onModeChange={setPadMode}
              value={numberpadValue}
            />
          </div>
        }
      />

      <PaymentModal
        open={paymentOpen}
        subtotal={subtotal}
        tax={tax}
        total={total}
        cart={cart}
        customer={customer}
        uid={user?.uid || null}
        sessionId={sessionId}
        onClose={() => setPaymentOpen(false)}
        onPaymentComplete={handlePaymentComplete}
        initialMethodId={quickPayId}
        onRefreshSession={refreshSession}
      />

      <CustomerModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onCustomerSelect={(c) => {
          if (!c) return;
          setCustomer(c);
          toast({
            description: c ? `Customer ${c.name} selected` : 'Customer cleared',
            duration: 2000,
          });
        }}
      />

      <ClosureModal
        open={closureModalOpen}
        onClose={() => setClosureModalOpen(false)}
        onSuccess={handleClosureSuccess}
        onReset={handleSessionReset}
        sessionId={sessionId}
        posSessionId={posSession?.id ?? null}
      />

      <ExpensesModal
        open={expensesModalOpen}
        onClose={() => setExpensesModalOpen(false)}
        sessionId={sessionId}
      />

      <RefundModal
        open={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        onSuccess={(msg) => {
          setRefundModalOpen(false);
          toast({ description: msg });
        }}
        sessionId={sessionId}
        uid={user?.uid ? Number(user.uid) : null}
        onRefreshSession={refreshSession}
      />

      <ImeiModal
        open={imeiModalOpen}
        onClose={() => setImeiModalOpen(false)}
        cart={cart}
        defaultProductId={selectedProductId}
        onApplyImei={(productId, imei) => {
          updateImei(productId, imei);
          toast({ description: `IMEI enregistré : ${imei}` });
        }}
      />

      <CartPreviewModal
        open={cartPreviewOpen}
        items={cart}
        total={total}
        onClose={() => setCartPreviewOpen(false)}
      />
    </>
  );
}
