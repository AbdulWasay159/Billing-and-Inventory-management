// src/app/(dashboard)/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Receipt,
  PlusCircle,
  FileSpreadsheet,
  ArrowRight,
  Boxes,
} from 'lucide-react';
import { formatCurrency, formatQuantity } from '@/lib/utils';
import { Product } from '@/types';
import { Modal } from '@/components/ui/modal';

export default function DashboardPage() {
  const [data, setData] = useState<{
    stats: {
      totalProducts: number;
      lowStockCount: number;
      outOfStockCount: number;
      todaySalesAmount: number;
      todayInvoiceCount: number;
      selectedPeriodSalesAmount: number;
      selectedPeriodInvoiceCount: number;
    };
    lowStockItems: Product[];
    outOfStockItems: Product[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | '7days' | 'month' | 'prevMonth'>('month');

  // Quick Stock Adjustment Modal State
  const [adjustModalProduct, setAdjustModalProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate = '';
      let endDate = '';

      if (period === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (period === '7days') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString();
      } else if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      } else if (period === 'prevMonth') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
      }

      let url = '/api/analytics/dashboard';
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const resJson = await res.json();
      setData(resJson);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalProduct || !adjustQty) return;
    setAdjusting(true);

    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: adjustModalProduct.id,
          quantityChange: Number(adjustQty),
          transactionType: 'STOCK_RECEIVED',
          notes: adjustNotes || 'Manual stock receipt from dashboard',
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update stock');
      }

      setAdjustModalProduct(null);
      setAdjustQty('');
      setAdjustNotes('');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Banner & Quick Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Shop Overview
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time inventory and billing status
          </p>
        </div>

        {/* Period Selector */}
        <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-slate-800 p-1 text-xs font-medium self-start sm:self-auto">
          {(
            [
              { id: 'today', label: 'Today' },
              { id: '7days', label: '7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'prevMonth', label: 'Last Month' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === p.id
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Products */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Products</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {loading ? '—' : data?.stats.totalProducts || 0}
            </h3>
            <Link
              href="/products"
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mt-2"
            >
              <span>Manage products</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Sales in Selected Period */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Sales ({period})</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {loading ? '—' : formatCurrency(data?.stats.selectedPeriodSalesAmount)}
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              {data?.stats.selectedPeriodInvoiceCount || 0} invoices billed
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Low Stock Items */}
        <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-5 shadow-xs flex items-center justify-between bg-amber-50/20">
          <div>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Low Stock Limit</p>
            <h3 className="text-2xl font-bold text-amber-800 dark:text-amber-300 mt-1">
              {loading ? '—' : data?.stats.lowStockCount || 0}
            </h3>
            <p className="text-xs text-amber-600 dark:text-amber-400/80 mt-2">Need reordering</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Out of Stock */}
        <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-5 shadow-xs flex items-center justify-between bg-rose-50/20">
          <div>
            <p className="text-xs font-medium text-rose-700 dark:text-rose-400">Out of Stock</p>
            <h3 className="text-2xl font-bold text-rose-800 dark:text-rose-300 mt-1">
              {loading ? '—' : data?.stats.outOfStockCount || 0}
            </h3>
            <p className="text-xs text-rose-600 dark:text-rose-400/80 mt-2">Zero stock quantity</p>
          </div>
          <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/billing"
          className="flex items-center gap-2 p-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors"
        >
          <Receipt className="w-5 h-5" />
          <span className="text-sm font-semibold">New Bill</span>
        </Link>
        <Link
          href="/products"
          className="flex items-center gap-2 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-white rounded-xl shadow-xs transition-colors"
        >
          <Package className="w-5 h-5 text-indigo-500" />
          <span className="text-sm font-semibold">Product Master</span>
        </Link>
        <Link
          href="/inventory"
          className="flex items-center gap-2 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-white rounded-xl shadow-xs transition-colors"
        >
          <Boxes className="w-5 h-5 text-emerald-500" />
          <span className="text-sm font-semibold">Inventory Stock</span>
        </Link>
        <Link
          href="/imports-exports"
          className="flex items-center gap-2 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-white rounded-xl shadow-xs transition-colors"
        >
          <FileSpreadsheet className="w-5 h-5 text-amber-500" />
          <span className="text-sm font-semibold">Excel Import/Export</span>
        </Link>
      </div>

      {/* Alerts Grid: Low Stock & Out of Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Low Stock Warning (≤ Low Stock Limit)
              </h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
              {data?.lowStockItems.length || 0}
            </span>
          </div>

          <div className="p-0 overflow-x-auto">
            {data?.lowStockItems && data.lowStockItems.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Item Code</th>
                    <th className="py-2.5 px-4 font-medium">Product Name</th>
                    <th className="py-2.5 px-4 font-medium text-right">Current Stock</th>
                    <th className="py-2.5 px-4 font-medium text-right">Min Level</th>
                    <th className="py-2.5 px-4 font-medium text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.lowStockItems.slice(0, 6).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {item.productId}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                        {item.name}
                        {item.size ? ` (${item.size})` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-amber-600 dark:text-amber-400">
                        {formatQuantity(item.stockQuantity, item.unit)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500">
                        {formatQuantity(item.lowStockLimit, item.unit)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => setAdjustModalProduct(item)}
                          className="px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-medium hover:bg-indigo-100 transition-colors"
                        >
                          + Add Stock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No items currently below low stock threshold.
              </div>
            )}
          </div>
        </div>

        {/* Out of Stock Alert Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <XCircle className="w-4 h-4" />
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Out of Stock (Zero Units)
              </h3>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-medium">
              {data?.outOfStockItems.length || 0}
            </span>
          </div>

          <div className="p-0 overflow-x-auto">
            {data?.outOfStockItems && data.outOfStockItems.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Item Code</th>
                    <th className="py-2.5 px-4 font-medium">Product Name</th>
                    <th className="py-2.5 px-4 font-medium text-right">Selling Rate</th>
                    <th className="py-2.5 px-4 font-medium text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.outOfStockItems.slice(0, 6).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {item.productId}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                        {item.name}
                        {item.size ? ` (${item.size})` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-700 dark:text-slate-300">
                        {formatCurrency(item.sellingPrice)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => setAdjustModalProduct(item)}
                          className="px-2.5 py-1 rounded bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-medium hover:bg-rose-100 transition-colors"
                        >
                          Restock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No products are currently completely out of stock.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Restock Modal */}
      {adjustModalProduct && (
        <Modal
          isOpen={Boolean(adjustModalProduct)}
          onClose={() => setAdjustModalProduct(null)}
          title={`Restock: ${adjustModalProduct.name}`}
        >
          <form onSubmit={handleStockAdjustment} className="space-y-4">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
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
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Quantity to Add ({adjustModalProduct.unit})
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="e.g. 50"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Receipt Note / Supplier Reference (Optional)
              </label>
              <input
                type="text"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="e.g. Received from Astral distributor"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAdjustModalProduct(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adjusting}
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                {adjusting ? 'Adding...' : 'Confirm Restock'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
