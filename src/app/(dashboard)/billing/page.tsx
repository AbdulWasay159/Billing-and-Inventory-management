// src/app/(dashboard)/billing/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Receipt,
  Search,
  Plus,
  Trash2,
  Printer,
  Download,
  AlertCircle,
  CreditCard,
  Banknote,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { formatCurrency, formatQuantity } from '@/lib/utils';
import { Product, PaymentMode } from '@/types';

interface BillDraftItem {
  productId: string;
  productCode: string;
  name: string;
  size: string;
  unit: string;
  sellingPrice: number;
  availableStock: number;
  quantity: number;
  lineTotal: number;
}

export default function BillingPage() {
  const router = useRouter();

  // Search & Products
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Bill State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<BillDraftItem[]>([]);

  // Action status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

  // Debounced live product search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(searchQuery)}&limit=10`);
        const data = await res.json();
        setSearchResults(data.products || []);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addItemToBill = (product: Product) => {
    if (product.stockQuantity <= 0) {
      alert(`Cannot add "${product.name}". Product is currently out of stock.`);
      return;
    }

    setItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.productId === product.id);
      if (existingIdx !== -1) {
        // Increment quantity if already added
        const currentItem = prev[existingIdx];
        const newQty = currentItem.quantity + 1;
        if (newQty > product.stockQuantity) {
          alert(`Cannot add more. Only ${product.stockQuantity} ${product.unit} available in stock.`);
          return prev;
        }

        const updated = [...prev];
        updated[existingIdx] = {
          ...currentItem,
          quantity: newQty,
          lineTotal: Math.round(Number(currentItem.sellingPrice) * newQty * 100) / 100,
        };
        return updated;
      }

      // Add fresh line item
      return [
        ...prev,
        {
          productId: product.id,
          productCode: product.productId,
          name: product.name,
          size: product.size || '',
          unit: product.unit || 'Pcs',
          sellingPrice: Number(product.sellingPrice),
          availableStock: Number(product.stockQuantity),
          quantity: 1,
          lineTotal: Number(product.sellingPrice),
        },
      ];
    });

    setSearchQuery('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const updateItemQuantity = (index: number, newQty: number) => {
    if (isNaN(newQty) || newQty <= 0) return;

    setItems((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (newQty > target.availableStock) {
        alert(`Cannot bill ${newQty} ${target.unit}. Maximum available is ${target.availableStock} ${target.unit}.`);
        return prev;
      }

      updated[index] = {
        ...target,
        quantity: newQty,
        lineTotal: Math.round(target.sellingPrice * newQty * 100) / 100,
      };
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Pricing Totals
  const subtotal = items.reduce((acc, it) => acc + it.lineTotal, 0);
  const discount = Math.max(0, Number(discountAmount) || 0);
  const finalTotal = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

  // Submit and create invoice atomically (Section 12)
  const handleSaveInvoice = async () => {
    if (items.length === 0) {
      setError('Please add at least one product line item to generate an invoice.');
      return;
    }

    if (items.length > 200) {
      setError('An invoice cannot contain more than 200 items (10 A4 pages maximum).');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
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
        throw new Error(data.error || 'Failed to create bill');
      }

      const invoiceId = data?.invoice?.id || data?.id;
      if (!invoiceId) {
        throw new Error('Invoice was created, but response is missing an invoice ID.');
      }

      // Reset cart and billing form immediately to prevent duplicate submissions
      setItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscountAmount('0');
      setNotes('');
      setCreatedInvoiceId(invoiceId);
      router.push(`/invoices/${invoiceId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetBill = () => {
    if (items.length > 0 && !confirm('Clear the current billing counter?')) return;
    setItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountAmount('0');
    setNotes('');
    setError(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Billing & POS Counter
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Instant billing counter with atomic inventory updates and automatic A4 pagination
          </p>
        </div>

        <button
          onClick={handleResetBill}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs self-start sm:self-auto transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear Counter</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Billing Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Product Picker & Bill Items Table */}
        <div className="lg:col-span-2 space-y-4">
          {/* Fast Product Search Bar */}
          <div className="relative">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan or type Product ID (e.g. HW-0001) or Product Name..."
                className="w-full pl-11 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-2xl shadow-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
              />
            </div>

            {/* Live Autocomplete Dropdown */}
            {searchQuery.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 max-h-80 overflow-y-auto divide-y divide-slate-100">
                {searching ? (
                  <div className="p-4 text-center text-xs text-slate-400">Searching products...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No products found for &quot;{searchQuery}&quot;.
                  </div>
                ) : (
                  searchResults.map((prod) => (
                    <button
                      key={prod.id}
                      onClick={() => addItemToBill(prod)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            {prod.productId}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {prod.name}
                          </span>
                          {prod.size && (
                            <span className="text-slate-500 font-medium">({prod.size})</span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          Stock: {formatQuantity(prod.stockQuantity, prod.unit)} | {prod.companyBrand}
                        </span>
                      </div>
                      <div className="text-right">
                        <strong className="text-sm font-bold text-slate-900 font-mono">
                          ₹{Number(prod.sellingPrice).toFixed(2)}
                        </strong>
                        <span className="block text-[11px] text-blue-600 font-semibold mt-0.5">+ Add</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Current Items Table */}
          <div className="card-3d bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-bold text-sm text-slate-900">
                Billed Items ({items.length} of max 200)
              </h2>
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                A4 Prints: {Math.ceil(items.length / 20) || 1} Page(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold text-center w-8 uppercase tracking-wider text-[11px]">#</th>
                    <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-[11px]">Item & Code</th>
                    <th className="py-2.5 px-3 font-semibold text-right uppercase tracking-wider text-[11px]">Selling Rate</th>
                    <th className="py-2.5 px-3 font-semibold text-center w-28 uppercase tracking-wider text-[11px]">Quantity</th>
                    <th className="py-2.5 px-3 font-semibold text-right uppercase tracking-wider text-[11px]">Line Total</th>
                    <th className="py-2.5 px-3 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No items added yet. Search and select products above to begin billing.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr key={item.productId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-[11px] font-mono text-blue-700">
                            {item.productCode} {item.size ? `· ${item.size}` : ''}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          ₹{item.sellingPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
                            <button
                              type="button"
                              onClick={() => updateItemQuantity(idx, item.quantity - 1)}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              max={item.availableStock}
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(idx, Number(e.target.value))}
                              className="w-14 text-center text-xs font-bold font-mono focus:outline-none bg-white py-1"
                            />
                            <button
                              type="button"
                              onClick={() => updateItemQuantity(idx, item.quantity + 1)}
                              className="px-2 py-1 bg-slate-50 hover:bg-slate-200 text-slate-700 font-bold transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{item.lineTotal.toFixed(2)}
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Customer Info & Checkout Summary */}
        <div className="space-y-4">
          <div className="card-3d bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3">
              Customer & Payment
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Name (Optional)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in Customer"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Customer Phone (Optional)
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
              />
            </div>

            {/* Payment Mode Selector: CASH or UPI */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Payment Mode *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode('CASH')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    paymentMode === 'CASH'
                      ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className="w-4 h-4 text-blue-700" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('UPI')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    paymentMode === 'UPI'
                      ? 'border-violet-600 bg-violet-50 text-violet-800 shadow-2xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-violet-700" />
                  <span>UPI / QR</span>
                </button>
              </div>
            </div>

            {/* Totals Section */}
            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({items.length} items):</span>
                <span className="font-mono font-semibold text-slate-900">
                  ₹{subtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Discount (₹):</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-24 px-2.5 py-1 text-right text-xs border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
                />
              </div>

              <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                <span className="font-bold text-sm text-slate-900">Final Total:</span>
                <span className="font-mono text-2xl font-bold text-blue-700">
                  ₹{finalTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Save Bill Action */}
            <button
              type="button"
              onClick={handleSaveInvoice}
              disabled={submitting || items.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-600/25 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transform hover:-translate-y-0.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{submitting ? 'Generating Bill...' : 'Save & Print Invoice'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
