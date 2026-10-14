import { NextRequest, NextResponse } from 'next/server';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'http://localhost:8069';

async function odooRPC(endpoint: string, params: any, sessionId: string) {
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    params,
    id: Math.floor(Math.random() * 1000000000),
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

function pickNumber(obj: Record<string, any>, keys: string[]): number {
  for (const key of keys) {
    const value = obj?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return 0;
}

function isAlreadyClosedError(error: any): boolean {
  const msg = String(error?.message || '').toLowerCase();
  return (
    msg.includes('déjà fermée') ||
    msg.includes('deja fermee') ||
    msg.includes('déjà clôturée') ||
    msg.includes('closed') ||
    msg.includes('no open pos session')
  );
}

/**
 * GET /api/odoo/session?session_id=<id>
 *
 * Validates an Odoo session or fetches a summary if summary=true.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');
    const summary = request.nextUrl.searchParams.get('summary') === 'true';
    const targetPosSessionId = parseInt(request.nextUrl.searchParams.get('pos_session_id') || '', 10);
    const openingOverride = parseFloat(request.nextUrl.searchParams.get('opening_override') || '');

    if (!sessionId) {
      return NextResponse.json({ valid: false, error: 'Missing session_id' }, { status: 400 });
    }

    // Get basic session info (uid, name)
    const sessionInfo = await odooRPC('/web/session/get_session_info', {}, sessionId);

    if (!sessionInfo || sessionInfo.uid === false || !sessionInfo.uid) {
      return NextResponse.json({ valid: false });
    }

    if (!summary) {
      const currentCompany = sessionInfo.user_companies?.current_company;
      const allowedCompanies = Array.isArray(sessionInfo.user_companies?.allowed_companies)
        ? sessionInfo.user_companies.allowed_companies
        : [];
      const companyNames = allowedCompanies
        .map((c: any) => (Array.isArray(c) ? c[1] : null))
        .filter((name: any) => typeof name === 'string' && name.trim().length > 0);

      return NextResponse.json({
        valid: true,
        uid: sessionInfo.uid,
        name: sessionInfo.name || sessionInfo.partner_display_name || '',
        username: sessionInfo.username || '',
        company_name: Array.isArray(currentCompany) ? currentCompany[1] : undefined,
        company_names: companyNames,
      });
    }

    // Fetch POS session summary.
    // Important: if a specific POS session id is provided, never fallback
    // to another global session (prevents mixing wrong sessions).
    let finalSessions: any[] = [];
    if (Number.isFinite(targetPosSessionId) && targetPosSessionId > 0) {
      finalSessions = await odooRPC(
        '/web/dataset/call_kw',
        {
          model: 'pos.session',
          method: 'search_read',
          args: [[['id', '=', targetPosSessionId], ['state', 'in', ['opening_control', 'opened']]]],
          kwargs: {
            fields: ['id', 'name', 'user_id', 'start_at'],
            limit: 1,
          },
        },
        sessionId
      );
    } else {
      const sessions = await odooRPC(
        '/web/dataset/call_kw',
        {
          model: 'pos.session',
          method: 'search_read',
          args: [[['state', 'in', ['opening_control', 'opened']], ['user_id', '=', sessionInfo.uid]]],
          kwargs: {
            fields: ['id', 'name', 'user_id', 'start_at'],
            limit: 1,
            order: 'id desc',
          },
        },
        sessionId
      );

      finalSessions = sessions;

      // No explicit target provided: global fallback is allowed.
      if (!finalSessions || finalSessions.length === 0) {
        finalSessions = await odooRPC(
          '/web/dataset/call_kw',
          {
            model: 'pos.session',
            method: 'search_read',
            args: [[['state', 'in', ['opening_control', 'opened']]]],
            kwargs: {
              fields: ['id', 'name', 'user_id', 'start_at'],
              limit: 1,
              order: 'id desc',
            },
          },
          sessionId
        );
      }
    }

    if (!finalSessions || finalSessions.length === 0) {
      return NextResponse.json({ valid: true, no_active_pos_session: true });
    }

    const baseSession = finalSessions[0];

    // Read full session record to support custom schemas / field names.
    const sessionRead = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'pos.session',
        method: 'read',
        args: [[baseSession.id]],
        kwargs: {},
      },
      sessionId
    );
    const session = sessionRead?.[0] || baseSession;

    // Fetch payments breakdown
    const payments = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'pos.payment',
        method: 'read_group',
        args: [[['session_id', '=', baseSession.id]]],
        kwargs: {
          fields: ['amount', 'payment_method_id'],
          groupby: ['payment_method_id'],
        },
      },
      sessionId
    );

    const paymentBreakdown = payments.map((p: any) => ({
      method: p.payment_method_id[1],
      amount: p.amount,
      methodId: p.payment_method_id[0],
    }));

    // Fetch sold products detail for closure ticket
    const orders = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'pos.order',
        method: 'search_read',
        args: [[['session_id', '=', baseSession.id], ['state', '!=', 'cancel']]],
        kwargs: {
          fields: ['id'],
          order: 'id asc',
          limit: 5000,
        },
      },
      sessionId
    );

    const orderIds = (orders || []).map((o: any) => o.id).filter((id: any) => Number.isFinite(id));
    const productAgg = new Map<string, {
      name: string;
      qty: number;
      unit_price: number;
      gross: number;
      discount: number;
      net: number;
    }>();

    if (orderIds.length > 0) {
      const orderLines = await odooRPC(
        '/web/dataset/call_kw',
        {
          model: 'pos.order.line',
          method: 'search_read',
          args: [[['order_id', 'in', orderIds]]],
          kwargs: {
            fields: ['product_id', 'full_product_name', 'qty', 'price_unit', 'discount', 'price_subtotal_incl'],
            limit: 10000,
            order: 'id asc',
          },
        },
        sessionId
      );

      for (const line of orderLines || []) {
        const qty = Number(line?.qty || 0);
        if (!Number.isFinite(qty) || qty <= 0) continue;

        const unitPrice = Number(line?.price_unit || 0);
        const gross = unitPrice * qty;
        const net = Number(line?.price_subtotal_incl || 0);
        const discount = Math.max(0, gross - net);
        const name =
          (typeof line?.full_product_name === 'string' && line.full_product_name.trim()) ||
          (Array.isArray(line?.product_id) ? String(line.product_id[1]) : 'Produit');
        const productId = Array.isArray(line?.product_id) ? String(line.product_id[0]) : name;
        const key = `${productId}::${name}`;

        const current = productAgg.get(key) || {
          name,
          qty: 0,
          unit_price: unitPrice,
          gross: 0,
          discount: 0,
          net: 0,
        };

        current.qty += qty;
        current.gross += gross;
        current.discount += discount;
        current.net += net;
        if (current.unit_price <= 0 && unitPrice > 0) current.unit_price = unitPrice;
        productAgg.set(key, current);
      }
    }

    const soldProducts = Array.from(productAgg.values());
    const salesGross = soldProducts.reduce((acc, p) => acc + p.gross, 0);
    const salesDiscount = soldProducts.reduce((acc, p) => acc + p.discount, 0);
    const salesNet = soldProducts.reduce((acc, p) => acc + p.net, 0);
    const totalQtySold = soldProducts.reduce((acc, p) => acc + p.qty, 0);

    // Calculate expected cash
    let openingBalance = pickNumber(session, [
      'cash_register_balance_start',
      'opening_balance',
      'starting_balance',
      'balance_start',
    ]);
    const totalPayments = pickNumber(session, ['total_payments_amount']);

    // Manual fallback for safety (if Odoo's value seems stale or is 0)
    const cashMethodPayments = paymentBreakdown
      .filter((p: any) => {
        const name = (p.method || '').toLowerCase();
        return name.includes('esp') || name.includes('cash') || name.includes('argent');
      })
      .reduce((acc: number, p: any) => acc + p.amount, 0);

    // Always trust the opening amount captured at session opening when provided by frontend.
    // This avoids stale carry-over values from previous session closures.
    if (Number.isFinite(openingOverride) && openingOverride >= 0) {
      openingBalance = openingOverride;
    }

    // Source of truth for expected cash:
    // expected = opening float of THIS session + cash payments of THIS session.
    const expectedCash = openingBalance + cashMethodPayments;

    return NextResponse.json({
      valid: true,
      summary: {
        id: baseSession.id,
        name: baseSession.name,
        cashierName: Array.isArray(baseSession.user_id) ? baseSession.user_id[1] : null,
        opened_at: baseSession.start_at,
        opening_balance: openingBalance,
        total_payments: totalPayments,
        expected_cash: expectedCash,
        payments: paymentBreakdown,
        sold_products: soldProducts,
        sales: {
          gross: salesGross,
          discount: salesDiscount,
          net: salesNet,
          qty: totalQtySold,
          order_count: orderIds.length,
        },
      },
    });
  } catch (error: any) {
    console.error('Session validation error:', error);
    return NextResponse.json({ valid: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/odoo/session?session_id=<id>
 *
 * Finalizes and closes the POS session.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');
    const { closingBalance, posSessionId: requestedPosSessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    const sessionInfo = await odooRPC('/web/session/get_session_info', {}, sessionId);
    if (!sessionInfo || !sessionInfo.uid) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // 1. Find the target open/opening session.
    if (Number.isFinite(requestedPosSessionId) && requestedPosSessionId > 0) {
      const exact = await odooRPC(
        '/web/dataset/call_kw',
        {
          model: 'pos.session',
          method: 'search_read',
          args: [[['id', '=', requestedPosSessionId], ['state', 'in', ['opening_control', 'opened']]]],
          kwargs: { fields: ['id'], limit: 1 },
        },
        sessionId
      );

      if (exact?.length) {
        const posSessionId = exact[0].id;

        await odooRPC(
          '/web/dataset/call_kw',
          {
            model: 'pos.session',
            method: 'write',
            args: [[posSessionId], { cash_register_balance_end_real: parseFloat(closingBalance) }],
            kwargs: {},
          },
          sessionId
        );

        await odooRPC(
          '/web/dataset/call_kw',
          {
            model: 'pos.session',
            method: 'action_pos_session_closing_control',
            args: [[posSessionId]],
            kwargs: {},
          },
          sessionId
        );

        await odooRPC(
          '/web/dataset/call_kw',
          {
            model: 'pos.session',
            method: 'action_pos_session_validate',
            args: [[posSessionId]],
            kwargs: {},
          },
          sessionId
        );

        return NextResponse.json({ success: true });
      }
    }

    // 2. Fallback by user then global latest.
    let sessions = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'pos.session',
        method: 'search_read',
        args: [[['state', 'in', ['opening_control', 'opened']], ['user_id', '=', sessionInfo.uid]]],
        kwargs: { fields: ['id'], limit: 1, order: 'id desc' },
      },
      sessionId
    );
    if (!sessions || sessions.length === 0) {
      sessions = await odooRPC(
        '/web/dataset/call_kw',
        {
          model: 'pos.session',
          method: 'search_read',
          args: [[['state', 'in', ['opening_control', 'opened']]]],
          kwargs: { fields: ['id'], limit: 1, order: 'id desc' },
        },
        sessionId
      );
    }

    if (!sessions || sessions.length === 0) {
      // Treat as idempotent close: already closed or not open anymore.
      return NextResponse.json({ success: true, alreadyClosed: true });
    }

    const posSessionId = sessions[0].id;

    // 2. Set the real closing balance
    await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'pos.session',
        method: 'write',
        args: [[posSessionId], { cash_register_balance_end_real: parseFloat(closingBalance) }],
        kwargs: {},
      },
      sessionId
    );

    // 3. Move to closing control
    await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'pos.session',
        method: 'action_pos_session_closing_control',
        args: [[posSessionId]],
        kwargs: {},
      },
      sessionId
    );

    // 4. Validate and Close
    await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'pos.session',
        method: 'action_pos_session_validate',
        args: [[posSessionId]],
        kwargs: {},
      },
      sessionId
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (isAlreadyClosedError(error)) {
      return NextResponse.json({ success: true, alreadyClosed: true });
    }
    console.error('Session closure error:', error);
    return NextResponse.json({ error: error.message || 'Failed to close session' }, { status: 500 });
  }
}
