import { NextRequest, NextResponse } from 'next/server';
import { createTicketCaisse } from '@/lib/odoo/ticket-caisse';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'http://localhost:8069';
const ODOO_RPC_TIMEOUT_MS = Number(process.env.ODOO_RPC_TIMEOUT_MS || 15000);

async function odooRPC(endpoint: string, params: any, sessionId: string) {
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    params,
    id: Math.floor(Math.random() * 1000000000),
  };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ODOO_RPC_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${ODOO_URL}${endpoint}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session_id=${sessionId}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      const label = params?.model && params?.method ? `${params.model}.${params.method}` : endpoint;
      throw new Error(`Timeout Odoo sur ${label} après ${Math.round(ODOO_RPC_TIMEOUT_MS / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) throw new Error(`Odoo returned ${response.status}`);

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || 'Odoo RPC Error');
  }
  return data.result;
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id parameter' }, { status: 401 });
    }

    const body = await request.json();
    const { cart, customer, uid, subtotal, tax, total, paymentReference } = body;

    if (!Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const partnerId = Number(customer?.id) || false;

    const ticket = await createTicketCaisse({
      odooRPC,
      sessionId,
      cart,
      customer,
      partnerId,
      uid,
      amountUntaxed: Number(subtotal) || 0,
      amountTax: Number(tax) || 0,
      amountTotal: Number(total) || 0,
      paymentReference,
      ticketName: paymentReference,
      skipOptionalLookups: true,
    });

    return NextResponse.json(ticket);
  } catch (error: any) {
    console.error('Ticket caisse creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create ticket caisse in Odoo' },
      { status: 500 }
    );
  }
}
