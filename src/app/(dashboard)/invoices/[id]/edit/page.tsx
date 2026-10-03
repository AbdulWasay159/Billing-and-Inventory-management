// src/app/(dashboard)/invoices/[id]/edit/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, AlertCircle, Trash2 } from 'lucide-react';
import { Invoice, PaymentMode } from '@/types';

export default function EditInvoicePage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<
    {
      productId: string;
      productName: string;
      productCode: string;
      size: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[]
  >([]);

  useEffect(() => {
    if (!id) return;
    const fetchInvoice = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/invoices/${id}`);
        if (res.ok) {
          const inv: Invoice = await res.json();
          setInvoice(inv);
          setCustomerName(inv.customerName || '');
          setCustomerPhone(inv.customerPhone || '');
          setPaymentMode(inv.paymentMode);
          setDiscountAmount(String(inv.discountAmount || 0));
          setNotes(inv.notes || '');
          setItems(
            inv.items.map((it) => ({
              productId: it.productId,
              productName: it.productNameSnapshot,
              productCode: it.productIdSnapshot,
              size: it.sizeSnapshot,
              quantity: Number(it.quantity),
              unitPrice: Number(it.sellingPriceSnapshot),
              lineTotal: Number(it.lineTotal),
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load invoice:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id]);

  const updateQuantity = (idx: number, newQty: number) => {
    if (newQty <= 0) return;
    setItems((prev) => {
      const updated = [...prev];
      const it = updated[idx];
      updated[idx] = {
        ...it,
        quantity: newQty,
        lineTotal: Math.round(it.unitPrice * newQty * 100) / 100,
      };
      return updated;
    });
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) {
      alert('An invoice must have at least one item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        paymentMode,
        discountAmount: Number(discountAmount) || 0,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
        })),
      };

      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update invoice.');
      }

      router.push(`/invoices/${id}`);
    } catch (err: any) {
      setError(err.message || 'Error saving invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading invoice...</div>;
  if (!invoice) return <div className="p-8 text-center text-slate-500">Invoice not found.</div>;

  const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
  const finalTotal = Math.max(0, Math.round((subtotal - (Number(discountAmount) || 0)) * 100) / 100);

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
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white font-mono">
              Edit Invoice {invoice.invoiceNumber}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Adjusting quantities will recalculate inventory and log stock delta adjustments.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSaveEdit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Customer Phone
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Payment Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e: any) => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-slate-800"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
              </select>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">
              Invoice Items
            </h3>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-3 text-right">Selling Rate</th>
                    <th className="py-2.5 px-3 text-center w-28">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((it, idx) => (
                    <tr key={it.productId}>
                      <td className="py-2 px-3">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {it.productName}
                        </span>
                        <span className="block text-[11px] font-mono text-slate-400">
                          {it.productCode} {it.size ? `· ${it.size}` : ''}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">₹{it.unitPrice.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={it.quantity}
                          onChange={(e) => updateQuantity(idx, Number(e.target.value))}
                          className="w-16 px-2 py-1 text-center font-bold border rounded-lg text-xs"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        ₹{it.lineTotal.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t text-sm font-semibold">
            <span>Revised Total Amount:</span>
            <span className="text-xl font-bold font-mono text-indigo-600">₹{finalTotal.toFixed(2)}</span>
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
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
            >
              {submitting ? 'Applying Corrections...' : 'Save & Adjust Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
