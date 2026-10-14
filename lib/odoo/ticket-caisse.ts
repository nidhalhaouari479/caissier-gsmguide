type OdooRPC = (endpoint: string, params: any, sessionId: string) => Promise<any>;

// Local toggle: set to `true` to skip sending `x_journal_id` to Odoo.
// Keep local-only for quick testing; do NOT push this change if you
// want server-side journal handling to remain.
const SKIP_X_JOURNAL = true;

type CreateTicketCaisseInput = {
  odooRPC: OdooRPC;
  sessionId: string;
  cart: any[];
  partnerId?: number | false;
  customer?: any;
  uid?: string | number | null;
  journalId?: number | false;
  currencyId?: number | false;
  companyId?: number | false;
  amountUntaxed: number;
  amountTax: number;
  amountTotal: number;
  paymentReference?: string;
  ticketName?: string;
  skipOptionalLookups?: boolean;
};

function toOdooId(value: any): number | false {
  if (Array.isArray(value)) return Number(value[0]) || false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : false;
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

async function safeRead(
  odooRPC: OdooRPC,
  sessionId: string,
  model: string,
  ids: number[],
  fields: string[]
) {
  if (ids.length === 0) return [];
  try {
    return await odooRPC(
      '/web/dataset/call_kw',
      {
        model,
        method: 'read',
        args: [ids],
        kwargs: { fields },
      },
      sessionId
    );
  } catch (error: any) {
    console.warn(`Ticket caisse: unable to read ${model}:`, error.message);
    return [];
  }
}

async function recordExists(
  odooRPC: OdooRPC,
  sessionId: string,
  model: string,
  id: number | false
) {
  if (!id) return false;
  try {
    const count = await odooRPC(
      '/web/dataset/call_kw',
      {
        model,
        method: 'search_count',
        args: [[['id', '=', id]]],
        kwargs: {},
      },
      sessionId
    );
    return count > 0;
  } catch (error: any) {
    console.warn(`Ticket caisse: unable to validate ${model} ${id}:`, error.message);
    return false;
  }
}

async function createWithOdooFallbacks(
  odooRPC: OdooRPC,
  sessionId: string,
  model: string,
  values: Record<string, any>
) {
  try {
    return await odooRPC(
      '/web/dataset/call_kw',
      {
        model,
        method: 'create',
        args: [values],
        kwargs: {},
      },
      sessionId
    );
  } catch (error: any) {
    const message = String(error?.message || '');
    if (values.x_state && message.includes('x_state')) {
      const stateFallbacks = ['confirmed', 'draft', false];
      for (const fallbackState of stateFallbacks) {
        const fallbackValues = { ...values };
        if (fallbackState) {
          fallbackValues.x_state = fallbackState;
        } else {
          delete fallbackValues.x_state;
        }

        try {
          console.warn(
            `Ticket caisse: ${model} rejected x_state=${values.x_state}, retrying with ${fallbackState || 'no x_state'}.`
          );
          return await createWithOdooFallbacks(odooRPC, sessionId, model, fallbackValues);
        } catch (fallbackError: any) {
          if (!String(fallbackError?.message || '').includes('x_state')) {
            throw fallbackError;
          }
        }
      }
    }

    if (values.x_currency_id && message.includes('x_currency_id')) {
      const fallbackValues = { ...values };
      delete fallbackValues.x_currency_id;
      console.warn(`Ticket caisse: ${model} rejected x_currency_id=${values.x_currency_id}, retrying without it.`);

      return await createWithOdooFallbacks(odooRPC, sessionId, model, fallbackValues);
    }

    if (values.x_partner_id && message.includes('x_partner_id')) {
      const fallbackValues = { ...values };
      delete fallbackValues.x_partner_id;
      console.warn(`Ticket caisse: ${model} rejected x_partner_id=${values.x_partner_id}, retrying without it.`);

      return await createWithOdooFallbacks(odooRPC, sessionId, model, fallbackValues);
    }

    throw error;
  }
}

async function resolveTicketContext(input: CreateTicketCaisseInput) {
  const { odooRPC, sessionId } = input;
  let journalId = toOdooId(input.journalId);
  let currencyId = toOdooId(input.currencyId);
  let companyId = toOdooId(input.companyId);
  const userId = toOdooId(input.uid);

  if (journalId && (!companyId || !currencyId)) {
    const [journal] = await safeRead(odooRPC, sessionId, 'account.journal', [journalId], [
      'company_id',
      'currency_id',
    ]);
    companyId = companyId || toOdooId(journal?.company_id);
    currencyId = currencyId || toOdooId(journal?.currency_id);
  }

  if (userId && !companyId) {
    const [user] = await safeRead(odooRPC, sessionId, 'res.users', [userId], ['company_id']);
    companyId = toOdooId(user?.company_id);
  }

  if (!companyId) {
    try {
      const companies = await odooRPC(
        '/web/dataset/call_kw',
        {
          model: 'res.company',
          method: 'search_read',
          args: [[]],
          kwargs: { fields: ['id', 'currency_id'], limit: 1 },
        },
        sessionId
      );
      companyId = toOdooId(companies?.[0]?.id);
      currencyId = currencyId || toOdooId(companies?.[0]?.currency_id);
    } catch (error: any) {
      console.warn('Ticket caisse: unable to resolve company:', error.message);
    }
  }

  if (companyId && !currencyId) {
    const [company] = await safeRead(odooRPC, sessionId, 'res.company', [companyId], ['currency_id']);
    currencyId = toOdooId(company?.currency_id);
  }

  if (currencyId && !(await recordExists(odooRPC, sessionId, 'res.currency', currencyId))) {
    console.warn(`Ticket caisse: resolved currency ${currencyId} does not exist in res.currency, omitting x_currency_id.`);
    currencyId = false;
  }

  return { journalId, currencyId, companyId, userId };
}

async function findSuitableJournal(odooRPC: OdooRPC, sessionId: string, companyId: number | false) {
  if (!companyId) return false;
  try {
    const journals = await odooRPC(
      '/web/dataset/call_kw',
      {
        model: 'account.journal',
        method: 'search_read',
        args: [[['company_id', '=', companyId], ['type', 'in', ['cash', 'bank']]]],
        kwargs: { fields: ['id', 'name', 'company_id'], limit: 1 },
      },
      sessionId
    );
    if (Array.isArray(journals) && journals.length > 0) {
      return toOdooId(journals[0].id);
    }
  } catch (err: any) {
    console.warn('Ticket caisse: unable to auto-find suitable journal:', err?.message || err);
  }
  return false;
}

async function getProductTaxes(odooRPC: OdooRPC, sessionId: string, productIds: number[]) {
  const taxesByProduct = new Map<number, number[]>();
  const products = await safeRead(odooRPC, sessionId, 'product.product', productIds, ['taxes_id']);

  for (const product of products || []) {
    taxesByProduct.set(product.id, Array.isArray(product.taxes_id) ? product.taxes_id : []);
  }

  return taxesByProduct;
}

export async function createTicketCaisse(input: CreateTicketCaisseInput) {
  const { odooRPC, sessionId, cart } = input;
  const today = new Date().toISOString().split('T')[0];
  const partnerId = toOdooId(input.partnerId || input.customer?.id);
  const context = input.skipOptionalLookups
    ? {
        journalId: toOdooId(input.journalId),
        currencyId: toOdooId(input.currencyId),
        companyId: toOdooId(input.companyId),
        userId: toOdooId(input.uid),
      }
    : await resolveTicketContext(input);
  const { journalId, currencyId, companyId, userId } = context;
  let resolvedJournalId = journalId; // mutable copy so we can adjust if invalid
  const productIds = cart
    .map((item) => toOdooId(item.product?.odooId || item.product?.id))
    .filter((id): id is number => Boolean(id));
  const taxesByProduct = input.skipOptionalLookups
    ? new Map<number, number[]>()
    : await getProductTaxes(odooRPC, sessionId, productIds);

  const buildLineValues = (item: any, ticketId?: number) => {
    const productId = toOdooId(item.product?.odooId || item.product?.id);
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.product?.price) || 0;
    const gross = unitPrice * quantity;
    const discountAmount = Number(item.discountAmount) || 0;
    const discountPercent = gross > 0 ? (discountAmount / gross) * 100 : 0;
    const lineTotal = roundMoney(gross - discountAmount);
    const taxIds = productId ? taxesByProduct.get(productId) || [] : [];

    const lineValues: Record<string, any> = {
      x_name: item.imei ? `${item.product?.name || 'Article'} (IMEI: ${item.imei})` : item.product?.name || 'Article',
      x_quantity: quantity,
      x_price_unit: unitPrice,
      x_discount: roundMoney(discountPercent),
      x_price_subtotal: lineTotal,
      x_price_total: lineTotal,
    };

    if (ticketId) lineValues.x_ticket_id = ticketId;
    if (productId) lineValues.x_product_id = productId;
    if (taxIds.length > 0) lineValues.x_tax_ids = [[6, 0, taxIds]];
    if (currencyId) lineValues.x_currency_id = currencyId;

    return lineValues;
  };

  const ticketValues: Record<string, any> = {
    x_name: input.ticketName || input.paymentReference || `TICKET-${Date.now()}`,
    x_invoice_date: today,
    x_invoice_date_due: today,
    x_amount_untaxed: roundMoney(input.amountUntaxed),
    x_amount_tax: roundMoney(input.amountTax),
    x_amount_total: roundMoney(input.amountTotal),
    x_payment_reference: input.paymentReference || '',
  };

  if (!input.skipOptionalLookups) ticketValues.x_state = 'paid';
  if (partnerId) ticketValues.x_partner_id = partnerId;
  if (resolvedJournalId) {
    // Read journal to ensure it exists and (if possible) belongs to the same company
    const [journal] = await safeRead(odooRPC, sessionId, 'account.journal', [resolvedJournalId], ['company_id']);
    const journalCompanyId = toOdooId(journal?.company_id);
    if (!journal || Object.keys(journal).length === 0) {
      console.warn(`Ticket caisse: resolved journal ${resolvedJournalId} does not exist in account.journal, omitting x_journal_id.`);
      resolvedJournalId = false;
    } else if (companyId && journalCompanyId && journalCompanyId !== companyId) {
      console.warn(`Ticket caisse: journal ${resolvedJournalId} belongs to company ${journalCompanyId} (expected ${companyId}), omitting x_journal_id.`);
      resolvedJournalId = false;
    } else {
      if (!SKIP_X_JOURNAL) ticketValues.x_journal_id = resolvedJournalId;
      else console.warn(`Ticket caisse: skipping assignment of x_journal_id (${resolvedJournalId}) due to local SKIP_X_JOURNAL flag.`);
    }
  }

  // If we don't have a valid journal yet, try to auto-find one for the company
  if (!ticketValues.x_journal_id && companyId) {
    const autoJournal = await findSuitableJournal(odooRPC, sessionId, companyId);
    if (autoJournal) {
      if (!SKIP_X_JOURNAL) {
        ticketValues.x_journal_id = autoJournal;
        console.warn(`Ticket caisse: auto-selected journal ${autoJournal} for company ${companyId}.`);
      } else {
        console.warn(`Ticket caisse: auto-found journal ${autoJournal} but skipping assignment due to SKIP_X_JOURNAL.`);
      }
    }
  }
  if (currencyId) ticketValues.x_currency_id = currencyId;
  if (companyId) ticketValues.x_company_id = companyId;
  if (userId) ticketValues.x_user_id = userId;
  if (input.skipOptionalLookups) {
    ticketValues.x_line_ids = cart.map((item) => [0, 0, buildLineValues(item)]);
  }

  console.log('Ticket caisse: creating header', {
    amountTotal: ticketValues.x_amount_total,
    partnerId,
    journalId: ticketValues.x_journal_id || resolvedJournalId,
    currencyId,
    companyId,
  });

  const ticketId: number = await createWithOdooFallbacks(
    odooRPC,
    sessionId,
    'x_ticket_caisse',
    ticketValues
  );

  if (!input.skipOptionalLookups) {
    for (const item of cart) {
      await createWithOdooFallbacks(
        odooRPC,
        sessionId,
        'x_ticket_caisse_line',
        buildLineValues(item, ticketId)
      );
    }
  }

  console.log('Ticket caisse: created', { ticketId, lineCount: cart.length });

  return {
    success: true,
    type: 'ticket_caisse' as const,
    ticketId,
  };
}
