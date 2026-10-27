// src/app/api/products/filters/route.ts
import { NextResponse } from 'next/server';
import { productService } from '@/services/product.service';
import { requireAuthenticatedShop } from '@/lib/auth/guard';

export async function GET(request: Request) {
  const auth = await requireAuthenticatedShop(request);
  if (!auth.authorized) return auth.response;

  try {
    const filters = await productService.getDistinctFilterOptions();
    return NextResponse.json(filters);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
