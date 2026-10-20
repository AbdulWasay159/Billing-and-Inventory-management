// src/app/api/imports/commit/route.ts
import { NextResponse } from 'next/server';
import { importExportService } from '@/services/import-export.service';
import { requireAuthenticatedShop } from '@/lib/auth/guard';

export async function POST(request: Request) {
  const auth = await requireAuthenticatedShop(request);
  if (!auth.authorized) return auth.response;

  try {
    const { rows } = await request.json();
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No validated rows provided to commit.' }, { status: 400 });
    }

    const summary = await importExportService.commitImport(rows);
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
