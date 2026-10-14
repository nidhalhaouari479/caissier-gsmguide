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

async function getOdooSessionInfo(sessionId: string) {
  return await odooRPC('/web/session/get_session_info', {}, sessionId);
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id parameter' }, { status: 401 });
    }

    const body = await request.json();
    const {
      cart,
      total,
      tax,
      subtotal,
      customer,
      uid,
      paymentMethodId: reqPaymentMethodId,
    } = body;
    const createOdooInvoice = body.createOdooInvoice ?? body.wantsInvoice ?? true;
    const includeFiscalStamp = Boolean(body.includeFiscalStamp ?? createOdooInvoice);

    // ── 1. Find an open/opening POS session ──────────────────────────────────
    const sessionInfo = await getOdooSessionInfo(sessionId);
    const sessionUid = Number(sessionInfo?.uid || 0);
    if (!Number.isFinite(sessionUid) || sessionUid <= 0) {
      return NextResponse.json({ error: 'Session Odoo invalide ou utilisateur introuvable.' }, { status: 401 });
    }

    let sessions = await odooRPC(
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
      sessions = await odooRPC(
        '/web/dataset/call_kw',
        {
          model: 'pos.session',
          method: 'search_read',
          args: [[['state', 'in', ['opening_control', 'opened']]]],
          kwargs: { fields: ['id', 'config_id'], limit: 1 },
        },
        sessionId
      );
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json(
        { error: 'Aucune session POS ouverte. Veuillez ouvrir une session dans Odoo.' },
        { status: 400 }
      );
    }

    const posSessionId: number = sessions[0].id;
    const configId: number     = sessions[0].config_id[0];

    // ── 2. Use the provided payment method id ────────────────────────────────
    let paymentMethodId: number | false = reqPaymentMethodId ? parseInt(reqPaymentMethodId, 10) : false;

    // Fallback: pick any available payment method if none provided
    if (!paymentMethodId) {
      const any = await odooRPC(
        '/web/dataset/call_kw',
        {
          model:  'pos.payment.method',
          method: 'search_read',
          args:   [[]],
          kwargs: { fields: ['id'], limit: 1 },
        },
        sessionId
      );
      if (any?.length > 0) paymentMethodId = any[0].id;
    }

    // Fetch the accounting journal linked to this POS payment method
    let accountJournalId: number | false = false;
    if (paymentMethodId) {
      const methodData = await odooRPC(
        '/web/dataset/call_kw',
        {
          model: 'pos.payment.method',
          method: 'read',
          args: [[paymentMethodId]],
          kwargs: { fields: ['journal_id'] },
        },
        sessionId
      );
      accountJournalId = methodData?.[0]?.journal_id?.[0] || false;
    }

    // ── 3. Build order lines ─────────────────────────────────────────────────
    const orderLines = cart.map((item: any) => {
      const priceUnit = item.product.price;
      const qty       = item.quantity;
      const discountAmount = item.discountAmount || 0;
      const lineTotalBeforeDiscount = priceUnit * qty;
      const discountPercentage = lineTotalBeforeDiscount > 0 ? (discountAmount / lineTotalBeforeDiscount) * 100 : 0;
      const lineTotal = lineTotalBeforeDiscount - discountAmount;
      
      // Append IMEI to the product name/description if provided
      const displayName = item.imei 
        ? `${item.product.name} (IMEI: ${item.imei})` 
        : item.product.name;

      return [
        0,
        0,
        {
          product_id:          parseInt(item.product.id),
          qty,
          price_unit:          priceUnit,
          discount:            discountPercentage,
          price_subtotal:      lineTotal,
          price_subtotal_incl: lineTotal,
          tax_ids:             [[6, false, []]],
          name:                displayName, // Custom name for the line
        },
      ];
    });

    // ── 3.5. Handle Timbre Fiscal (1.000 DT) ─────────────────────────────────
    const hasTimbre = includeFiscalStamp;
    if (hasTimbre) {
      try {
        const timbreProducts = await odooRPC(
          '/web/dataset/call_kw',
          {
            model: 'product.product',
            method: 'search_read',
            args: [[['name', 'ilike', 'Timbre Fiscal']]],
            kwargs: { fields: ['id'], limit: 1 },
          },
          sessionId
        );

        if (timbreProducts?.length > 0) {
          orderLines.push([
            0,
            0,
            {
              product_id: timbreProducts[0].id,
              qty: 1,
              price_unit: 1.0,
              discount: 0,
              price_subtotal: 1.0,
              price_subtotal_incl: 1.0,
              tax_ids: [[6, false, []]],
              name: 'Timbre Fiscal',
            },
          ]);
        }
      } catch (err) {
        console.warn('Could not find Timbre Fiscal product in Odoo:', err);
      }
    }

    // ── 3.5. Ensure a Customer exists (Required for Invoicing) ───────────────
    let partnerId: number | false = customer?.id ? parseInt(customer.id) : false;
    if (!partnerId) {
      // Search for a generic "Public User" or "Customer" if none selected
      const publicCustomer = await odooRPC(
        '/web/dataset/call_kw',
        {
          model: 'res.partner',
          method: 'search_read',
          args: [[['name', 'ilike', 'Public'], ['customer_rank', '>', 0]]],
          kwargs: { fields: ['id'], limit: 1 },
        },
        sessionId
      );
      if (publicCustomer?.length > 0) {
        partnerId = publicCustomer[0].id;
      } else {
        // Just pick any generic customer as fallback
        const anyCustomer = await odooRPC(
          '/web/dataset/call_kw',
          {
            model: 'res.partner',
            method: 'search_read',
            args: [[['customer_rank', '>', 0]]],
            kwargs: { fields: ['id'], limit: 1 },
          },
          sessionId
        );
        if (anyCustomer?.length > 0) partnerId = anyCustomer[0].id;
      }
    }

    // ── 4. Create pos.order ──────────────────────────────────────────────────
    const orderId: number = await odooRPC(
      '/web/dataset/call_kw',
      {
        model:  'pos.order',
        method: 'create',
        args: [
          {
            session_id:    posSessionId,
            partner_id:    partnerId,
            user_id:       uid ? parseInt(uid) : false,
            amount_paid:   total,
            amount_tax:    tax,
            amount_total:  total,
            amount_return: 0,
            lines:         orderLines,
          },
        ],
        kwargs: {},
      },
      sessionId
    );

    // ── 5. Record the POS payment ────────────────────────────────────────────
    if (paymentMethodId) {
      await odooRPC(
        '/web/dataset/call_kw',
        {
          model:  'pos.payment',
          method: 'create',
          args: [
            {
              pos_order_id:      orderId,
              payment_method_id: paymentMethodId,
              amount:            total,
              payment_date:      new Date().toISOString().split('T')[0],
            },
          ],
          kwargs: {},
        },
        sessionId
      );
    }

    // ── 6. Finalise: mark order as paid ──────────────────────────────────────
    await odooRPC(
      '/web/dataset/call_kw',
      {
        model:  'pos.order',
        method: 'action_pos_order_paid',
        args:   [[orderId]],
        kwargs: {},
      },
      sessionId
    );

    // ── 7. Create and Register Payment in Invoicing App ──────────────────────
    const [orderInfo] = await odooRPC(
      '/web/dataset/call_kw',
      {
        model:  'pos.order',
        method: 'read',
        args:   [[orderId]],
        kwargs: { fields: ['name', 'pos_reference'] },
      },
      sessionId
    );
    const orderReference = orderInfo?.pos_reference || orderInfo?.name || `Order-${orderId}`;

    let invoiceId: number | null = null;
    let invoiceNumber: string | null = null;
    let ticketId: number | null = null;
    let documentType = createOdooInvoice ? 'invoice' : 'ticket_caisse';

    if (createOdooInvoice) {
      try {
        await odooRPC(
          '/web/dataset/call_kw',
          {
            model:  'pos.order',
            method: 'action_pos_order_invoice',
            args:   [[orderId]],
            kwargs: {},
          },
          sessionId
        );

        const [orderWithInvoice] = await odooRPC(
          '/web/dataset/call_kw',
          {
            model:  'pos.order',
            method: 'read',
            args:   [[orderId]],
            kwargs: { fields: ['account_move'] },
          },
          sessionId
        );

        const accountMoveRaw = orderWithInvoice?.account_move;
        invoiceId = Array.isArray(accountMoveRaw)
          ? accountMoveRaw[0]
          : (typeof accountMoveRaw === 'number' ? accountMoveRaw : null);

        if (!invoiceId) {
          throw new Error('La facture account.move n a pas ete creee.');
        }

        const [invoiceData] = await odooRPC(
          '/web/dataset/call_kw',
          {
            model:  'account.move',
            method: 'read',
            args:   [[invoiceId]],
            kwargs: { fields: ['name', 'journal_id', 'amount_residual', 'payment_state'] },
          },
          sessionId
        );
        invoiceNumber = invoiceData?.name || null;

        const journalToUse = accountJournalId || invoiceData?.journal_id?.[0];
        const amountResidual = Number(invoiceData?.amount_residual ?? total);
        const isAlreadyPaid = invoiceData?.payment_state === 'paid' || Math.abs(amountResidual) < 0.001;

        if (journalToUse && !isAlreadyPaid) {
          try {
            const wizardId = await odooRPC(
              '/web/dataset/call_kw',
              {
                model: 'account.payment.register',
                method: 'create',
                args: [{
                  journal_id: journalToUse,
                  amount: Math.min(total, Math.abs(amountResidual)),
                  payment_date: new Date().toISOString().split('T')[0],
                }],
                kwargs: {
                  context: {
                    active_model: 'account.move',
                    active_ids: [invoiceId],
                  },
                },
              },
              sessionId
            );

            await odooRPC(
              '/web/dataset/call_kw',
              {
                model: 'account.payment.register',
                method: 'action_create_payments',
                args: [[wizardId]],
                kwargs: {},
              },
              sessionId
            );
          } catch (paymentErr: any) {
            const paymentMessage = String(paymentErr?.message || '');
            const nothingToPay =
              paymentMessage.toLowerCase().includes('nothing') ||
              paymentMessage.toLowerCase().includes('rien') ||
              paymentMessage.toLowerCase().includes('plus rien');

            if (!nothingToPay) {
              throw paymentErr;
            }

            console.warn('Invoice payment registration skipped because Odoo says nothing is due:', paymentMessage);
          }
        } else if (isAlreadyPaid) {
          console.log('Invoice payment registration skipped: invoice already paid or residual is zero.', {
            invoiceId,
            amountResidual,
            paymentState: invoiceData?.payment_state,
          });
        }

        console.log('Order final document created', { type: documentType, invoiceId, invoiceNumber });
      } catch (invoiceErr: any) {
        console.warn('Invoice creation failed; falling back to receipt/ticket.', invoiceErr.message);
        documentType = 'ticket_caisse';
        invoiceId = null;
        invoiceNumber = null;
      }
    }

    if (!createOdooInvoice || documentType === 'ticket_caisse') {
      const ticket = await createTicketCaisse({
        odooRPC,
        sessionId,
        cart,
        customer,
        partnerId,
        uid,
        journalId: accountJournalId,
        amountUntaxed: subtotal,
        amountTax: tax,
        amountTotal: total,
        paymentReference: orderReference,
        ticketName: orderReference,
        skipOptionalLookups: true,
      });
      ticketId = ticket.ticketId;
      console.log('Order final document created', { type: documentType, ticketId });
    }

    // ── 7.5. Create IMEI records in Odoo ────────────────────────────────────
    for (const item of cart) {
      if (item.imei) {
        const productTemplateId = item.product.productTemplateId || parseInt(item.product.id);

        await odooRPC(
          '/web/dataset/call_kw',
          {
            model: 'x_imei',
            method: 'create',
            args: [{
              x_name: item.imei,
              x_product_id: productTemplateId,
              x_partner_id: partnerId || false,
            }],
            kwargs: {},
          },
          sessionId
        );
      }
    }

    // ── 8. Read back the auto-generated POS reference ────────────────────────
    return NextResponse.json({
      success: true,
      type: documentType,
      order: {
        id:            orderId,
        name:          orderInfo?.name          || `Order-${orderId}`,
        reference:     orderReference,
        invoiceId,
        invoiceNumber: invoiceNumber,
        ticketId,
        documentType,
      },
    });
  } catch (error: any) {
    console.error('Order creation proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create order in Odoo' },
      { status: 500 }
    );
  }
}
