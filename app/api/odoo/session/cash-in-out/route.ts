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

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');
    const { amount, reason } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    const sessionInfo = await odooRPC('/web/session/get_session_info', {}, sessionId);
    if (!sessionInfo || !sessionInfo.uid) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // 1. Find the open POS session
    const sessions = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'pos.session',
        method: 'search_read',
        args: [[['state', 'in', ['opening_control', 'opened']], ['user_id', '=', sessionInfo.uid]]],
        kwargs: { fields: ['id'], limit: 1 },
      },
      sessionId
    );

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: 'No open POS session found' }, { status: 400 });
    }

    const posSessionId = sessions[0].id;

    // Determine type and absolute amount
    const _type = amount < 0 ? 'out' : 'in';
    const absAmount = Math.abs(amount);

    // 2. Call try_cash_in_out
    const result = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'pos.session',
        method: 'try_cash_in_out',
        args: [[posSessionId], _type, absAmount, reason, null],
        kwargs: {},
      },
      sessionId
    );

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Cash in/out error:', error);
    return NextResponse.json({ error: error.message || 'Failed to register cash movement' }, { status: 500 });
  }
}
