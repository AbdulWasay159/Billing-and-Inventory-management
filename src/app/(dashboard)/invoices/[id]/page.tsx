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

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchInvoice = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/invoices/${id}`);
        if (res.ok) {
          const data = await res.json();
          setInvoice(data);
        }

        // Shop metadata
        const metaRes = await fetch('/api/auth/me');
        if (metaRes.ok) {
          const metaData = await metaRes.json();
          setShop({
            id: metaData.session.shopId,
            slug: 'tradestock-demo-shop',
            name: metaData.session.shopName,
            email: metaData.session.email,
            phone: '+91 98765 43210',
            address: 'Shop No. 12, Market Yard, Hardware Lane, Hyderabad, India',
            currencySymbol: '₹',
            receiptFooterMessage:
              'Goods once sold cannot be taken back without original bill. Thank you for your business!',
            createdAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('Failed to load invoice:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.open(`/api/invoices/${id}/pdf`, '_blank');
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading invoice...</div>;
  }

  if (!invoice) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-slate-500">Invoice not found.</p>
        <Link href="/billing/history" className="text-indigo-600 font-semibold hover:underline">
          View Invoice History
        </Link>
      </div>
    );
  }

  // Section 15: Pagination Chunks (Strict 20 items per page)
  const pageChunks = paginateInvoiceItems(invoice.items, 20);

  return (
    <div className="space-y-6">
      {/* Top Action Header (Hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/billing/history"
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                {invoice.invoiceNumber}
              </h1>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                  invoice.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : invoice.status === 'EDITED'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {invoice.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Total {invoice.items.length} items · Billed on{' '}
              {new Date(invoice.billDate).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/invoices/${id}/edit`}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5 text-amber-500" />
            <span>Edit Bill</span>
          </Link>

          <Link
            href={`/invoices/${id}/return`}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
            <span>Process Return</span>
          </Link>

          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-colors"
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
            className="bg-white text-slate-900 border border-slate-200 shadow-lg mx-auto p-8 rounded-2xl print:border-none print:shadow-none print:p-0 print:m-0 print:rounded-none max-w-[210mm] min-h-[297mm] flex flex-col justify-between"
            style={{ pageBreakAfter: chunkIdx < pageChunks.length - 1 ? 'always' : 'auto' }}
          >
            {/* Page Header */}
            <div>
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight uppercase text-slate-900">
                    {shop?.name || 'TradeStock Hardware & Sanitary'}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm">
                    {shop?.address || 'Shop No. 12, Market Yard, Hardware Lane'}
                  </p>
                  <p className="text-xs text-slate-600">
                    Phone: {shop?.phone || '+91 98765 43210'} | Email: {shop?.email || 'owner@tradestock.com'}
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
                    <span className="inline-block mt-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
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

              {/* Continuation Header (Pages 2+) */}
              {!chunk.isFirstPage && (
                <div className="py-2.5 border-b border-slate-200 text-xs font-semibold text-slate-600 flex justify-between">
                  <span>Invoice: {invoice.invoiceNumber} (Continuation)</span>
                  <span>Items {chunk.startIndex + 1} to {chunk.endIndex}</span>
                </div>
              )}

              {/* Items Table (Exactly up to 20 items on this page) */}
              <div className="mt-3">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300 text-slate-700 bg-slate-50">
                      <th className="py-2 px-2 font-bold text-center w-8">#</th>
                      <th className="py-2 px-2 font-bold w-24">Item Code</th>
                      <th className="py-2 px-2 font-bold">Description of Goods</th>
                      <th className="py-2 px-2 font-bold text-center w-16">Size</th>
                      <th className="py-2 px-2 font-bold text-right w-14">Qty</th>
                      <th className="py-2 px-2 font-bold text-center w-12">Unit</th>
                      <th className="py-2 px-2 font-bold text-right w-20">Rate</th>
                      <th className="py-2 px-2 font-bold text-right w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                    {chunk.items.map((it, itemIdx) => {
                      const serial = chunk.startIndex + itemIdx + 1;
                      return (
                        <tr key={it.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-2 text-center text-slate-400">{serial}</td>
                          <td className="py-2 px-2 font-bold text-indigo-700">
                            {it.productIdSnapshot}
                          </td>
                          <td className="py-2 px-2 font-sans font-medium text-slate-900">
                            {it.productNameSnapshot}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-600">
                            {it.sizeSnapshot || '—'}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-slate-900">
                            {it.quantity}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-500 font-sans">
                            {it.unitSnapshot}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-700">
                            ₹{Number(it.sellingPriceSnapshot).toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-slate-900">
                            ₹{Number(it.lineTotal).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Page Footer */}
            <div className="pt-4 border-t-2 border-slate-300 mt-6">
              {/* Page Subtotal */}
              <div className="flex justify-between items-center text-xs pb-3 text-slate-600">
                <span>
                  Page {chunk.pageNumber} Subtotal ({chunk.items.length} items):
                </span>
                <strong className="font-mono text-slate-900 text-sm">
                  ₹{chunk.pageSubtotal.toFixed(2)}
                </strong>
              </div>

              {/* Grand Total on Final Page */}
              {chunk.isLastPage ? (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Overall Subtotal:</span>
                    <span className="font-mono font-semibold">₹{Number(invoice.subtotal).toFixed(2)}</span>
                  </div>
                  {Number(invoice.discountAmount) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Discount:</span>
                      <span className="font-mono text-rose-600">
                        -₹{Number(invoice.discountAmount).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-2 border-t border-slate-300">
                    <span className="font-bold text-sm text-slate-900 uppercase">Grand Total:</span>
                    <span className="font-mono text-2xl font-bold text-slate-900">
                      ₹{Number(invoice.finalTotal).toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-right text-xs italic text-slate-400 py-2">
                  Continued on page {chunk.pageNumber + 1}...
                </div>
              )}

              {/* Receipt Footer Message */}
              <div className="mt-4 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-500">
                {shop?.receiptFooterMessage ||
                  'Goods once sold cannot be taken back without original bill. Thank you!'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
