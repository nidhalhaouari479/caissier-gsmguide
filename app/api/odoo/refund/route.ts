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
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session_id=${sessionId}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Odoo returned ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.data?.message || data.error.message || 'Odoo RPC Error');
  return data.result;
}

async function getOdooSessionInfo(sessionId: string) {
  return odooRPC('/web/session/get_session_info', {}, sessionId);
}

/**
 * GET /api/odoo/refund?session_id=<id>&search=<term>
 * Returns past POS orders (paid) with their lines for refund selection.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');
    const search = request.nextUrl.searchParams.get('search') || '';

    if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 401 });

    const sessionInfo = await getOdooSessionInfo(sessionId);
    const sessionUid = sessionInfo?.uid;
    if (!sessionUid) return NextResponse.json({ error: 'Invalid Odoo session' }, { status: 401 });

    const domain: any[] = [['state', 'in', ['paid', 'done', 'invoiced']], ['user_id', '=', sessionUid]];
    if (search.trim()) {
      domain.push(['|', ['pos_reference', 'ilike', search], ['name', 'ilike', search]]);
    }

    const orders = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'pos.order',
        method: 'search_read',
        args: [domain],
        kwargs: {
          fields: ['id', 'name', 'pos_reference', 'date_order', 'amount_total', 'partner_id', 'lines'],
          order: 'date_order desc',
          limit: 20,
        },
      },
      sessionId
    );

    if (!orders || orders.length === 0) {
      return NextResponse.json({ success: true, orders: [] });
    }

    // Fetch order lines for all returned orders
    const lineIds = orders.flatMap((o: any) => (Array.isArray(o.lines) ? o.lines : []));

    const lines =
      lineIds.length > 0
        ? await odooRPC(
            '/web/dataset/call_kw',
            {
              model: 'pos.order.line',
              method: 'read',
              args: [lineIds],
              kwargs: {
                fields: ['id', 'order_id', 'product_id', 'full_product_name', 'qty', 'price_unit', 'discount', 'price_subtotal_incl'],
              },
            },
            sessionId
          )
        : [];

    // Group lines by order
    const linesByOrder = new Map<number, any[]>();
    if (Array.isArray(lines)) {
      for (const line of lines) {
        const orderId = Array.isArray(line.order_id) ? line.order_id[0] : line.order_id;
        if (!linesByOrder.has(orderId)) linesByOrder.set(orderId, []);
        linesByOrder.get(orderId)!.push({
          id: line.id,
          productId: Array.isArray(line.product_id) ? line.product_id[0] : line.product_id,
          productName: line.full_product_name || (Array.isArray(line.product_id) ? line.product_id[1] : 'Article'),
          qty: line.qty,
          price: line.price_unit,
          discount: line.discount || 0,
          total: line.price_subtotal_incl,
        });
      }
    }

    const result = (orders as any[]).map((o: any) => ({
      id: o.id,
      name: o.name,
      reference: o.pos_reference || o.name,
      date: o.date_order,
      total: o.amount_total,
      partner: Array.isArray(o.partner_id) ? o.partner_id[1] : null,
      lines: linesByOrder.get(o.id) || [],
    }));

    return NextResponse.json({ success: true, orders: result });
  } catch (error: any) {
    console.error('Refund GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch orders' }, { status: 500 });
  }
}

/**
 * POST /api/odoo/refund?session_id=<id>
 * Body: { originalOrderId: number, lines: [{ lineId, qty, price, productId }], uid: number }
 * Creates a refund (return) order in Odoo.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 401 });

    const { originalOrderId, lines, uid } = await request.json();

    if (!originalOrderId || !lines || lines.length === 0) {
      return NextResponse.json({ error: 'Missing originalOrderId or lines' }, { status: 400 });
    }

    const sessionInfo = await getOdooSessionInfo(sessionId);
    const sessionUid = sessionInfo?.uid;
    if (!sessionUid) {
      return NextResponse.json({ error: 'Invalid Odoo session' }, { status: 401 });
    }

    // Find open POS session for the current user
    const sessions = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'pos.session',
        method: 'search_read',
        args: [[['state', 'in', ['opening_control', 'opened']], ['user_id', '=', sessionUid]]],
        kwargs: { fields: ['id', 'config_id'], limit: 1 },
      },
      sessionId
    );

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: 'No open POS session found' }, { status: 400 });
    }

    const posSessionId: number = sessions[0].id;

    // Build negative order lines (refund = negative qty)
    const orderLines = lines.map((line: any) => {
      const qty = -Math.abs(line.qty); // always negative
      const lineTotal = line.price * qty * (1 - (line.discount || 0) / 100);
      return [
        0,
        0,
        {
          product_id: line.productId,
          qty,
          price_unit: line.price,
          discount: line.discount || 0,
          price_subtotal: lineTotal,
          price_subtotal_incl: lineTotal,
          tax_ids: [[6, false, []]],
        },
      ];
    });

    const refundTotal = lines.reduce((sum: number, l: any) => {
      return sum + l.price * Math.abs(l.qty) * (1 - (l.discount || 0) / 100);
    }, 0);

    // Create the refund order with negative amount
    const refundOrderId: number = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'pos.order',
        method: 'create',
        args: [
          {
            session_id: posSessionId,
            user_id: uid ? parseInt(uid) : false,
            amount_paid: -refundTotal,
            amount_tax: 0,
            amount_total: -refundTotal,
            amount_return: 0,
            lines: orderLines,
            // Link to original order if field exists — best-effort
            // to_invoice: false,
          },
        ],
        kwargs: {},
      },
      sessionId
    );

    // Get cash payment method for the refund
    let cashMethodId: number | false = false;
    try {
      const methods = await odooRPC(
        '/web/dataset/call_kw',
        {
          model: 'pos.payment.method',
          method: 'search_read',
          args: [[['is_cash_count', '=', true]]],
          kwargs: { fields: ['id'], limit: 1 },
        },
        sessionId
      );
      if (methods?.length > 0) cashMethodId = methods[0].id;
    } catch (_) {}

    // Record the refund payment (negative amount)
    if (cashMethodId) {
      await odooRPC(
        '/web/dataset/call_kw',
        {
          model: 'pos.payment',
          method: 'create',
          args: [
            {
              pos_order_id: refundOrderId,
              payment_method_id: cashMethodId,
              amount: -refundTotal,
            },
          ],
          kwargs: {},
        },
        sessionId
      );
    }

    // Mark as paid
    await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'pos.order',
        method: 'action_pos_order_paid',
        args: [[refundOrderId]],
        kwargs: {},
      },
      sessionId
    );

    // Read back the reference
    const [refundInfo] = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'pos.order',
        method: 'read',
        args: [[refundOrderId]],
        kwargs: { fields: ['name', 'pos_reference'] },
      },
      sessionId
    );

    return NextResponse.json({
      success: true,
      refund: {
        id: refundOrderId,
        name: refundInfo?.name || `Retour-${refundOrderId}`,
        reference: refundInfo?.pos_reference || refundInfo?.name,
        total: -refundTotal,
      },
    });
  } catch (error: any) {
    console.error('Refund POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create refund' }, { status: 500 });
  }
}
