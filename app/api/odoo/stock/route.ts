import { NextRequest, NextResponse } from 'next/server';

const ODOO_URL = (process.env.NEXT_PUBLIC_ODOO_URL || 'http://localhost:8069').replace(/\/+$/, '');

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

/** allowed_companies is an array of [id, name] (old Odoo) or an object keyed by id (Odoo 16+) */
function extractCompanyIds(allowed: any): number[] {
  if (Array.isArray(allowed)) {
    return allowed.map((c: any) => (Array.isArray(c) ? c[0] : c?.id)).filter((id: any) => Number.isInteger(id));
  }
  if (allowed && typeof allowed === 'object') {
    return Object.keys(allowed).map((k) => parseInt(k, 10)).filter((id) => Number.isInteger(id));
  }
  return [];
}

/**
 * GET /api/odoo/stock — on-hand stock of each product, per boutique (warehouse).
 * Optional `product_ids=1,2,3` to restrict the products.
 * Response: { warehouses: [{ id, name }], stock: { [productId]: { [warehouseId]: qty } } }
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 401 });

    const productIds = (request.nextUrl.searchParams.get('product_ids') || '')
      .split(',')
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n > 0);

    // Read across every company the user may access, so all boutiques are visible
    const sessionInfo = await odooRPC('/web/session/get_session_info', {}, sessionId);
    const companyIds = extractCompanyIds(sessionInfo?.user_companies?.allowed_companies);
    const context = companyIds.length > 0 ? { allowed_company_ids: companyIds } : {};

    const call = (model: string, method: string, args: any[], kwargs: Record<string, any>) =>
      odooRPC('/web/dataset/call_kw', { model, method, args, kwargs: { ...kwargs, context } }, sessionId);

    const warehouses: { id: number; name: string }[] = await call(
      'stock.warehouse', 'search_read', [[]], { fields: ['id', 'name'], order: 'sequence, id' }
    );

    const quantDomain: any[] = [['location_id.usage', '=', 'internal']];
    if (productIds.length > 0) quantDomain.push(['product_id', 'in', productIds]);
    const quants: { product_id: [number, string]; location_id: [number, string]; quantity: number }[] =
      await call('stock.quant', 'search_read', [quantDomain], { fields: ['product_id', 'location_id', 'quantity'] });

    // Map each internal location to its warehouse
    const locationIds = Array.from(new Set(quants.map((q) => q.location_id?.[0]).filter(Boolean)));
    const locations: { id: number; warehouse_id: [number, string] | false }[] = locationIds.length
      ? await call('stock.location', 'read', [locationIds], { fields: ['warehouse_id'] })
      : [];
    const warehouseByLocation = new Map<number, number>();
    for (const loc of locations) {
      if (Array.isArray(loc.warehouse_id)) warehouseByLocation.set(loc.id, loc.warehouse_id[0]);
    }

    const stock: Record<number, Record<number, number>> = {};
    for (const q of quants) {
      const warehouseId = warehouseByLocation.get(q.location_id?.[0]);
      if (!warehouseId) continue;
      const productId = q.product_id[0];
      stock[productId] ??= {};
      stock[productId][warehouseId] = (stock[productId][warehouseId] || 0) + (q.quantity || 0);
    }

    return NextResponse.json({
      success: true,
      warehouses: warehouses.map((w) => ({ id: w.id, name: w.name })),
      stock,
    });
  } catch (error: any) {
    console.error('Stock fetch error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch stock' }, { status: 500 });
  }
}
