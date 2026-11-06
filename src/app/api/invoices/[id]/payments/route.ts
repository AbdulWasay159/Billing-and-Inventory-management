// src/app/api/invoices/[id]/payments/route.ts
import { NextResponse } from 'next/server';
import { billingService } from '@/services/billing.service';
import { requireAuthenticatedShop } from '@/lib/auth/guard';

// Record a payment against the remaining balance of an invoice.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedShop(request);
  if (!auth.authorized) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const invoice = await billingService.recordPayment(id, {
      amount: Number(body?.amount),
      paymentMode: body?.paymentMode,
      note: typeof body?.note === 'string' ? body.note : undefined,
    });
    return NextResponse.json(invoice, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
