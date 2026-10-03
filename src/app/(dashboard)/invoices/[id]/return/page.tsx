// src/app/(dashboard)/invoices/[id]/return/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import { Invoice, InvoiceReturn } from '@/types';

export default function ProcessReturnPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [existingReturns, setExistingReturns] = useState<InvoiceReturn[]>([]);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('Customer returned unused goods');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchInvoiceData = async () => {
      setLoading(true);
      try {
        const [invRes, retRes] = await Promise.all([
          fetch(`/api/invoices/${id}`),
          fetch(`/api/invoices/${id}/returns`),
        ]);

        if (invRes.ok) {
          const invData = await invRes.json();
          setInvoice(invData);
        }
        if (retRes.ok) {
          const retData = await retRes.json();
          setExistingReturns(retData || []);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoiceData();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading invoice details...</div>;
  if (!invoice) return <div className="p-8 text-center text-slate-500">Invoice not found.</div>;

  // Calculate already returned quantity per invoice item
  const alreadyReturnedMap = new Map<string, number>();
  for (const ret of existingReturns) {
    for (const item of ret.items) {
      alreadyReturnedMap.set(
        item.invoiceItemId,
        (alreadyReturnedMap.get(item.invoiceItemId) || 0) + Number(item.quantity)
      );
    }
  }

  const handleReturnQtyChange = (itemId: string, qty: number, maxQty: number) => {
    const validQty = Math.max(0, Math.min(maxQty, qty));
    setReturnQtys((prev) => ({ ...prev, [itemId]: validQty }));
  };

  const totalRefundAmount = invoice.items.reduce((sum, it) => {
    const qty = returnQtys[it.id] || 0;
    return sum + qty * Number(it.sellingPriceSnapshot);
  }, 0);

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const itemsToReturn = Object.entries(returnQtys)
      .filter(([_, qty]) => qty > 0)
      .map(([invoiceItemId, quantity]) => ({ invoiceItemId, quantity }));

    if (itemsToReturn.length === 0) {
      setError('Please specify return quantity for at least one item.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${id}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, items: itemsToReturn }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process return.');
      }

      router.push(`/invoices/${id}`);
    } catch (err: any) {
      setError(err.message || 'Error processing return.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link
        href={`/invoices/${id}`}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Cancel and return to invoice</span>
      </Link>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-rose-500" />
            <h1 className="text-xl font-bold text-slate-900 dark:text-white font-mono">
              Process Return for {invoice.invoiceNumber}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Specify quantities being returned by the customer. Stock will be restored automatically.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmitReturn} className="space-y-6">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Return Reason / Notes
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Defective piece / Wrong size"
              className="w-full px-3 py-2 text-xs border rounded-lg"
            />
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 text-right">Sold Qty</th>
                  <th className="py-2.5 px-3 text-right">Already Returned</th>
                  <th className="py-2.5 px-3 text-right">Returnable</th>
                  <th className="py-2.5 px-3 text-center w-28">Return Qty</th>
                  <th className="py-2.5 px-3 text-right">Refund Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoice.items.map((it) => {
                  const already = alreadyReturnedMap.get(it.id) || 0;
                  const returnable = it.quantity - already;
                  const currentReturnQty = returnQtys[it.id] || 0;
                  const lineRefund = currentReturnQty * Number(it.sellingPriceSnapshot);

                  return (
                    <tr key={it.id}>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {it.productNameSnapshot}
                        </span>
                        <span className="block text-[11px] font-mono text-slate-400">
                          {it.productIdSnapshot} {it.sizeSnapshot ? `· ${it.sizeSnapshot}` : ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium">{it.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">{already}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                        {returnable}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max={returnable}
                          disabled={returnable <= 0}
                          value={currentReturnQty || ''}
                          onChange={(e) =>
                            handleReturnQtyChange(it.id, Number(e.target.value), returnable)
                          }
                          placeholder="0"
                          className="w-16 px-2 py-1 text-center font-bold border rounded-lg text-xs"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                        ₹{lineRefund.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-4 border-t text-sm font-semibold">
            <span>Total Refund Amount to Customer:</span>
            <span className="text-xl font-bold font-mono text-rose-600">
              ₹{totalRefundAmount.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link
              href={`/invoices/${id}`}
              className="px-4 py-2 text-xs font-semibold text-slate-600 border rounded-xl"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || totalRefundAmount <= 0}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl"
            >
              {submitting ? 'Processing Return...' : 'Confirm Return & Restore Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
