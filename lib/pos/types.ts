export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Product {
  id: string;
  odooId?: number;
  productTemplateId?: number;
  productCategoryName?: string;
  requiresImei?: boolean;
  name: string;
  category: string;
  price: number;
  image: string;
  description?: string;
  barcode?: string;
  defaultCode?: string;
  costPrice?: number;
  stock?: ShopStock[]; // on-hand quantity per boutique
}

export interface ShopStock {
  warehouseId: number;
  name: string;
  qty: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountAmount?: number; // absolute discount in DT
  imei?: string;
}

export interface Order {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod?: string;
  timestamp: Date;
}
