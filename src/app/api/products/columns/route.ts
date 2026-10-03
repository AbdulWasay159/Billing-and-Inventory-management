// src/app/api/products/columns/route.ts
import { NextResponse } from 'next/server';
import { getCustomFieldRepository } from '@/lib/db/connection-router';

const PROTECTED_SYSTEM_FIELDS = [
  'product_id',
  'name',
  'size',
  'company_brand',
  'unit',
  'stock_quantity',
  'low_stock_limit',
  'mrp',
  'purchase_discount_percent',
  'purchase_price',
  'profit_margin_percent',
  'selling_price',
];

export async function GET() {
  try {
    const customFieldRepo = getCustomFieldRepository();
    const columns = await customFieldRepo.getDefinitions();
    return NextResponse.json({ columns, protectedFields: PROTECTED_SYSTEM_FIELDS });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { label, dataType } = await request.json();
    if (!label || !label.trim()) {
      return NextResponse.json({ error: 'Column label is required.' }, { status: 400 });
    }

    const fieldKey = label.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (PROTECTED_SYSTEM_FIELDS.includes(fieldKey)) {
      return NextResponse.json({ error: `Cannot use reserved system column name "${label}".` }, { status: 400 });
    }

    const customFieldRepo = getCustomFieldRepository();
    const newDef = await customFieldRepo.createDefinition({
      fieldKey,
      label: label.trim(),
      dataType: dataType || 'TEXT',
      isRequired: false,
      displayOrder: Date.now(),
    });

    return NextResponse.json(newDef, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Column ID is required.' }, { status: 400 });
    }

    const customFieldRepo = getCustomFieldRepository();
    const success = await customFieldRepo.deleteDefinition(id);
    if (!success) {
      return NextResponse.json({ error: 'Column not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Custom column deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
