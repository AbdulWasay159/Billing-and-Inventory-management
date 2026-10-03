// src/app/api/analytics/products/route.ts
import { NextResponse } from 'next/server';
import { analyticsService } from '@/services/analytics.service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    if (productId) {
      const summary = await analyticsService.getProductSalesSummary(productId, startDate, endDate);
      return NextResponse.json(summary);
    }

    const allSummaries = await analyticsService.getAllProductsSalesSummary(startDate, endDate);
    return NextResponse.json(allSummaries);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
