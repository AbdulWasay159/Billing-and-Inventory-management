// src/app/(dashboard)/inventory/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Search,
  PlusCircle,
  History,
  AlertTriangle,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency, formatQuantity } from '@/lib/utils';
import { Product, StockTransaction, StockTransactionType } from '@/types';
import { Modal } from '@/components/ui/modal';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');
  const [search, setSearch] = useState('');

  // Adjustment Modal State
  const [adjustModalProduct, setAdjustModalProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState<StockTransactionType>('STOCK_RECEIVED');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      const [prodRes, txRes] = await Promise.all([
        fetch('/api/products?limit=1000'),
        fetch('/api/inventory/adjust?limit=100'),
      ]);

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.products || []);
      }
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData || []);
      }
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalProduct || !adjustQty) return;
    setSubmitting(true);

    try {
      const numQty = Number(adjustQty);
      const quantityChange = adjustType === 'ADJUSTMENT' && numQty < 0 ? numQty : Math.abs(numQty);

      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: adjustModalProduct.id,
          quantityChange:
            adjustType === 'STOCK_RECEIVED' ? quantityChange : -Math.abs(quantityChange),
          transactionType: adjustType,
          notes: adjustNotes || 'Manual stock update',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to adjust stock');

      setAdjustModalProduct(null);
      setAdjustQty('');
      setAdjustNotes('');
      fetchInventoryData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.productId.toLowerCase().includes(search.toLowerCase()) ||
      p.companyBrand.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Inventory & Stock Audits
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time stock ledger with transactional change history
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-slate-800 p-1 text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'stock'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Current Stock Levels
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Transaction Logs
          </button>
        </div>
      </div>

      {activeTab === 'stock' ? (
        <>
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter inventory by Item Code, Product Name, Brand..."
              className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Current Stock Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-bold">Item Code</th>
                    <th className="py-3 px-4 font-semibold">Product Name</th>
                    <th className="py-3 px-4 font-semibold">Size</th>
                    <th className="py-3 px-4 font-semibold">Brand</th>
                    <th className="py-3 px-4 font-semibold text-right">Available Stock</th>
                    <th className="py-3 px-4 font-semibold text-right">Low Stock Limit</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                    <th className="py-3 px-4 font-semibold text-center">Adjust Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                        Loading inventory...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                        No products found.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLow = p.stockQuantity <= p.lowStockLimit && p.stockQuantity > 0;
                      const isOut = p.stockQuantity <= 0;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                            {p.productId}
                          </td>
                          <td className="py-3 px-4 font-sans font-medium text-slate-900 dark:text-white">
                            {p.name}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {p.size || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {p.companyBrand || '—'}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-bold text-sm ${
                              isOut
                                ? 'text-rose-600'
                                : isLow
                                ? 'text-amber-600'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {formatQuantity(p.stockQuantity, p.unit)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500">
                            {formatQuantity(p.lowStockLimit, p.unit)}
                          </td>
                          <td className="py-3 px-4 text-center font-sans">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isOut
                                  ? 'bg-rose-100 text-rose-800'
                                  : isLow
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-sans">
                            <button
                              onClick={() => {
                                setAdjustModalProduct(p);
                                setAdjustType('STOCK_RECEIVED');
                                setAdjustQty('');
                                setAdjustNotes('');
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
                            >
                              Adjust Stock
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Transaction History Tab */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">
              Recent Inventory Transactions (Audit Log)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-bold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Product Name</th>
                  <th className="py-3 px-4 font-semibold text-center">Type</th>
                  <th className="py-3 px-4 font-semibold text-right">Delta Change</th>
                  <th className="py-3 px-4 font-semibold text-right">Stock Before</th>
                  <th className="py-3 px-4 font-semibold text-right">Stock After</th>
                  <th className="py-3 px-4 font-semibold">Notes / Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                      No stock transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {new Date(tx.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-slate-900 dark:text-white">
                        {tx.productName || 'Product'}
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.transactionType === 'SALE'
                              ? 'bg-blue-50 text-blue-700'
                              : tx.transactionType === 'RETURN'
                              ? 'bg-purple-50 text-purple-700'
                              : tx.transactionType === 'IMPORT_SET'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {tx.transactionType}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold ${
                          Number(tx.quantityChange) > 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {Number(tx.quantityChange) > 0 ? `+${tx.quantityChange}` : tx.quantityChange}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">{tx.stockBefore}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                        {tx.stockAfter}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-400 text-[11px]">
                        {tx.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustModalProduct && (
        <Modal
          isOpen={Boolean(adjustModalProduct)}
          onClose={() => setAdjustModalProduct(null)}
          title={`Adjust Stock: ${adjustModalProduct.name}`}
          maxWidth="sm"
        >
          <form onSubmit={handleAdjustStock} className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
              <p>
                <span className="text-slate-500">Item Code:</span>{' '}
                <strong className="font-mono">{adjustModalProduct.productId}</strong>
              </p>
              <p>
                <span className="text-slate-500">Current Stock:</span>{' '}
                <strong>{formatQuantity(adjustModalProduct.stockQuantity, adjustModalProduct.unit)}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Transaction Type
              </label>
              <select
                value={adjustType}
                onChange={(e: any) => setAdjustType(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg bg-white dark:bg-slate-800"
              >
                <option value="STOCK_RECEIVED">Stock Received (Add incoming stock)</option>
                <option value="ADJUSTMENT">Stock Adjustment (Damaged / Missing / Correction)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Quantity ({adjustModalProduct.unit})
              </label>
              <input
                type="number"
                step="any"
                required
                min="0.01"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="e.g. 25"
                className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Notes / Supplier Invoice Reference
              </label>
              <input
                type="text"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="e.g. Supplier PO #8890"
                className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAdjustModalProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                {submitting ? 'Applying...' : 'Apply Adjustment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
