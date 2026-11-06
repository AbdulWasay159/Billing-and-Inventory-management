// src/app/api/billing/route.ts
import { NextResponse } from 'next/server';
import { billingService } from '@/services/billing.service';
import { requireAuthenticatedShop } from '@/lib/auth/guard';

export async function GET(request: Request) {
  const auth = await requireAuthenticatedShop(request);
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const customerSearch = searchParams.get('customer') || undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;
    const balanceParam = (searchParams.get('balance') || '').toUpperCase();
    const balanceFilter = balanceParam === 'DUE' || balanceParam === 'PAID' ? balanceParam : undefined;

    const [result, outstanding] = await Promise.all([
      billingService.getInvoices({
        startDate,
        endDate,
        customerSearch,
        balanceFilter,
        limit,
        offset,
      }),
      billingService.getOutstandingSummary(),
    ]);

    return NextResponse.json({ ...result, outstanding });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedShop(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const invoice = await billingService.createInvoice(body);
    return NextResponse.json({ ...invoice, invoice }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
