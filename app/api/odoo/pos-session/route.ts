import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const ODOO_URL = process.env.NEXT_PUBLIC_ODOO_URL || 'http://localhost:8069';

async function odooRPC(params: any, sessionId: string) {
  const res = await fetch(`${ODOO_URL}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `session_id=${sessionId}` },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params, id: Date.now() }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.data?.message || data.error.message || 'Odoo error');
  return data.result;
}

function normalizeAccessKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getUserAccessKeys(sessionInfo: any): string[] {
  const sourceValues = [
    sessionInfo?.name,
    sessionInfo?.username,
    sessionInfo?.partner_display_name,
    sessionInfo?.login,
  ].filter((v) => typeof v === 'string' && v.trim().length > 0) as string[];

  const keys = new Set<string>();
  for (const raw of sourceValues) {
    const normalized = normalizeAccessKey(raw);
    if (!normalized) continue;

    keys.add(normalized);
    for (const token of normalized.split(/[\s._-]+/g)) {
      if (token.length >= 2) keys.add(token);
    }
  }
  return Array.from(keys);
}

function getConfigOwnerKey(configName: string): string | null {
  const normalized = normalizeAccessKey(configName);
  if (!normalized) return null;
  const parts = normalized.split('-').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return parts[parts.length - 1];
}

function canUserAccessConfig(configName: string, userKeys: string[]): boolean {
  const ownerKey = getConfigOwnerKey(configName);
  if (!ownerKey) return true;
  return userKeys.some((k) => k === ownerKey);
}

function filterConfigsForUser(configs: any[], userKeys: string[]): any[] {
  return (configs || []).filter((cfg) => canUserAccessConfig(String(cfg?.name || ''), userKeys));
}

async function getSessionInfo(sessionId: string): Promise<any> {
  const res = await fetch(`${ODOO_URL}/web/session/get_session_info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `session_id=${sessionId}` },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: {}, id: 1 }),
  });
  const data = await res.json();
  return data?.result || null;
}

async function applyOpeningBalance(
  posSessionId: number,
  sessionId: string,
  balanceStart: number,
  note?: string
) {
  // Different Odoo versions/custom modules expose different field names.
  // We try common candidates without assuming a specific schema.
  const candidates: Record<string, any>[] = [
    { cash_register_balance_start: balanceStart, opening_notes: note || '' },
    { cash_register_balance_start: balanceStart },
    { opening_balance: balanceStart, opening_notes: note || '' },
    { opening_balance: balanceStart },
    { starting_balance: balanceStart },
  ];

  let lastErr: any = null;

  for (const vals of candidates) {
    try {
      await odooRPC(
        {
          model: 'pos.session',
          method: 'write',
          args: [[posSessionId], vals],
          kwargs: {},
        },
        sessionId
      );
      return;
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || '');
      // If this is a schema mismatch, try the next candidate.
      if (msg.includes('Invalid field')) continue;
      // For non-schema errors, stop immediately.
      throw err;
    }
  }

  // If all attempts failed only due unknown fields, do not block opening.
  // Some Odoo versions/customizations don't expose these fields.
  if (lastErr) {
    const msg = String(lastErr?.message || '');
    if (!msg.includes('Invalid field')) throw lastErr;
  }
}

async function registerOpeningFloat(
  posSessionId: number,
  sessionId: string,
  amount: number,
  note?: string
) {
  if (!amount || amount <= 0) return;

  const reason = note?.trim()
    ? `Fonds d'ouverture: ${note.trim()}`
    : "Fonds d'ouverture";

  const attempts: any[][] = [
    [[posSessionId], 'in', amount, reason, null],
    [[posSessionId], 'in', amount, reason],
    [[posSessionId], 'in', amount],
  ];

  let lastErr: any = null;
  for (const args of attempts) {
    try {
      await odooRPC(
        {
          model: 'pos.session',
          method: 'try_cash_in_out',
          args,
          kwargs: {},
        },
        sessionId
      );
      return;
    } catch (err: any) {
      lastErr = err;
    }
  }

  if (lastErr) {
    // Non-blocking: opening the session is still successful, but float may be ignored by Odoo.
    console.warn('Could not register opening float via try_cash_in_out:', lastErr?.message || lastErr);
  }
}

