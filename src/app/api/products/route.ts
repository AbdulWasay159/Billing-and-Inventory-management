// src/app/api/products/route.ts
import { NextResponse } from 'next/server';
import { productService } from '@/services/product.service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const lowStockOnly = searchParams.get('lowStock') === 'true';
    const outOfStockOnly = searchParams.get('outOfStock') === 'true';
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const offset = searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined;

    const result = await productService.getProducts({
      search,
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
  try {
    const body = await request.json();
    const product = await productService.createProduct(body);
    return NextResponse.json(product, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
