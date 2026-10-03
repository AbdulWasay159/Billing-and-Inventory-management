// src/app/api/inventory/adjust/route.ts
import { NextResponse } from 'next/server';
import { inventoryService } from '@/services/inventory.service';

export async function POST(request: Request) {
  try {
    const { productId, quantityChange, transactionType, notes } = await request.json();
    if (!productId || quantityChange === undefined) {
      return NextResponse.json({ error: 'Product ID and quantity change are required.' }, { status: 400 });
    }

    const result = await inventoryService.adjustStock({
      productId,
      quantityChange: Number(quantityChange),
      transactionType: transactionType || 'ADJUSTMENT',
      notes,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 50;

    if (productId) {
      const txs = await inventoryService.getTransactionsForProduct(productId);
      return NextResponse.json(txs);
    }

    const txs = await inventoryService.getRecentTransactions(limit);
    return NextResponse.json(txs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
