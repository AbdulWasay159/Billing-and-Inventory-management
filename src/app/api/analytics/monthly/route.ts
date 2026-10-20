// src/app/api/analytics/monthly/route.ts
import { NextResponse } from 'next/server';
import { analyticsService } from '@/services/analytics.service';
import { requireAuthenticatedShop } from '@/lib/auth/guard';

export async function GET(request: Request) {
  const auth = await requireAuthenticatedShop(request);
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const year = searchParams.get('year') ? Number(searchParams.get('year')) : now.getFullYear();
    const month = searchParams.get('month') ? Number(searchParams.get('month')) : now.getMonth() + 1;

    const summary = await analyticsService.getMonthlyBillingSummary(year, month);
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
