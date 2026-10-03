// src/app/api/invoices/[id]/returns/route.ts
import { NextResponse } from 'next/server';
import { returnService } from '@/services/return.service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const result = await returnService.processReturn({
      invoiceId: id,
      reason: body.reason,
      items: body.items,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const returns = await returnService.getReturnsForInvoice(id);
    return NextResponse.json(returns);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
