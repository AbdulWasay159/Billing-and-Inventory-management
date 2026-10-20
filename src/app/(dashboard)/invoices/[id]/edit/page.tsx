// src/app/(dashboard)/invoices/[id]/edit/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, AlertCircle, Trash2, Search, Plus, Check } from 'lucide-react';
import { Invoice, PaymentMode, Product } from '@/types';

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

  // Search & Add new products
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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
              size: it.sizeSnapshot || '',
              quantity: it.quantity,
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

  // Live product search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(searchQuery)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.products || []);
          setIsDropdownOpen(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addProductToInvoice = (product: Product) => {
    const existingIndex = items.findIndex((it) => it.productId === product.id);
    if (existingIndex !== -1) {
      updateQuantity(existingIndex, items[existingIndex].quantity + 1);
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          productCode: product.productId,
          size: product.size || '',
          quantity: 1,
          unitPrice: Number(product.sellingPrice),
          lineTotal: Number(product.sellingPrice),
        },
      ]);
    }
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (isNaN(newQty) || newQty <= 0) return;
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        quantity: newQty,
        lineTotal: Math.round(newQty * updated[index].unitPrice * 100) / 100,
      };
      return updated;
    });
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      alert('An invoice must contain at least one line item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((acc, it) => acc + it.lineTotal, 0);
  const discount = Math.max(0, Number(discountAmount) || 0);
  const finalTotal = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          paymentMode,
          discountAmount: discount,
          notes: notes.trim() || undefined,
          items: items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update bill');
      }

      router.push(`/invoices/${id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading invoice...</div>;
  if (!invoice) return <div className="p-8 text-center text-slate-500">Invoice not found.</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="card-3d bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
          <Link
            href={`/invoices/${id}`}
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Edit Invoice: <span className="font-mono text-blue-600">{invoice.invoiceNumber}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Adjusting quantities or adding items will recalculate inventory and log stock delta adjustments.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSaveEdit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Phone
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e: any) => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Discount (₹)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notes / Revision Reason
            </label>
            <input
              type="text"
              placeholder="e.g. Rate correction / Added item at customer request"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
            />
          </div>

          {/* Add Product Search Bar */}
          <div ref={searchContainerRef} className="relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Add New Product to Invoice
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products by name, code, or brand to add..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                  Searching...
                </div>
              )}
            </div>

            {isDropdownOpen && searchResults.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
                {searchResults.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => addProductToInvoice(prod)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <span className="font-semibold text-slate-900">{prod.name}</span>
                      <span className="ml-2 font-mono text-[11px] text-blue-700">
                        ({prod.productId} {prod.size ? `· ${prod.size}` : ''})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-500">
                        Stock: <span className="font-bold">{prod.stockQuantity}</span>
                      </span>
                      <span className="font-bold font-mono text-slate-900">
                        ₹{Number(prod.sellingPrice).toFixed(2)}
                      </span>
                      <span className="p-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                        <Plus className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <h3 className="font-semibold text-xs text-slate-700">Line Items ({items.length})</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-2.5 px-3 uppercase tracking-wider text-[11px]">Product</th>
                    <th className="py-2.5 px-3 text-right uppercase tracking-wider text-[11px]">Unit Rate</th>
                    <th className="py-2.5 px-3 text-center w-24 uppercase tracking-wider text-[11px]">Quantity</th>
                    <th className="py-2.5 px-3 text-right uppercase tracking-wider text-[11px]">Line Total</th>
                    <th className="py-2.5 px-3 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => (
                    <tr key={it.productId} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-900">{it.productName}</span>
                        <span className="block text-[11px] font-mono text-blue-700">
                          {it.productCode} {it.size ? `· ${it.size}` : ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">₹{it.unitPrice.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={it.quantity}
                          onChange={(e) => updateQuantity(idx, Number(e.target.value))}
                          className="w-16 px-2 py-1 text-center font-bold border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ₹{it.lineTotal.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
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

          <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>Items Subtotal:</span>
              <span className="font-mono font-semibold text-slate-900">₹{subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between items-center text-rose-600">
                <span>Discount Applied:</span>
                <span className="font-mono font-semibold">- ₹{discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 text-sm font-semibold">
              <span className="text-slate-900 font-bold">Revised Total Amount:</span>
              <span className="text-xl font-bold font-mono text-blue-700">₹{finalTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Link
              href={`/invoices/${id}`}
              className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              {submitting ? 'Applying Corrections...' : 'Save & Adjust Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
