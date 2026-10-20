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
  Store,
} from 'lucide-react';
import { formatCurrency, formatQuantity } from '@/lib/utils';
import { Product } from '@/types';
import { Modal } from '@/components/ui/modal';
import { useShop } from '@/context/shop-context';

export default function DashboardPage() {
  const { shop } = useShop();
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
        const err = await res.json();
        throw new Error(err.error || 'Failed to adjust stock');
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
    <div className="space-y-6 pb-12">
      {/* Top Banner with Synchronized Shop Name & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {shop?.name ? `${shop.name} — Overview` : 'Shop Overview'}
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time inventory levels, sales velocity, and critical restock warnings
          </p>
        </div>

        {/* Period Selector */}
        <div className="inline-flex rounded-xl bg-slate-200/70 p-1 text-xs font-medium self-start sm:self-auto shadow-inner">
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
              className={`px-3 py-1.5 rounded-lg transition-all duration-150 ${
                period === p.id
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Stat Cards with 3D Depth */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Products */}
        <div className="card-3d bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Products</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              {loading ? '—' : data?.stats.totalProducts || 0}
            </h3>
            <Link
              href="/products"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 mt-2"
            >
              <span>Manage catalogue</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/60 shadow-2xs">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Sales in Selected Period */}
        <div className="card-3d card-3d-violet bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sales ({period})</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              {loading ? '—' : formatCurrency(data?.stats.selectedPeriodSalesAmount)}
            </h3>
            <p className="text-xs text-slate-400 mt-2 font-mono">
              {data?.stats.selectedPeriodInvoiceCount || 0} invoices billed
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-violet-50 text-violet-600 border border-violet-200/60 shadow-2xs">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Low Stock Items */}
        <div className="card-3d bg-white border border-amber-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between bg-amber-50/20">
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Low Stock Limit</p>
            <h3 className="text-2xl font-bold text-amber-900 mt-1 tracking-tight">
              {loading ? '—' : data?.stats.lowStockCount || 0}
            </h3>
            <p className="text-xs text-amber-600 mt-2 font-medium">Reorder recommended</p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Out of Stock */}
        <div className="card-3d bg-white border border-rose-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between bg-rose-50/20">
          <div>
            <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Out of Stock</p>
            <h3 className="text-2xl font-bold text-rose-900 mt-1 tracking-tight">
              {loading ? '—' : data?.stats.outOfStockCount || 0}
            </h3>
            <p className="text-xs text-rose-600 mt-2 font-medium">Depleted zero units</p>
          </div>
          <div className="p-3 rounded-2xl bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Action Bar with Royal Blue & Violet Identity */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/billing"
          className="flex items-center gap-2.5 p-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-blue-600/25 hover:shadow-lg transition-all font-semibold text-sm transform hover:-translate-y-0.5"
        >
          <Receipt className="w-5 h-5 shrink-0" />
          <span>New Bill (POS)</span>
        </Link>
        <Link
          href="/products"
          className="card-3d flex items-center gap-2.5 p-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl shadow-xs transition-all font-semibold text-sm"
        >
          <Package className="w-5 h-5 shrink-0 text-blue-600" />
          <span>Product Master</span>
        </Link>
        <Link
          href="/inventory"
          className="card-3d flex items-center gap-2.5 p-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl shadow-xs transition-all font-semibold text-sm"
        >
          <Boxes className="w-5 h-5 shrink-0 text-violet-600" />
          <span>Inventory Stock</span>
        </Link>
        <Link
          href="/imports-exports"
          className="card-3d flex items-center gap-2.5 p-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl shadow-xs transition-all font-semibold text-sm"
        >
          <FileSpreadsheet className="w-5 h-5 shrink-0 text-indigo-600" />
          <span>Excel Import/Export</span>
        </Link>
      </div>

      {/* Alerts Grid: Low Stock & Out of Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert Table */}
        <div className="card-3d bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2.5 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              <h3 className="font-semibold text-sm text-slate-900">
                Low Stock Warning (≤ Low Stock Limit)
              </h3>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold border border-amber-200">
              {data?.lowStockItems.length || 0}
            </span>
          </div>

          <div className="p-0 overflow-x-auto">
            {data?.lowStockItems && data.lowStockItems.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200/80">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-[11px]">Item Code</th>
                    <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-[11px]">Product Name</th>
                    <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-[11px] text-right">Current Stock</th>
                    <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-[11px] text-right">Min Level</th>
                    <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-[11px] text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.lowStockItems.slice(0, 6).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-700">
                        {item.productId}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {item.name}
                        {item.size ? ` (${item.size})` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-amber-700">
                        {formatQuantity(item.stockQuantity, item.unit)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-500">
                        {formatQuantity(item.lowStockLimit, item.unit)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => setAdjustModalProduct(item)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-medium hover:bg-blue-100 transition-colors"
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
        <div className="card-3d bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2.5 text-rose-700">
              <XCircle className="w-4 h-4" />
              <h3 className="font-semibold text-sm text-slate-900">
                Out of Stock (Zero Units)
              </h3>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold border border-rose-200">
              {data?.outOfStockItems.length || 0}
            </span>
          </div>

          <div className="p-0 overflow-x-auto">
            {data?.outOfStockItems && data.outOfStockItems.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200/80">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-[11px]">Item Code</th>
                    <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-[11px]">Product Name</th>
                    <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-[11px] text-right">Selling Rate</th>
                    <th className="py-2.5 px-4 font-semibold uppercase tracking-wider text-[11px] text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.outOfStockItems.slice(0, 6).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-700">
                        {item.productId}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {item.name}
                        {item.size ? ` (${item.size})` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        ₹{Number(item.sellingPrice).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => setAdjustModalProduct(item)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-medium hover:bg-blue-100 transition-colors"
                        >
                          + Restock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                All inventory items are currently in stock.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stock Receipt Modal */}
      {adjustModalProduct && (
        <Modal
          isOpen={Boolean(adjustModalProduct)}
          onClose={() => setAdjustModalProduct(null)}
          title={`Quick Restock: ${adjustModalProduct.name}`}
          maxWidth="sm"
        >
          <form onSubmit={handleStockAdjustment} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <p>
                Product Code: <strong className="font-mono text-slate-800">{adjustModalProduct.productId}</strong>
              </p>
              <p>
                Current Stock: <strong className="text-slate-800">{formatQuantity(adjustModalProduct.stockQuantity, adjustModalProduct.unit)}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quantity to Add *
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                required
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="e.g. 50"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Receipt Note
              </label>
              <input
                type="text"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="e.g. Received shipment from distributor"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setAdjustModalProduct(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adjusting}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-600/20 transition-all disabled:opacity-50"
              >
                {adjusting ? 'Saving...' : 'Add Stock Now'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
