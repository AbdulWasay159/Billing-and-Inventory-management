// src/app/api/products/route.ts
import { NextResponse } from 'next/server';
import { productService } from '@/services/product.service';
import { requireAuthenticatedShop } from '@/lib/auth/guard';

export async function GET(request: Request) {
  const auth = await requireAuthenticatedShop(request);
  if (!auth.authorized) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const brand = searchParams.get('brand') || undefined;
    const size = searchParams.get('size') || undefined;
    const unit = searchParams.get('unit') || undefined;
    const statusParam = searchParams.get('status') as 'all' | 'inStock' | 'lowStock' | 'outOfStock' | null;
    let stockStatus: 'all' | 'inStock' | 'lowStock' | 'outOfStock' | undefined = statusParam || undefined;

    const lowStockOnly = searchParams.get('lowStock') === 'true' || stockStatus === 'lowStock';
    const outOfStockOnly = searchParams.get('outOfStock') === 'true' || stockStatus === 'outOfStock';
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const result = await productService.getProducts({
      search,
      brand,
      size,
      unit,
      stockStatus,
      lowStockOnly,
      outOfStockOnly,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedShop(request);
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const product = await productService.createProduct(body);
    return NextResponse.json(product, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
