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

async function getOdooSessionInfo(sessionId: string) {
  return odooRPC('/web/session/get_session_info', {}, sessionId);
}

/**
 * GET /api/odoo/payment-methods?session_id=<id>
 * Returns the payment methods configured on the open POS session.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 401 });
    }

    const sessionInfo = await getOdooSessionInfo(sessionId);
    const sessionUid = sessionInfo?.uid;
    if (!sessionUid) {
      return NextResponse.json({ error: 'Invalid Odoo session' }, { status: 401 });
    }

    // Find open POS session for the current user
    const sessions = await odooRPC('/web/dataset/call_kw', {
      model: 'pos.session',
      method: 'search_read',
      args: [[['state', 'in', ['opening_control', 'opened']], ['user_id', '=', sessionUid]]],
      kwargs: { fields: ['id', 'config_id'], limit: 1 },
    }, sessionId);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json(
        { error: 'No open POS session found. Please open a session in Odoo first.' },
        { status: 400 }
      );
    }

    const configId: number = sessions[0].config_id[0];

    // Get payment method IDs from the POS config
    const configData = await odooRPC('/web/dataset/call_kw', {
      model: 'pos.config',
      method: 'read',
      args: [[configId]],
      kwargs: { fields: ['payment_method_ids'] },
    }, sessionId);

    const methodIds: number[] = configData?.[0]?.payment_method_ids || [];
    if (methodIds.length === 0) {
      return NextResponse.json({ methods: [] });
    }

    // Read method details
    const methods = await odooRPC('/web/dataset/call_kw', {
      model: 'pos.payment.method',
      method: 'read',
      args: [methodIds],
      kwargs: { fields: ['id', 'name', 'is_cash_count'] },
    }, sessionId) as any[];

    let mappedMethods = methods.map((m) => ({
      id: m.id,
      name: m.name,
      isCash: m.is_cash_count,
    }));

    // CRITICAL: Odoo will reject any payment method not in the 'config'
    // If no cash method is linked to the session, we must alias a valid allowed ID
    if (!mappedMethods.some(m => m.isCash) && methodIds.length > 0) {
      // Find the first allowed ID to use as a fallback relay
      const fallbackId = methodIds[0];
      mappedMethods.unshift({
        id: fallbackId, 
        name: 'Espèces', 
        isCash: true // We treat it as cash in the UI
      });
    }

    return NextResponse.json({
      methods: mappedMethods,
    });
  } catch (error: any) {
    console.error('Payment methods error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
