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
      'Cookie': `session_id=${sessionId}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Odoo returned ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || 'Odoo RPC Error');
  }

  return data.result;
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session_id parameter' },
        { status: 401 }
      );
    }

    const customers = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'res.partner',
        method: 'search_read',
        args: [[['customer_rank', '>', 0]]], // Filter to show customers
        kwargs: {
          fields: ['id', 'name', 'phone', 'mobile', 'email', 'street', 'city', 'state_id', 'country_id', 'vat', 'barcode'],
          limit: 1000,
        },
      },
      sessionId
    );

    return NextResponse.json({
      success: true,
      customers: customers || [],
    });
  } catch (error: any) {
    console.error('Customers proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session_id parameter' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, phone, mobile, email, street, city, vat } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      );
    }

    const vals: Record<string, any> = {
      name,
      is_company: false,
      customer_rank: 1,
    };
    if (phone) vals.phone = phone;
    if (mobile) vals.mobile = mobile;
    if (email) vals.email = email;
    if (street) vals.street = street;
    if (city) vals.city = city;
    if (vat) vals.vat = vat;

    const newCustomerId = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'res.partner',
        method: 'create',
        args: [[vals]],
        kwargs: {},
      },
      sessionId
    );

    // Fetch the newly created customer to return it
    const newCustomerList = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'res.partner',
        method: 'read',
        args: [newCustomerId],
        kwargs: {
          fields: ['id', 'name', 'phone', 'mobile', 'email', 'street', 'city', 'state_id', 'country_id', 'vat', 'barcode'],
        },
      },
      sessionId
    );

    const newCustomer = newCustomerList && newCustomerList.length > 0 ? newCustomerList[0] : null;

    return NextResponse.json({
      success: true,
      customer: newCustomer,
    });
  } catch (error: any) {
    console.error('Customer create error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create customer' },
      { status: 500 }
    );
  }
}
