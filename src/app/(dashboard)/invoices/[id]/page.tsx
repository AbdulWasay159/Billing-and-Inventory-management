// src/app/(dashboard)/invoices/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Printer,
  Download,
  Edit2,
  RotateCcw,
  ArrowLeft,
  Store,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { formatCurrency, formatQuantity, paginateInvoiceItems } from '@/lib/utils';
import { Invoice, ShopProfile } from '@/types';
import { useShop } from '@/context/shop-context';

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { shop: contextShop } = useShop();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [shop, setShop] = useState<ShopProfile | null>(contextShop);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchInvoice = async () => {
      setLoading(true);
      try {
        const [invRes, shopRes] = await Promise.all([
          fetch(`/api/invoices/${id}`),
          fetch('/api/settings/profile'),
        ]);

        if (invRes.ok) {
          const data = await invRes.json();
          setInvoice(data);
        }

        if (shopRes.ok) {
          const shopData = await shopRes.json();
          setShop(shopData);
        }
      } catch (err) {
        console.error('Failed to load invoice:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id]);

  // Keep shop synced with context if available
  useEffect(() => {
    if (contextShop) setShop(contextShop);
  }, [contextShop]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.open(`/api/invoices/${id}/pdf`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-500">Loading invoice document...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-slate-500">Invoice not found.</p>
        <Link href="/billing/history" className="text-blue-600 font-semibold hover:underline">
          View Invoice History
        </Link>
      </div>
    );
  }

  // Section 15: Pagination Chunks (Strict 20 items per page)
  const pageChunks = paginateInvoiceItems(invoice.items, 20);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Action Header (Hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/billing/history"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 font-mono">
                {invoice.invoiceNumber}
              </h1>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                  invoice.status === 'COMPLETED'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : invoice.status === 'EDITED'
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {invoice.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Billed on {new Date(invoice.billDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Edit Bill Action (Section 13) */}
          <Link
            href={`/invoices/${id}/edit`}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Edit2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Edit Invoice</span>
          </Link>

          {/* Return Bill Action (Section 14) */}
          <Link
            href={`/invoices/${id}/return`}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-violet-600" />
            <span>Process Return</span>
          </Link>

          {/* Download PDF Action */}
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Download PDF</span>
          </button>

          {/* Print Invoice Action */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm shadow-blue-600/25 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invoice (A4)</span>
          </button>
        </div>
      </div>

      {/* --- A4 PRINT LAYOUT (SECTION 15 & 16) --- */}
      {/* Container enforces exact A4 sheets on screen and print media */}
      <div className="space-y-8 print:space-y-0">
        {pageChunks.map((chunk, chunkIdx) => (
          <div
            key={chunk.pageNumber}
            className="bg-white text-slate-900 border border-slate-200/90 shadow-md mx-auto p-8 rounded-2xl print:border-none print:shadow-none print:p-0 print:m-0 print:rounded-none max-w-[210mm] min-h-[297mm] print:min-h-[265mm] print:max-h-[277mm] flex flex-col justify-between"
            style={{ pageBreakAfter: chunkIdx < pageChunks.length - 1 ? 'always' : 'auto' }}
          >
            {/* Page Header */}
            <div>
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight uppercase text-slate-900">
                    {shop?.name || 'TradeStock Pro'}
                  </h2>
                  {shop?.address && (
                    <p className="text-xs text-slate-600 mt-1 max-w-sm">
                      {shop.address}
                    </p>
                  )}
                  <p className="text-xs text-slate-600 mt-0.5">
                    {shop?.phone ? `Phone: ${shop.phone}  ` : ''}
                    {shop?.email ? `|  Email: ${shop.email}` : ''}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-100 rounded">
                    Tax Invoice / Cash Memo
                  </span>
                  <h3 className="font-mono text-lg font-bold text-slate-900 mt-1">
                    {invoice.invoiceNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Date: {new Date(invoice.billDate).toLocaleDateString('en-IN')}
                  </p>
                  {chunk.totalPages > 1 && (
                    <span className="inline-block mt-1 text-[11px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                      Page {chunk.pageNumber} of {chunk.totalPages}
                    </span>
                  )}
                </div>
              </div>

              {/* Customer Info (Page 1) */}
              {chunk.isFirstPage && (
                <div className="grid grid-cols-2 gap-4 py-3 border-b border-slate-100 text-xs text-slate-700">
                  <div>
                    <span className="text-slate-400 font-medium">Billed To:</span>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {invoice.customerName || 'Walk-in Customer'}
                    </p>
                    {invoice.customerPhone && <p className="text-slate-500">{invoice.customerPhone}</p>}
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 font-medium">Payment Mode:</span>
                    <p className="font-bold text-slate-900 mt-0.5">{invoice.paymentMode}</p>
                  </div>
                </div>
              )}

              {/* Items Table for this specific A4 Page Chunk */}
              <div className="mt-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-2 px-2 text-center w-8">#</th>
                      <th className="py-2 px-2">Item Description</th>
                      <th className="py-2 px-2 font-mono">Code</th>
                      <th className="py-2 px-2">Size</th>
                      <th className="py-2 px-2 text-right">Rate</th>
                      <th className="py-2 px-2 text-center w-16">Qty</th>
                      <th className="py-2 px-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-slate-800">
                    {chunk.items.map((item, itemIdx) => {
                      const absoluteRowIndex = chunk.startIndex + itemIdx + 1;
                      return (
                        <tr key={item.id} className="text-xs">
                          <td className="py-2 px-2 text-center text-slate-400">
                            {absoluteRowIndex}
                          </td>
                          <td className="py-2 px-2 font-sans font-medium text-slate-900">
                            {item.productNameSnapshot}
                          </td>
                          <td className="py-2 px-2 text-slate-500">
                            {item.productIdSnapshot}
                          </td>
                          <td className="py-2 px-2 text-slate-500 font-sans">
                            {item.sizeSnapshot || '—'}
                          </td>
                          <td className="py-2 px-2 text-right">
                            ₹{Number(item.sellingPriceSnapshot).toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-center font-bold">
                            {item.quantity} {item.unitSnapshot || ''}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-slate-900">
                            ₹{Number(item.lineTotal).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Page Footer / Totals Section */}
            <div className="border-t border-slate-200 pt-4 mt-6">
              {/* If this is NOT the last page, show running subtotal */}
              {!chunk.isLastPage ? (
                <div className="flex justify-between items-center text-xs text-slate-600 py-2 bg-slate-50 px-3 rounded-lg border border-slate-200">
                  <span className="font-semibold uppercase tracking-wider">
                    Page {chunk.pageNumber} Items Subtotal:
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    ₹{chunk.pageSubtotal.toFixed(2)}
                  </span>
                </div>
              ) : (
                /* Last Page: Final Bill Summary Deck */
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <div className="w-72 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Items Subtotal:</span>
                        <span className="font-mono font-semibold text-slate-900">
                          ₹{Number(invoice.subtotal).toFixed(2)}
                        </span>
                      </div>
                      {Number(invoice.discountAmount) > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>Trade Discount:</span>
                          <span className="font-mono text-rose-600">
                            - ₹{Number(invoice.discountAmount).toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-baseline pt-2 border-t-2 border-slate-800 text-slate-900 font-bold">
                        <span className="text-sm">Grand Total:</span>
                        <span className="font-mono text-xl text-blue-700">
                          ₹{Number(invoice.finalTotal).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Receipt Footer Message */}
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-end text-[11px] text-slate-500">
                    <div>
                      <p className="font-medium text-slate-700">
                        {shop?.receiptFooterMessage ||
                          'Goods once sold cannot be returned without original bill. Thank you for your business!'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Computer Generated Invoice · TradeStock Pro
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="h-10 border-b border-slate-300 w-36 mb-1"></div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">
                        Authorized Signatory
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
