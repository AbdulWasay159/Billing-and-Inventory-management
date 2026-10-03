// src/app/api/imports/preview/route.ts
import { NextResponse } from 'next/server';
import { importExportService } from '@/services/import-export.service';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Please upload an Excel or CSV file.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const parseResult = await importExportService.parseAndPreview(arrayBuffer);

    return NextResponse.json(parseResult);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
