import { CartItem } from '@/lib/pos/types';

export function useCalculations(cart: CartItem[]) {
  const subtotal = cart.reduce((sum, item) => {
    const itemTotal = item.product.price * item.quantity;
    const discount = item.discountAmount || 0;
    return sum + (itemTotal - discount);
  }, 0);

  // Prices are already TTC (tax-inclusive) — no additional tax to add
  const tax = 0;
  const total = Math.round(subtotal * 100) / 100;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    tax,
    total,
  };
}
