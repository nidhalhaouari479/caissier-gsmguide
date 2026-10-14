'use client';

import { Button } from '@/components/ui/button';
import { Percent, User, Trash2, RotateCcw } from 'lucide-react';

interface BottomActionsProps {
  onCustomer: () => void;
  onDiscount: () => void;
  onRetour: () => void;
  onClear: () => void;
  disabled?: boolean;
  customer?: any | null;
}

export function BottomActions({
  onCustomer,
  onDiscount,
  onRetour,
  onClear,
  disabled = false,
  customer = null,
}: BottomActionsProps) {
  return (
    <div className="flex gap-3 border-t border-border bg-card px-6 py-4">
      <Button
        onClick={onCustomer}
        variant="outline"
        className="flex-1 h-12 text-base truncate"
        disabled={disabled && !customer} // always allow picking a customer
      >
        <User className="mr-2 h-5 w-5" />
        {customer?.name || 'Customer'}
      </Button>
      <Button
        onClick={onDiscount}
        variant="outline"
        className="flex-1 h-12 text-base"
        disabled={disabled}
      >
        <Percent className="mr-2 h-5 w-5" />
        Discount
      </Button>
      <Button
        onClick={onRetour}
        variant="outline"
        className="flex-1 h-12 text-base text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
      >
        <RotateCcw className="mr-2 h-5 w-5" />
        Retour
      </Button>
      <Button
        onClick={onClear}
        variant="destructive"
        className="flex-1 h-12 text-base"
        disabled={disabled}
      >
        <Trash2 className="mr-2 h-5 w-5" />
        Vider
      </Button>
    </div>
  );
}
