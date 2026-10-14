'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { Product, Category, ShopStock } from '@/lib/pos/types';

// Color palette for products without images
const PLACEHOLDER_COLORS = [
  'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-violet-600',
  'bg-rose-600', 'bg-cyan-600', 'bg-orange-600', 'bg-teal-600',
  'bg-indigo-600', 'bg-pink-600', 'bg-lime-600', 'bg-sky-600',
];

function getPlaceholderColor(id: string | number): string {
  const index = typeof id === 'number' ? id : parseInt(id, 10) || 0;
  return PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length];
}

interface OdooProduct {
  id: number;
  product_tmpl_id: [number, string] | false;
  categ_id: [number, string] | false;
  name: string;
  list_price: number;
  pos_categ_ids: number[] | [number, string][];
  image_128: string | false;
  barcode: string | false;
  default_code: string | false;
  description_sale: string | false;
  standard_price: number;
}

interface OdooCategory {
  id: number;
  name: string;
  parent_id: [number, string] | false;
  sequence: number;
}

function transformProduct(odooProduct: OdooProduct): Product {
  const hasImage = typeof odooProduct.image_128 === 'string' && odooProduct.image_128.length > 0;
  const productCategoryName = Array.isArray(odooProduct.categ_id) ? odooProduct.categ_id[1] : '';
  let categoryId = 'uncategorized';
  if (odooProduct.pos_categ_ids && odooProduct.pos_categ_ids.length > 0) {
    const firstCat = odooProduct.pos_categ_ids[0];
    categoryId = String(Array.isArray(firstCat) ? firstCat[0] : firstCat);
  }
  return {
    id: String(odooProduct.id),
    odooId: odooProduct.id,
    productTemplateId: Array.isArray(odooProduct.product_tmpl_id)
      ? odooProduct.product_tmpl_id[0]
      : odooProduct.id,
    productCategoryName,
    requiresImei: productCategoryName.toLowerCase().includes('mobile'),
    name: odooProduct.name,
    category: categoryId,
    price: odooProduct.list_price,
    image: hasImage ? `data:image/png;base64,${odooProduct.image_128}` : getPlaceholderColor(odooProduct.id),
    description: odooProduct.description_sale || undefined,
    barcode: odooProduct.barcode || undefined,
    defaultCode: odooProduct.default_code || undefined,
    costPrice: odooProduct.standard_price,
  };
}

interface StockResponse {
  warehouses: { id: number; name: string }[];
  stock: Record<string, Record<string, number>>;
}

/** Stock of one product in every boutique (0 where it has none) */
export function buildShopStock(productId: number, data: StockResponse): ShopStock[] {
  const byWarehouse = data.stock[String(productId)] || {};
  return data.warehouses.map((w) => ({
    warehouseId: w.id,
    name: w.name,
    qty: byWarehouse[String(w.id)] || 0,
  }));
}

function transformCategory(odooCategory: OdooCategory): Category {
  return {
    id: String(odooCategory.id),
    name: odooCategory.name,
    icon: 'Package',
  };
}

export function useOdooProducts() {
  const { sessionId, isAuthenticated } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Prevent duplicate in-flight requests
  const fetchingRef = useRef(false);

  const fetchProducts = useCallback(async (sid: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const [productsRes, categoriesRes, stockData] = await Promise.all([
        fetch(`/api/odoo/products?session_id=${encodeURIComponent(sid)}`),
        fetch(`/api/odoo/categories?session_id=${encodeURIComponent(sid)}`),
        // Stock is optional: the POS keeps working if it can't be loaded
        fetch(`/api/odoo/stock?session_id=${encodeURIComponent(sid)}`)
          .then((r) => r.json())
          .then((d) => (d.success ? (d as StockResponse) : null))
          .catch(() => null),
      ]);
      const productsData = await productsRes.json();
      const categoriesData = await categoriesRes.json();
      if (!productsRes.ok || productsData.error) {
        throw new Error(productsData.error || 'Failed to fetch products');
      }
      setProducts((productsData.products || []).map((p: OdooProduct) => ({
        ...transformProduct(p),
        stock: stockData ? buildShopStock(p.id, stockData) : undefined,
      })));
      if (categoriesRes.ok && !categoriesData.error) {
        setCategories([
          { id: 'all', name: 'All', icon: 'Grid' },
          ...(categoriesData.categories || []).map(transformCategory),
        ]);
      }
    } catch (err: any) {
      console.error('Failed to fetch products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, []); // stable — sid passed as argument, no deps needed

  // Only re-fetch when the sessionId string actually changes
  useEffect(() => {
    if (!sessionId || !isAuthenticated) {
      setIsLoading(false);
      return;
    }
    fetchProducts(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return {
    products,
    categories,
    isLoading,
    error,
    refetch: () => { if (sessionId) fetchProducts(sessionId); },
  };
}
