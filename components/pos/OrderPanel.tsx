'use client';

import { Eye, Plus } from 'lucide-react';
import { CartItem as CartItemType } from '@/lib/pos/types';
import { CartItem } from './CartItem';
import { PayButton } from './PayButton';

interface OrderPanelProps {
  items: CartItemType[];
  total: number;
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onPayClick: () => void;
  onSelectItem: (productId: string | null) => void;
  onQtySelectItem: (productId: string) => void;
  onPriceSelectItem: (productId: string) => void;
  onImeiSelectItem: (productId: string) => void;
  selectedProductId: string | null;
  onPreviewClick?: () => void;
}

export function OrderPanel({
  items,
  total,
  onQuantityChange,
  onRemoveItem,
  onPayClick,
  onSelectItem,
  onQtySelectItem,
  onPriceSelectItem,
  onImeiSelectItem,
  selectedProductId,
  onPreviewClick,
}: OrderPanelProps) {
  return (
    <div className="flex w-full flex-col border border-border bg-white dark:bg-zinc-900 rounded-lg overflow-hidden h-full shadow-sm">
      {/* Refined Header */}
      <div className="flex-shrink-0 px-4 py-3 bg-white dark:bg-zinc-900 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Panier Actuel</h2>
          <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
        {onPreviewClick && (
          <button
            type="button"
            onClick={onPreviewClick}
            className="h-10 min-w-[126px] px-4 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide"
            title="Voir le panier"
          >
            <Eye className="h-4 w-4" />
            Voir panier
          </button>
        )}
      </div>

      {/* List Area */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-900">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-30 grayscale gap-2">
            <div className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-full">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Panier vide</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {items.map((item) => (
              <CartItem
                key={item.product.id}
                item={item}
                isSelected={selectedProductId === item.product.id}
                onClick={() => onSelectItem(item.product.id)}
                onQtyClick={() => onQtySelectItem(item.product.id)}
                onPriceClick={() => onPriceSelectItem(item.product.id)}
                onImeiClick={() => onImeiSelectItem(item.product.id)}
                onQuantityChange={(qty) =>
                  onQuantityChange(item.product.id, qty)
                }
                onRemove={() => onRemoveItem(item.product.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modern Summary Section */}
      <div className="flex-shrink-0 p-4 border-t border-border bg-slate-50/50 dark:bg-zinc-800/30">
        <div className="flex justify-between items-end mb-4 px-1">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Net</p>
            <p className="text-xs font-medium text-muted-foreground">Taxes incluses</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
              {total.toFixed(2)}
            </span>
            <span className="text-[10px] font-bold text-blue-600/60 dark:text-blue-400/60 ml-1 uppercase">DT</span>
          </div>
        </div>

        <PayButton
          total={total}
          disabled={items.length === 0}
          onClick={onPayClick}
        />
      </div>
    </div>
  );
}
