import { CartItem as CartItemType } from '@/lib/pos/types';
import { Button } from '@/components/ui/button';
import { Trash2, Smartphone, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CartItemProps {
  item: CartItemType;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  onClick?: () => void;
  onQtyClick?: () => void;
  onPriceClick?: () => void;
  onImeiClick?: () => void;
  isSelected?: boolean;
}

export function CartItem({
  item,
  onQuantityChange,
  onRemove,
  onClick,
  onQtyClick,
  onPriceClick,
  onImeiClick,
  isSelected = false,
}: CartItemProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "group flex flex-col py-3 px-3 transition-all cursor-pointer border-b border-border/40 relative",
        isSelected 
          ? "bg-blue-50/40 dark:bg-blue-900/10 shadow-[inset_2px_0_0_0_#2563eb]" 
          : "bg-transparent hover:bg-slate-50/50"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn(
              "text-[13px] font-bold truncate transition-colors",
              isSelected ? "text-blue-700 dark:text-blue-400" : "text-foreground"
            )}>
              {item.product.name}
            </p>
          </div>
          
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {item.quantity} <span className="lowercase font-medium">x</span> {item.product.price.toFixed(2)}
            </span>
            {item.imei && (
              <span className="flex items-center gap-1 text-[9px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded uppercase">
                <Hash className="h-2.5 w-2.5" /> {item.imei}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className={cn(
              "text-[13px] font-black tabular-nums",
              isSelected ? "text-blue-700 dark:text-blue-400" : "text-foreground"
            )}>
              {(item.product.price * item.quantity).toFixed(2)}
            </p>
          </div>

          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-800 transition-opacity"
              onClick={onImeiClick}
              title="Ajouter IMEI"
            >
              <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 group/trash transition-opacity"
              onClick={onRemove}
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground group-hover/trash:text-red-500 transition-colors" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
