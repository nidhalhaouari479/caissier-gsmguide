import { NextRequest, NextResponse } from 'next/server';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'http://localhost:8069';
const MAX_DISCOUNT_PERCENT = 30; // matches your pos_store_hierarchy module rule

async function odooRPC(endpoint: string, params: any, sessionId: string) {
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    params,
    id: Math.floor(Math.random() * 1_000_000_000),
  };
  const response = await fetch(`${ODOO_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `session_id=${sessionId}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Odoo returned ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.data?.message || data.error.message || 'Odoo RPC Error');
  return data.result;
}

/**
 * POST /api/odoo/discount/validate
 * Body: { productOdooId: number, salePrice: number, discount: number }
 * Returns: { valid: boolean, reason?: string, minPrice?: number, maxDiscount?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json({ valid: false, reason: 'Not authenticated' }, { status: 401 });
    }

    const { productOdooId, salePrice, discount } = await request.json();

    if (typeof discount !== 'number' || isNaN(discount)) {
      return NextResponse.json({ valid: false, reason: 'Invalid discount value' });
    }

    // 1. Check max discount cap (your module enforces 30%)
    if (discount > MAX_DISCOUNT_PERCENT) {
      return NextResponse.json({
        valid: false,
        reason: `Discount cannot exceed ${MAX_DISCOUNT_PERCENT}%. Your discount (${discount}%) is too high.`,
        maxDiscount: MAX_DISCOUNT_PERCENT,
      });
    }

    // 2. Check against cost price (standard_price) from Odoo
    if (productOdooId) {
      const products = await odooRPC(
        '/web/dataset/call_kw',
        {
          model: 'product.product',
          method: 'read',
          args: [[productOdooId]],
          kwargs: { fields: ['standard_price', 'name', 'list_price'] },
        },
        sessionId
      );

      if (products && products.length > 0) {
        const costPrice: number = products[0].standard_price || 0;
        const discountedPrice = salePrice * (1 - discount / 100);

        if (costPrice > 0 && discountedPrice < costPrice) {
          const maxAllowedDiscount = Math.floor(((salePrice - costPrice) / salePrice) * 100 * 10) / 10;
          return NextResponse.json({
            valid: false,
            reason: `Discount would result in a price (${discountedPrice.toFixed(2)} DT) below the cost price (${costPrice.toFixed(2)} DT). Max allowed: ${maxAllowedDiscount}%.`,
            minPrice: costPrice,
            maxDiscount: Math.min(maxAllowedDiscount, MAX_DISCOUNT_PERCENT),
          });
        }
      }
    }

    return NextResponse.json({ valid: true, maxDiscount: MAX_DISCOUNT_PERCENT });
  } catch (error: any) {
    console.error('Discount validation error:', error);
    // If Odoo is unreachable, still enforce the % cap client-side
    return NextResponse.json({ valid: true, warning: 'Could not verify against cost price.' });
  }
}
