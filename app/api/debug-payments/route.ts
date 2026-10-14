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

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!sessionId) return NextResponse.json({ error: 'No session' });

  try {
    // 1. Get all payment methods in Odoo
    const allMethods = await odooRPC('/web/dataset/call_kw', {
      model: 'pos.payment.method',
      method: 'search_read',
      args: [[]],
      kwargs: { fields: ['id', 'name', 'is_cash_count'] },
    }, sessionId);

    // 2. Get active POS sessions
    const sessions = await odooRPC('/web/dataset/call_kw', {
      model: 'pos.session',
      method: 'search_read',
      args: [[['state', 'in', ['opening_control', 'opened']]]],
      kwargs: { fields: ['id', 'config_id'] },
    }, sessionId);

    let configDetails = [];
    if (sessions.length > 0) {
      for (const s of sessions) {
        const config = await odooRPC('/web/dataset/call_kw', {
          model: 'pos.config',
          method: 'read',
          args: [[s.config_id[0]]],
          kwargs: { fields: ['id', 'name', 'payment_method_ids'] },
        }, sessionId);
        configDetails.push(config[0]);
      }
    }

    return NextResponse.json({
      allMethodsInOdoo: allMethods,
      activeSessions: sessions,
      posConfigs: configDetails
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
