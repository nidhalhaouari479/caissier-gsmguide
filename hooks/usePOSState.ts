import { useState } from 'react';
import { Product, CartItem } from '@/lib/pos/types';

export function usePOSState() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<any | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setCart((prev) =>
      quantity === 0
        ? prev.filter((item) => item.product.id !== productId)
        : prev.map((item) =>
            item.product.id === productId ? { ...item, quantity } : item
          )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const applyItemDiscount = (productId: string, amount: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId 
          ? { ...item, discountAmount: amount } 
          : item
      )
    );
  };

  const updateImei = (productId: string, imei: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, imei } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    setCustomer(null);
  };

  return {
    cart,
    customer,
    selectedProductId,
    setSelectedProductId,
    setCustomer,
    addToCart,
    updateQuantity,
    removeFromCart,
    applyItemDiscount,
    updateImei,
    clearCart,
  };
}
