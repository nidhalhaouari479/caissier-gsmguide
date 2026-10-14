import { NextRequest, NextResponse } from 'next/server';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'http://localhost:8069';

export async function POST(request: NextRequest) {
  try {
    const { db, login, password } = await request.json();

    if (!db || !login || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: db, login, password' },
        { status: 400 }
      );
    }

    const payload = {
      jsonrpc: '2.0',
      method: 'call',
      params: { db, login, password },
      id: Math.floor(Math.random() * 1000000000),
    };

    const odooResponse = await fetch(`${ODOO_URL}/web/session/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!odooResponse.ok) {
      return NextResponse.json(
        { error: `Odoo server returned ${odooResponse.status}` },
        { status: odooResponse.status }
      );
    }

    const data = await odooResponse.json();

    if (data.error) {
      return NextResponse.json(
        { error: data.error.data?.message || data.error.message || 'Authentication failed' },
        { status: 401 }
      );
    }

    const result = data.result;

    // Odoo returns uid = false when auth fails
    if (!result || result.uid === false) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Extract session_id from Odoo's Set-Cookie header
    const setCookie = odooResponse.headers.get('set-cookie') || '';
    const sessionMatch = setCookie.match(/session_id=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : result.session_id;

    const companyId = Array.isArray(result.company_id) ? result.company_id[0] : result.company_id;
    const companyNameFromCompanyId = Array.isArray(result.company_id) ? result.company_id[1] : undefined;
    const currentCompany = result.user_companies?.current_company;
    const allowedCompanies = Array.isArray(result.user_companies?.allowed_companies)
      ? result.user_companies.allowed_companies
      : [];
    const companyNames = allowedCompanies
      .map((c: any) => (Array.isArray(c) ? c[1] : null))
      .filter((name: any) => typeof name === 'string' && name.trim().length > 0);
    const currentCompanyName =
      (Array.isArray(currentCompany) ? currentCompany[1] : undefined) ||
      companyNameFromCompanyId;

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      uid: result.uid,
      username: result.username || login,
      name: result.name || result.partner_display_name || login,
      company_id: companyId,
      company_name: currentCompanyName,
      company_names: companyNames,
    });
  } catch (error: any) {
    console.error('Auth proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect to Odoo server' },
      { status: 500 }
    );
  }
}
