// src/app/api/billing/route.ts
import { NextResponse } from 'next/server';
import { billingService } from '@/services/billing.service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const customerSearch = searchParams.get('customer') || undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const result = await billingService.getInvoices({
      startDate,
      endDate,
      customerSearch,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const invoice = await billingService.createInvoice(body);
    return NextResponse.json(invoice, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
