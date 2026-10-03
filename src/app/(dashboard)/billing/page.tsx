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

      // Add new row
      return [
        ...prev,
        {
          productId: product.id,
          productCode: product.productId,
          name: product.name,
          size: product.size,
          unit: product.unit,
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
    setItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      if (newQty <= 0) return prev;
      if (newQty > item.availableStock) {
        alert(`Cannot exceed available stock of ${item.availableStock} ${item.unit}.`);
        return prev;
      }

      updated[index] = {
        ...item,
        quantity: newQty,
        lineTotal: Math.round(item.sellingPrice * newQty * 100) / 100,
      };
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);
  const discountVal = Math.max(0, Number(discountAmount) || 0);
  const finalTotal = Math.max(0, Math.round((subtotal - discountVal) * 100) / 100);

  const handleSaveInvoice = async () => {
    if (items.length === 0) {
      setError('Please add at least one product to the invoice.');
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        paymentMode,
        discountAmount: discountVal,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
        })),
      };

      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create invoice.');
      }

      setCreatedInvoiceId(data.id);
      router.push(`/invoices/${data.id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetBill = () => {
    if (items.length > 0 && !confirm('Are you sure you want to clear current draft bill?')) {
      return;
    }
    setItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountAmount('0');
    setNotes('');
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Billing & POS Counter
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Create invoices with atomic stock decrement and strict A4 multi-page pagination
          </p>
        </div>

        <button
          onClick={handleResetBill}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 self-start sm:self-auto"
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
                className="w-full pl-11 pr-4 py-3 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Live Autocomplete Dropdown */}
            {searchQuery.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-20 max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
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
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {prod.productId}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {prod.name}
                          </span>
                          {prod.size && (
                            <span className="text-slate-500 font-medium">({prod.size})</span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Stock: {formatQuantity(prod.stockQuantity, prod.unit)} | {prod.companyBrand}
                        </span>
                      </div>
                      <div className="text-right">
                        <strong className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                          ₹{Number(prod.sellingPrice).toFixed(2)}
                        </strong>
                        <span className="block text-[10px] text-indigo-500 font-semibold">+ Add</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Current Items Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">
                Billed Items ({items.length} of max 200)
              </h2>
              <span className="text-xs text-slate-500">
                A4 Prints: {Math.ceil(items.length / 20) || 1} Page(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold text-center w-8">#</th>
                    <th className="py-2.5 px-3 font-semibold">Item & Code</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Selling Rate</th>
                    <th className="py-2.5 px-3 font-semibold text-center w-28">Quantity</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Line Total</th>
                    <th className="py-2.5 px-3 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No items added yet. Search and select products above to begin billing.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr key={item.productId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-medium text-slate-900 dark:text-white">{item.name}</p>
                          <p className="text-[11px] font-mono text-slate-400">
                            {item.productCode} {item.size ? `· ${item.size}` : ''}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                          ₹{item.sellingPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => updateItemQuantity(idx, item.quantity - 1)}
                              className="px-2 py-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
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
                              className="w-14 text-center text-xs font-bold font-mono focus:outline-none bg-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => updateItemQuantity(idx, item.quantity + 1)}
                              className="px-2 py-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          ₹{item.lineTotal.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              Customer & Payment
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Customer Name (Optional)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in Customer"
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Customer Phone (Optional)
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            {/* Payment Mode Selector: CASH or UPI (NO credit billing - Section 12) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Payment Mode *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode('CASH')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    paymentMode === 'CASH'
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('UPI')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    paymentMode === 'UPI'
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>UPI / QR</span>
                </button>
              </div>
            </div>

            {/* Totals Section */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal ({items.length} items):</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  ₹{subtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Discount (₹):</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-20 px-2 py-1 text-right text-xs border border-slate-200 rounded font-mono"
                />
              </div>

              <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="font-bold text-sm text-slate-900 dark:text-white">Final Total:</span>
                <span className="font-mono text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  ₹{finalTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Save Bill Action */}
            <button
              type="button"
              onClick={handleSaveInvoice}
              disabled={submitting || items.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/20 text-sm transition-all"
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
