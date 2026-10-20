// src/app/api/analytics/dashboard/route.ts
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

    const stats = await analyticsService.getDashboardMetrics(startDate, endDate);
    const lowStock = await analyticsService.getLowStockProducts();
    const outOfStock = await analyticsService.getOutOfStockProducts();

    return NextResponse.json({
      stats,
      lowStockItems: lowStock,
      outOfStockItems: outOfStock,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
