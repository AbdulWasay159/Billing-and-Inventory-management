// src/app/api/invoices/[id]/pdf/route.ts
import { NextResponse } from 'next/server';
import { billingService } from '@/services/billing.service';
import { getShopRepository } from '@/lib/db/connection-router';
import { generateA4InvoicePdf } from '@/lib/pdf/a4-invoice-generator';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await billingService.getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const shopRepo = getShopRepository();
    const shop = await shopRepo.getProfile();

    const doc = generateA4InvoicePdf(invoice, shop);
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
