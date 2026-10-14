'use client';

import { Product } from '@/lib/pos/types';
import React from 'react';

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export const ProductCard = React.memo(function ProductCard({
  product,
  onClick,
}: ProductCardProps) {
  const isBase64Image = product.image && product.image.startsWith('data:');
  const isPlaceholderColor = product.image && product.image.startsWith('bg-');

  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-lg bg-card p-3 text-center transition-all duration-200 hover:shadow-lg hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring active:scale-95"
    >
      {isBase64Image ? (
        <div className="h-24 rounded-md overflow-hidden transition-transform duration-200 group-hover:scale-110 shadow-sm bg-muted">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className={`${isPlaceholderColor ? product.image : 'bg-muted'} h-24 rounded-md transition-transform duration-200 group-hover:scale-110 shadow-sm flex items-center justify-center`}
        >
          <span className="text-2xl font-bold text-white/60">
            {product.name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col">
        <h3 className="text-xs font-semibold leading-tight text-foreground line-clamp-2">
          {product.name}
        </h3>
        {product.defaultCode && (
          <p className="text-[10px] text-muted-foreground font-medium mt-0.5 truncate">
            {product.defaultCode}
          </p>
        )}
        {product.stock && product.stock.length > 0 && (
          <div className="mt-1 space-y-0.5 text-[10px] leading-tight">
            {product.stock.map((s) => (
              <div key={s.warehouseId} className="flex justify-between gap-1">
                <span className="truncate text-muted-foreground">{s.name}</span>
                <span className={s.qty > 0 ? 'font-semibold text-foreground' : 'font-semibold text-destructive'}>
                  {s.qty}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-auto text-sm font-bold text-accent group-hover:text-accent/80 transition-colors">
          {product.price.toFixed(2)} DT
        </p>
      </div>
    </button>
  );
});
