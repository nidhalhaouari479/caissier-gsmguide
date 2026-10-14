import { NextRequest, NextResponse } from 'next/server';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'http://localhost:8069';

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

/** GET /api/odoo/products — list POS products (already exists, unchanged) */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 401 });

    const all = request.nextUrl.searchParams.get('all') === 'true';

    const domain = all ? [] : [['available_in_pos', '=', true]];

    const products = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'product.product',
        method: 'search_read',
        args: [domain],
        kwargs: {
          fields: [
            'id', 'product_tmpl_id', 'categ_id', 'name', 'list_price', 'standard_price',
            'pos_categ_ids', 'image_128', 'barcode',
            'default_code', 'description_sale', 'available_in_pos',
          ],
          order: 'name asc',
        },
      },
      sessionId
    );

    return NextResponse.json({ success: true, products: products || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch products' }, { status: 500 });
  }
}

/** POST /api/odoo/products — create a new product in Odoo */
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 401 });

    const body = await request.json();
    const { name, list_price, standard_price, barcode, description_sale, pos_categ_id } = body;

    if (!name || !list_price) {
      return NextResponse.json({ error: 'Name and sale price are required' }, { status: 400 });
    }

    const vals: Record<string, any> = {
      name,
      list_price: parseFloat(list_price),
      standard_price: standard_price ? parseFloat(standard_price) : 0,
      available_in_pos: true,
      type: 'consu', // consumable product — fits GSM store parts
    };
    if (barcode) vals.barcode = barcode;
    if (description_sale) vals.description_sale = description_sale;
    if (pos_categ_id) vals.pos_categ_ids = [[6, 0, [parseInt(pos_categ_id)]]];

    const newId = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'product.product',
        method: 'create',
        args: [vals],
        kwargs: {},
      },
      sessionId
    );

    // Return the full created product
    const created = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'product.product',
        method: 'read',
        args: [[newId]],
        kwargs: {
          fields: [
            'id', 'product_tmpl_id', 'categ_id', 'name', 'list_price', 'standard_price',
            'pos_categ_ids', 'barcode', 'description_sale',
            'default_code', 'available_in_pos', 'image_128',
          ],
        },
      },
      sessionId
    );

    return NextResponse.json({ success: true, product: created?.[0] || null });
  } catch (error: any) {
    console.error('Product create error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create product' }, { status: 500 });
  }
}

/** PATCH /api/odoo/products — update an existing product */
export async function PATCH(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 401 });

    const body = await request.json();
    const { id, name, list_price, standard_price, barcode, description_sale, pos_categ_id, available_in_pos } = body;

    if (!id) return NextResponse.json({ error: 'Product id is required' }, { status: 400 });

    const vals: Record<string, any> = {};
    if (name !== undefined) vals.name = name;
    if (list_price !== undefined) vals.list_price = parseFloat(list_price);
    if (standard_price !== undefined) vals.standard_price = parseFloat(standard_price);
    if (barcode !== undefined) vals.barcode = barcode || false;
    if (description_sale !== undefined) vals.description_sale = description_sale || false;
    if (available_in_pos !== undefined) vals.available_in_pos = available_in_pos;
    if (pos_categ_id !== undefined) vals.pos_categ_ids = [[6, 0, pos_categ_id ? [parseInt(pos_categ_id)] : []]];

    await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'product.product',
        method: 'write',
        args: [[parseInt(id)], vals],
        kwargs: {},
      },
      sessionId
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Product update error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update product' }, { status: 500 });
  }
}
