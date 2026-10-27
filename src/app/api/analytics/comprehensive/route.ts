// src/app/api/analytics/comprehensive/route.ts
import { NextResponse } from 'next/server';
import { analyticsService } from '@/services/analytics.service';
import { requireAuthenticatedShop } from '@/lib/auth/guard';

export async function GET(request: Request) {
  const auth = await requireAuthenticatedShop(request);
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const analytics = await analyticsService.getComprehensiveAnalytics(startDate, endDate);
    return NextResponse.json(analytics);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
