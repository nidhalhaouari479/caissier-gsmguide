'use client';

interface OrderSummaryProps {
  subtotal: number;
  tax: number;
  total: number;
}

export function OrderSummary({ subtotal, tax, total }: OrderSummaryProps) {
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="font-semibold text-foreground">{subtotal.toFixed(2)} DT</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Tax (8%)</span>
        <span className="font-semibold text-foreground">{tax.toFixed(2)} DT</span>
      </div>
      <div className="flex justify-between border-t border-border pt-2">
        <span className="font-bold text-foreground">Total</span>
        <span className="text-lg font-bold text-accent">
          {total.toFixed(2)} DT
        </span>
      </div>
    </div>
  );
}