// GET: check for active POS session; if none, return available configs
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id') || '';
    if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });

    const sessionInfo = await getSessionInfo(sessionId);
    const uid = sessionInfo?.uid;
    if (!uid) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    const userKeys = getUserAccessKeys(sessionInfo);
    if (!userKeys.length) {
      return NextResponse.json({ error: "Impossible d'identifier l'utilisateur POS." }, { status: 403 });
    }

    // Search only active session owned by current user.
    const sessions = await odooRPC({
      model: 'pos.session', method: 'search_read',
      args: [[['state', 'in', ['opening_control', 'opened']], ['user_id', '=', uid]]],
      kwargs: { fields: ['id', 'name', 'config_id', 'start_at', 'state'], limit: 1, order: 'id desc' },
    }, sessionId);
    const allConfigs = await odooRPC({
      model: 'pos.config', method: 'search_read',
      args: [[['active', '=', true]]],
      kwargs: { fields: ['id', 'name'], limit: 50 },
    }, sessionId);
    const allowedConfigs = filterConfigsForUser(allConfigs || [], userKeys);

    if (sessions?.length) {
      const s = sessions[0];
      const isOpened = s.state === 'opened';
      
      return NextResponse.json({
        hasActiveSession: isOpened,
        needsOpeningControl: s.state === 'opening_control',
        session: {
          id: s.id,
          name: s.name,
          config_id: s.config_id,
          configName: Array.isArray(s.config_id) ? s.config_id[1] : '',
          startedAt: s.start_at,
          state: s.state,
        },
        configs: !isOpened ? allowedConfigs : []
      });
    }

    // No active session — return available POS configs
    return NextResponse.json({ hasActiveSession: false, session: null, configs: allowedConfigs || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST { configId, openingBalance }: open a POS session (or reuse existing one)
export async function POST(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id') || '';
    const { configId, openingBalance, note } = await request.json();
    if (!sessionId || !configId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    const configIdNum = Number(configId);
    if (!Number.isFinite(configIdNum) || configIdNum <= 0) {
      return NextResponse.json({ error: 'configId invalide.' }, { status: 400 });
    }

    const sessionInfo = await getSessionInfo(sessionId);
    const uid = sessionInfo?.uid;
    if (!uid) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    const userKeys = getUserAccessKeys(sessionInfo);
    if (!userKeys.length) {
      return NextResponse.json({ error: "Impossible d'identifier l'utilisateur POS." }, { status: 403 });
    }

    const configRows = await odooRPC({
      model: 'pos.config',
      method: 'search_read',
      args: [[['id', '=', configIdNum], ['active', '=', true]]],
      kwargs: { fields: ['id', 'name'], limit: 1 },
    }, sessionId);
    const selectedConfig = configRows?.[0];
    if (!selectedConfig) return NextResponse.json({ error: 'Caisse introuvable.' }, { status: 404 });
    if (!canUserAccessConfig(String(selectedConfig.name || ''), userKeys)) {
      return NextResponse.json({ error: 'Acces refuse: cette caisse ne vous est pas assignee.' }, { status: 403 });
    }

    const balanceStart = parseFloat(openingBalance) || 0;
    console.log(`[API] Opening session for config ${configIdNum} with balance: ${balanceStart}`);

    // Step 1: Check if a session is already open/opening for this config — reuse it
    const existingSessions = await odooRPC({
      model: 'pos.session', method: 'search_read',
      args: [[['config_id', '=', configIdNum], ['state', 'in', ['opening_control', 'opened']], ['user_id', '=', uid]]],
      kwargs: { fields: ['id', 'name', 'state', 'config_id'], limit: 1 },
    }, sessionId);

    if (existingSessions?.length) {
      const s = existingSessions[0];
      
      if (s.state === 'opening_control') {
        // Apply opening balance on session + statements before opening.
        await applyOpeningBalance(s.id, sessionId, balanceStart, note);

        // Ensure opening control state transition is processed (safe no-op if already done).
        try {
          await odooRPC({
            model: 'pos.session', method: 'action_pos_session_opening_control',
            args: [[s.id]], kwargs: {},
          }, sessionId);
        } catch (e) {
          // Continue: some databases are already in opening_control.
        }

        // Re-apply after opening control because Odoo can re-seed from last closing.
        await applyOpeningBalance(s.id, sessionId, balanceStart, note);

        // Open the session.
        try {
          await odooRPC({
            model: 'pos.session', method: 'action_pos_session_open',
            args: [[s.id]], kwargs: {},
          }, sessionId);
        } catch (e) {
          // Continue to final read; some versions auto-open.
        }

        // Ensure opening amount impacts expected cash even when opening balance fields are ignored.
        await registerOpeningFloat(s.id, sessionId, balanceStart, note);
      }
      return NextResponse.json({ success: true, session: { id: s.id, name: s.name } });
    }

    // Step 2: No existing session — create one with the correct balance from the start
    let newSessionId;
    try {
      newSessionId = await odooRPC({
        model: 'pos.session', method: 'create',
        args: [{ 
          config_id: configIdNum,
          cash_register_balance_start: balanceStart,
          opening_notes: note || ''
        }], kwargs: {},
      }, sessionId);
    } catch (createErr: any) {
      // If manual create fails, try the standard method as fallback
      try {
        await odooRPC({ model: 'pos.config', method: 'open_session_cb', args: [[configIdNum]], kwargs: {} }, sessionId);
        const created = await odooRPC({
          model: 'pos.session', method: 'search_read',
          args: [[['config_id', '=', configIdNum], ['state', '=', 'opening_control'], ['user_id', '=', uid]]],
          kwargs: { fields: ['id'], limit: 1 },
        }, sessionId);
        if (created?.length) newSessionId = created[0].id;
      } catch {
        return NextResponse.json({ error: createErr.message }, { status: 500 });
      }
    }

    if (newSessionId) {
      // Step A: Set opening amount on session + statements
      await applyOpeningBalance(newSessionId, sessionId, balanceStart, note);

      // Step B: Initialize opening control (moves to opening_control)
      try {
        await odooRPC({
          model: 'pos.session', method: 'action_pos_session_opening_control',
          args: [[newSessionId]], kwargs: {},
        }, sessionId);
      } catch (e) {
        // Continue: some DBs are already past this state.
      }

      // Re-apply after opening control to prevent fallback to previous closing balance.
      await applyOpeningBalance(newSessionId, sessionId, balanceStart, note);

      // Step C: Open session (moves to opened)
      try {
        await odooRPC({
          model: 'pos.session', method: 'action_pos_session_open',
          args: [[newSessionId]], kwargs: {},
        }, sessionId);
      } catch (e) {
        // Continue to final read; some setups auto-open.
      }

      // Ensure opening amount impacts expected cash even when opening balance fields are ignored.
      await registerOpeningFloat(newSessionId, sessionId, balanceStart, note);
    }

    // Step 3: Return the newly opened session
    const sessions = await odooRPC({
      model: 'pos.session', method: 'search_read',
      args: [[['config_id', '=', configIdNum], ['state', 'in', ['opening_control', 'opened']], ['user_id', '=', uid]]],
      kwargs: { fields: ['id', 'name', 'config_id'], limit: 1 },
    }, sessionId);

    if (!sessions?.length) return NextResponse.json({ error: 'Session ouverte mais introuvable.' }, { status: 500 });

    return NextResponse.json({
      success: true,
      session: { id: sessions[0].id, name: sessions[0].name },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
