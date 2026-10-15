// Mints the demo customer's open £6,000 invoice that the QR card shows.

import type Stripe from 'stripe';

const INFLOW_PENCE = 600_000;

export type DemoInvoice = { customerId: string; invoiceId: string; hostedInvoiceUrl: string | null };

export async function mintDemoInvoice(stripe: Stripe): Promise<DemoInvoice> {
  const customer = await stripe.customers.create({
    name: 'Northwind Retail Ltd',
    email: 'billing@northwind-retail.example',
  });
  const draft = await stripe.invoices.create({
    customer: customer.id,
    currency: 'gbp',
    collection_method: 'send_invoice',
    days_until_due: 14,
  });
  await stripe.invoiceItems.create({
    customer: customer.id,
    invoice: draft.id,
    amount: INFLOW_PENCE,
    currency: 'gbp',
    description: 'October retainer',
  });
  const invoice = await stripe.invoices.finalizeInvoice(draft.id!);
  return { customerId: customer.id, invoiceId: invoice.id!, hostedInvoiceUrl: invoice.hosted_invoice_url ?? null };
}
