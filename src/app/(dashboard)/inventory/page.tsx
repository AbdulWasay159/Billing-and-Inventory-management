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
  Filter,
  X,
  RotateCcw,
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

  // Current Stock Filter States (Phase 2.2 requirement)
  const [stockBrand, setStockBrand] = useState('all');
  const [stockStatus, setStockStatus] = useState<'all' | 'inStock' | 'lowStock' | 'outOfStock'>('all');
  const [showStockFilterModal, setShowStockFilterModal] = useState(false);
  const [draftStockBrand, setDraftStockBrand] = useState('all');
  const [draftStockStatus, setDraftStockStatus] = useState<'all' | 'inStock' | 'lowStock' | 'outOfStock'>('all');

  // Transaction Logs Filter States
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');
  const [txDateFilter, setTxDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');

  // Dynamic filter options from actual catalogue
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);

  // Adjustment Modal State
  const [adjustModalProduct, setAdjustModalProduct] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState<StockTransactionType>('STOCK_RECEIVED');
  const [adjustDirection, setAdjustDirection] = useState<'DEDUCT' | 'ADD'>('DEDUCT');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchInventoryData = async () => {
    setLoading(true);
    try {
      const [prodRes, txRes, filterRes] = await Promise.all([
        fetch('/api/products?limit=1000'),
        fetch('/api/inventory/adjust?limit=200'),
        fetch('/api/products/filters'),
      ]);

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.products || []);
      }
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData || []);
      }
      if (filterRes.ok) {
        const filterData = await filterRes.json();
        setAvailableBrands(filterData.brands || []);
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
      const numQty = Math.abs(Number(adjustQty));
      if (isNaN(numQty) || numQty <= 0) {
        throw new Error('Please enter a valid stock quantity.');
      }

      const delta =
        adjustType === 'STOCK_RECEIVED'
          ? numQty
          : adjustDirection === 'ADD'
          ? numQty
          : -numQty;

      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: adjustModalProduct.id,
          quantityChange: delta,
          transactionType: adjustType,
          notes: adjustNotes || (delta > 0 ? 'Stock received/added' : 'Stock adjustment deduction'),
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

  const filteredProducts = products.filter((p) => {
    // Search query matching
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matches =
        p.name.toLowerCase().includes(q) ||
        p.productId.toLowerCase().includes(q) ||
        p.companyBrand.toLowerCase().includes(q) ||
        (p.size && p.size.toLowerCase().includes(q));
      if (!matches) return false;
    }

    // Brand filtering
    if (stockBrand !== 'all') {
      if (stockBrand.toLowerCase() === 'unbranded') {
        if (p.companyBrand && p.companyBrand.trim() !== '') return false;
      } else {
        if (!p.companyBrand || p.companyBrand.toLowerCase() !== stockBrand.toLowerCase()) return false;
      }
    }

    // Stock Status filtering
    if (stockStatus === 'outOfStock') {
      if (p.stockQuantity > 0) return false;
    } else if (stockStatus === 'lowStock') {
      if (!(p.stockQuantity > 0 && p.stockQuantity <= p.lowStockLimit)) return false;
    } else if (stockStatus === 'inStock') {
      if (!(p.stockQuantity > p.lowStockLimit)) return false;
    }

    return true;
  });

  const filteredTransactions = transactions.filter((tx) => {
    // Search query matching
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matches =
        (tx.productName && tx.productName.toLowerCase().includes(q)) ||
        (tx.notes && tx.notes.toLowerCase().includes(q)) ||
        tx.transactionType.toLowerCase().includes(q);
      if (!matches) return false;
    }

    // Transaction Type filtering
    if (txTypeFilter !== 'ALL' && tx.transactionType !== txTypeFilter) {
      return false;
    }

    // Date filtering
    if (txDateFilter !== 'all') {
      const txTime = new Date(tx.createdAt).getTime();
      const now = Date.now();
      if (txDateFilter === 'today') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        if (txTime < startOfDay.getTime()) return false;
      } else if (txDateFilter === '7days') {
        if (now - txTime > 7 * 86400000) return false;
      } else if (txDateFilter === '30days') {
        if (now - txTime > 30 * 86400000) return false;
      }
    }

    return true;
  });

  const activeStockFiltersCount =
    (stockBrand !== 'all' ? 1 : 0) + (stockStatus !== 'all' ? 1 : 0);

  const activeTxFiltersCount =
    (txTypeFilter !== 'ALL' ? 1 : 0) + (txDateFilter !== 'all' ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Inventory & Stock Audits
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time stock ledger with transactional change history and receipt tracking
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-xl bg-slate-200/70 p-1 text-xs font-semibold self-start sm:self-auto shadow-inner">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              activeTab === 'stock'
                ? 'bg-gradient-to-r from-[#3563e9] to-[#7656e8] text-white shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Current Stock Levels
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-[#3563e9] to-[#7656e8] text-white shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Transaction Logs
          </button>
        </div>
      </div>

      {activeTab === 'stock' ? (
        <>
          {/* Search & Filter Bar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter inventory by Item Code, Product Name, Brand..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9] transition-all shadow-sm"
                />
              </div>

              {/* Filter Trigger Button */}
              <button
                type="button"
                onClick={() => {
                  setDraftStockBrand(stockBrand);
                  setDraftStockStatus(stockStatus);
                  setShowStockFilterModal(true);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition-all shadow-2xs shrink-0 ${
                  activeStockFiltersCount > 0
                    ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <Filter className="w-4 h-4 text-[#3563e9]" />
                <span>Filter</span>
                {activeStockFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#3563e9] text-white text-[10px] font-bold flex items-center justify-center">
                    {activeStockFiltersCount}
                  </span>
                )}
              </button>
            </div>

            {/* Active Chips for Current Stock */}
            {(activeStockFiltersCount > 0 || search.trim()) && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="font-semibold text-slate-500">
                  Active Filters ({filteredProducts.length} items):
                </span>
                {stockBrand !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                    <span>Brand: <strong>{stockBrand}</strong></span>
                    <button
                      type="button"
                      onClick={() => setStockBrand('all')}
                      className="hover:text-blue-900 p-0.5 rounded-full hover:bg-blue-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {stockStatus !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                    <span>
                      Status:{' '}
                      <strong>
                        {stockStatus === 'lowStock'
                          ? 'Low Stock'
                          : stockStatus === 'outOfStock'
                          ? 'Out of Stock'
                          : 'In Stock'}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setStockStatus('all')}
                      className="hover:text-amber-950 p-0.5 rounded-full hover:bg-amber-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {search.trim() && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                    <span>Search: "<strong>{search.trim()}</strong>"</span>
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="hover:text-slate-900 p-0.5 rounded-full hover:bg-slate-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setStockBrand('all');
                    setStockStatus('all');
                    setSearch('');
                  }}
                  className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-semibold underline underline-offset-2 ml-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              </div>
            )}
          </div>

          {/* Current Stock Table */}
          <div className="card-3d bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-4 font-bold uppercase tracking-wider text-[11px]">Item Code</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Product Name</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Size</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Brand</th>
                    <th className="py-3 px-4 font-semibold text-right uppercase tracking-wider text-[11px]">Available Stock</th>
                    <th className="py-3 px-4 font-semibold text-right uppercase tracking-wider text-[11px]">Low Stock Limit</th>
                    <th className="py-3 px-4 font-semibold text-center uppercase tracking-wider text-[11px]">Status</th>
                    <th className="py-3 px-4 font-semibold text-center uppercase tracking-wider text-[11px]">Adjust Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                        Loading inventory...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center font-sans">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Boxes className="w-8 h-8 text-slate-300" />
                          <p className="text-sm font-semibold text-slate-700">No inventory products match criteria</p>
                          {(activeStockFiltersCount > 0 || search.trim()) && (
                            <button
                              type="button"
                              onClick={() => {
                                setStockBrand('all');
                                setStockStatus('all');
                                setSearch('');
                              }}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reset Filters</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLow = p.stockQuantity <= p.lowStockLimit && p.stockQuantity > 0;
                      const isOut = p.stockQuantity <= 0;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-bold text-[#3563e9]">
                            {p.productId}
                          </td>
                          <td className="py-3 px-4 font-sans font-medium text-slate-900">
                            {p.name}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {p.size || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {p.companyBrand || '—'}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-bold text-sm ${
                              isOut
                                ? 'text-rose-600'
                                : isLow
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            {formatQuantity(p.stockQuantity, p.unit)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500">
                            {formatQuantity(p.lowStockLimit, p.unit)}
                          </td>
                          <td className="py-3 px-4 text-center font-sans">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                isOut
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : isLow
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
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
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#3563e9]/10 text-[#3563e9] border border-[#3563e9]/20 hover:bg-[#3563e9]/15 transition-colors"
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
        /* Transaction History Tab (Phase 2.2 requirement) */
        <div className="space-y-3">
          {/* Transaction Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search audit logs by product name, notes, reference..."
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9] transition-all shadow-sm"
              />
            </div>

            {/* Transaction Type Filter */}
            <select
              value={txTypeFilter}
              onChange={(e) => setTxTypeFilter(e.target.value)}
              className="px-3 py-2.5 text-xs bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9] shadow-2xs"
            >
              <option value="ALL">All Transaction Types</option>
              <option value="SALE">SALE (Counter POS)</option>
              <option value="RETURN">RETURN (Restocked)</option>
              <option value="STOCK_RECEIVED">STOCK_RECEIVED (Shipment)</option>
              <option value="ADJUSTMENT">ADJUSTMENT (Audit)</option>
              <option value="IMPORT_SET">IMPORT_SET (Excel Import)</option>
            </select>

            {/* Date Preset Selector */}
            <div className="inline-flex rounded-xl bg-slate-200/70 p-1 text-xs font-medium self-start sm:self-auto shrink-0 shadow-inner">
              {(
                [
                  { id: 'all', label: 'All Time' },
                  { id: 'today', label: 'Today' },
                  { id: '7days', label: '7 Days' },
                  { id: '30days', label: '30 Days' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setTxDateFilter(p.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    txDateFilter === p.id
                      ? 'bg-white text-blue-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active Transaction Filters */}
          {(activeTxFiltersCount > 0 || search.trim()) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="font-semibold text-slate-500">
                Active Audit Filters ({filteredTransactions.length} logs):
              </span>
              {txTypeFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                  <span>Type: <strong>{txTypeFilter}</strong></span>
                  <button
                    type="button"
                    onClick={() => setTxTypeFilter('ALL')}
                    className="hover:text-blue-900 p-0.5 rounded-full hover:bg-blue-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {txDateFilter !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 font-medium">
                  <span>Date: <strong>{txDateFilter}</strong></span>
                  <button
                    type="button"
                    onClick={() => setTxDateFilter('all')}
                    className="hover:text-violet-900 p-0.5 rounded-full hover:bg-violet-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {search.trim() && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                  <span>Search: "<strong>{search.trim()}</strong>"</span>
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="hover:text-slate-900 p-0.5 rounded-full hover:bg-slate-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setTxTypeFilter('ALL');
                  setTxDateFilter('all');
                  setSearch('');
                }}
                className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-semibold underline underline-offset-2 ml-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear All</span>
              </button>
            </div>
          )}

          <div className="card-3d bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <h2 className="font-bold text-sm text-slate-900">
                Recent Inventory Transactions (Audit Log)
              </h2>
              <span className="text-xs font-semibold text-slate-500">
                {filteredTransactions.length} transaction{filteredTransactions.length === 1 ? '' : 's'} found
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-3 px-4 font-bold uppercase tracking-wider text-[11px]">Timestamp</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Product Name</th>
                    <th className="py-3 px-4 font-semibold text-center uppercase tracking-wider text-[11px]">Type</th>
                    <th className="py-3 px-4 font-semibold text-right uppercase tracking-wider text-[11px]">Delta Change</th>
                    <th className="py-3 px-4 font-semibold text-right uppercase tracking-wider text-[11px]">Stock Before</th>
                    <th className="py-3 px-4 font-semibold text-right uppercase tracking-wider text-[11px]">Stock After</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Notes / Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <History className="w-8 h-8 text-slate-300" />
                          <p className="text-sm font-semibold text-slate-700">No stock transactions match your criteria</p>
                          {(activeTxFiltersCount > 0 || search.trim()) && (
                            <button
                              type="button"
                              onClick={() => {
                                setTxTypeFilter('ALL');
                                setTxDateFilter('all');
                                setSearch('');
                              }}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reset Audit Filters</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(tx.createdAt).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 font-sans font-medium text-slate-900">
                          {tx.productName || 'Product'}
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                              tx.transactionType === 'SALE'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : tx.transactionType === 'RETURN'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : tx.transactionType === 'IMPORT_SET'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {tx.transactionType}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold ${
                            Number(tx.quantityChange) > 0 ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {Number(tx.quantityChange) > 0 ? `+${tx.quantityChange}` : tx.quantityChange}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500">{tx.stockBefore}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {tx.stockAfter}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-600 text-[11px]">
                          {tx.notes || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 border border-slate-200">
              <p>
                <span className="text-slate-500">Item Code:</span>{' '}
                <strong className="font-mono text-slate-800">{adjustModalProduct.productId}</strong>
              </p>
              <p>
                <span className="text-slate-500">Current Stock:</span>{' '}
                <strong className="text-slate-800">{formatQuantity(adjustModalProduct.stockQuantity, adjustModalProduct.unit)}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transaction Type
              </label>
              <select
                value={adjustType}
                onChange={(e: any) => setAdjustType(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9] transition-all"
              >
                <option value="STOCK_RECEIVED">Stock Received (Add incoming shipment)</option>
                <option value="ADJUSTMENT">Stock Adjustment (Damaged / Missing / Audit Correction)</option>
              </select>
            </div>

            {adjustType === 'ADJUSTMENT' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adjustment Direction
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustDirection('DEDUCT')}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                      adjustDirection === 'DEDUCT'
                        ? 'bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Deduct (Damage/Loss)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustDirection('ADD')}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                      adjustDirection === 'ADD'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Add (Audit/Found)
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notes / Supplier Invoice Reference
              </label>
              <input
                type="text"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="e.g. Supplier PO #8890"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9] transition-all"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setAdjustModalProduct(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#3563e9] to-[#7656e8] hover:opacity-95 rounded-xl shadow-md shadow-[#3563e9]/20 transition-all disabled:opacity-50"
              >
                {submitting ? 'Applying...' : 'Apply Adjustment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Stock Filter Modal (Phase 2.2 requirement) */}
      <Modal
        isOpen={showStockFilterModal}
        onClose={() => setShowStockFilterModal(false)}
        title="Filter Inventory Stock"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Filter current inventory levels by brand and stock threshold.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Brand Filter */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Company / Brand</label>
              <select
                value={draftStockBrand}
                onChange={(e) => setDraftStockBrand(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9] font-medium text-slate-800"
              >
                <option value="all">All Brands</option>
                {availableBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Stock Status Filter */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Stock Status</label>
              <select
                value={draftStockStatus}
                onChange={(e) =>
                  setDraftStockStatus(e.target.value as 'all' | 'inStock' | 'lowStock' | 'outOfStock')
                }
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9] font-medium text-slate-800"
              >
                <option value="all">All Stock Levels</option>
                <option value="inStock">In Stock (&gt; Low Stock Limit)</option>
                <option value="lowStock">Low Stock (≤ Limit &gt; 0)</option>
                <option value="outOfStock">Out of Stock (≤ 0 units)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setDraftStockBrand('all');
                setDraftStockStatus('all');
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              Reset Dialog
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowStockFilterModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setStockBrand(draftStockBrand);
                  setStockStatus(draftStockStatus);
                  setShowStockFilterModal(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#3563e9] to-[#7656e8] hover:opacity-95 rounded-xl shadow-sm shadow-blue-500/25 transition-all"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
