// src/app/(dashboard)/analytics/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Receipt,
  Download,
  Printer,
  Calendar,
  Layers,
  ShoppingBag,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Percent,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { formatCurrency, formatQuantity } from '@/lib/utils';

type PeriodPreset =
  | 'today'
  | 'yesterday'
  | '7days'
  | '30days'
  | 'thisWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'lastYear'
  | 'specific'
  | 'custom';

interface ComprehensiveData {
  period: { startDate: string; endDate: string };
  kpis: {
    totalSales: number;
    completedInvoices: number;
    averageInvoiceValue: number;
    unitsSold: number;
    totalDiscounts: number;
    totalRefunds: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    grossProfitMarginPercent: number;
    hasHistoricalCostAccuracy: boolean;
  };
  paymentSplit: {
    cashSales: number;
    cashInvoicesCount: number;
    upiSales: number;
    upiInvoicesCount: number;
  };
  brands: {
    brandName: string;
    distinctProductsCount: number;
    unitsSold: number;
    grossRevenue: number;
    cogs: number;
    grossProfit: number;
    grossProfitMarginPercent: number;
    products: {
      productId: string;
      productCode: string;
      name: string;
      size: string;
      unit: string;
      unitsSold: number;
      revenue: number;
      cogs: number;
      grossProfit: number;
      marginPercent: number;
    }[];
  }[];
  products: {
    bestSellers: {
      productId: string;
      productCode: string;
      name: string;
      brand: string;
      size: string;
      unit: string;
      unitsSold: number;
      revenue: number;
      cogs: number;
      grossProfit: number;
      marginPercent: number;
      currentStock: number;
      lowStockLimit: number;
      stockStatus: 'inStock' | 'lowStock' | 'outOfStock';
    }[];
    slowMovers: {
      productId: string;
      productCode: string;
      name: string;
      brand: string;
      size: string;
      unit: string;
      unitsSold: number;
      revenue: number;
      cogs: number;
      grossProfit: number;
      marginPercent: number;
      currentStock: number;
      lowStockLimit: number;
      stockStatus: 'inStock' | 'lowStock' | 'outOfStock';
    }[];
  };
  invoices: {
    id: string;
    invoiceNumber: string;
    billDate: string;
    customerName?: string;
    paymentMode: string;
    subtotal: number;
    discountAmount: number;
    finalTotal: number;
    status: string;
    itemCount: number;
  }[];
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'brands' | 'products' | 'invoices'>('overview');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('thisMonth');

  // Custom and Single Date States
  const todayStr = new Date().toISOString().split('T')[0];
  const [singleDate, setSingleDate] = useState(todayStr);
  const [customStartDate, setCustomStartDate] = useState(todayStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  const [data, setData] = useState<ComprehensiveData | null>(null);
  const [loading, setLoading] = useState(true);

  // Brand table sorting & expansion
  const [brandSortField, setBrandSortField] = useState<'grossRevenue' | 'unitsSold' | 'grossProfit'>('grossRevenue');
  const [brandSortAsc, setBrandSortAsc] = useState(false);
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

  // Calculate ISO range for selected period
  const calculateRange = (preset: PeriodPreset): { startDate?: string; endDate?: string; label: string } => {
    const now = new Date();
    if (preset === 'today') {
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const e = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { startDate: s.toISOString(), endDate: e.toISOString(), label: 'Today' };
    }
    if (preset === 'yesterday') {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const s = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0);
      const e = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
      return { startDate: s.toISOString(), endDate: e.toISOString(), label: 'Yesterday' };
    }
    if (preset === '7days') {
      const s = new Date(now.getTime() - 7 * 86400000);
      s.setHours(0, 0, 0, 0);
      return { startDate: s.toISOString(), endDate: now.toISOString(), label: 'Last 7 Days' };
    }
    if (preset === '30days') {
      const s = new Date(now.getTime() - 30 * 86400000);
      s.setHours(0, 0, 0, 0);
      return { startDate: s.toISOString(), endDate: now.toISOString(), label: 'Last 30 Days' };
    }
    if (preset === 'thisWeek') {
      const current = new Date();
      const day = current.getDay();
      const diff = current.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(current.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      return { startDate: monday.toISOString(), endDate: new Date().toISOString(), label: 'This Week' };
    }
    if (preset === 'thisMonth') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      return { startDate: s.toISOString(), endDate: now.toISOString(), label: 'This Month' };
    }
    if (preset === 'lastMonth') {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { startDate: s.toISOString(), endDate: e.toISOString(), label: 'Last Month' };
    }
    if (preset === 'thisYear') {
      const s = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      return { startDate: s.toISOString(), endDate: now.toISOString(), label: 'This Year' };
    }
    if (preset === 'lastYear') {
      const s = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0);
      const e = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      return { startDate: s.toISOString(), endDate: e.toISOString(), label: 'Last Year' };
    }
    if (preset === 'specific' && singleDate) {
      const [y, m, d] = singleDate.split('-').map(Number);
      const s = new Date(y, m - 1, d, 0, 0, 0);
      const e = new Date(y, m - 1, d, 23, 59, 59, 999);
      return { startDate: s.toISOString(), endDate: e.toISOString(), label: singleDate };
    }
    if (preset === 'custom' && customStartDate && customEndDate) {
      const [sy, sm, sd] = customStartDate.split('-').map(Number);
      const [ey, em, ed] = customEndDate.split('-').map(Number);
      const s = new Date(sy, sm - 1, sd, 0, 0, 0);
      const e = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      return { startDate: s.toISOString(), endDate: e.toISOString(), label: `${customStartDate} to ${customEndDate}` };
    }

    const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    return { startDate: s.toISOString(), endDate: now.toISOString(), label: 'This Month' };
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = calculateRange(periodPreset);
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/analytics/comprehensive?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load comprehensive analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [periodPreset, singleDate, customStartDate, customEndDate]);

  const toggleBrandExpansion = (brandName: string) => {
    const next = new Set(expandedBrands);
    if (next.has(brandName)) next.delete(brandName);
    else next.add(brandName);
    setExpandedBrands(next);
  };

  const handlePrintSummary = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!data) return;
    const sanitize = (val: any) => {
      const s = String(val ?? '').trim();
      return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    };

    let csv = `TRADESTOCK PRO — SHOP FINANCIAL & GROSS PROFIT REPORT\n`;
    csv += `Period,${calculateRange(periodPreset).label}\n`;
    csv += `Generated At,${new Date().toLocaleString('en-IN')}\n\n`;

    csv += `EXECUTIVE KPIS\n`;
    csv += `Total Sales (Gross Revenue),₹${data.kpis.totalSales.toFixed(2)}\n`;
    csv += `Completed Invoices,${data.kpis.completedInvoices}\n`;
    csv += `Average Invoice Value,₹${data.kpis.averageInvoiceValue.toFixed(2)}\n`;
    csv += `Total Units Sold,${data.kpis.unitsSold}\n`;
    csv += `Total Discounts,₹${data.kpis.totalDiscounts.toFixed(2)}\n`;
    csv += `Total Refunds / Returns,₹${data.kpis.totalRefunds.toFixed(2)}\n`;
    csv += `Net Sales,₹${data.kpis.netSales.toFixed(2)}\n`;
    csv += `Cost of Goods Sold (COGS),₹${data.kpis.cogs.toFixed(2)}\n`;
    csv += `Gross Profit (Net Sales - COGS),₹${data.kpis.grossProfit.toFixed(2)}\n`;
    csv += `Gross Profit Margin %,${data.kpis.grossProfitMarginPercent.toFixed(2)}%\n\n`;

    csv += `BRAND PERFORMANCE BREAKDOWN\n`;
    csv += `Brand Name,Products Sold,Units Sold,Gross Revenue,COGS,Gross Profit,Margin %\n`;
    data.brands.forEach((b) => {
      csv += `"${sanitize(b.brandName)}",${b.distinctProductsCount},${b.unitsSold},₹${b.grossRevenue.toFixed(2)},₹${b.cogs.toFixed(2)},₹${b.grossProfit.toFixed(2)},${b.grossProfitMarginPercent.toFixed(2)}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TradeStock_Analytics_${periodPreset}_${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sort brands dynamically
  const sortedBrands = (data?.brands ? [...data.brands] : []).sort((a, b) => {
    const valA = a[brandSortField];
    const valB = b[brandSortField];
    return brandSortAsc ? valA - valB : valB - valA;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Sales &amp; Profit Analytics</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              Live COGS Engine
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time gross profit margins, brand performance, product velocity, and custom financial reporting
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportCsv}
            disabled={loading || !data}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-[#3563e9]" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrintSummary}
            disabled={loading || !data}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-[#3563e9] to-[#7656e8] text-white shadow-sm shadow-blue-500/25 hover:opacity-95 transition-all disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Date & Period Selection Bar (Phase 4.1 requirement) */}
      <div className="card-3d bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-[#3563e9]" />
            <span>Reporting Period:</span>
            <span className="text-[#3563e9] font-bold ml-1">
              {calculateRange(periodPreset).label}
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '7days', label: '7D' },
                { id: '30days', label: '30D' },
                { id: 'thisWeek', label: 'This Week' },
                { id: 'thisMonth', label: 'This Month' },
                { id: 'lastMonth', label: 'Last Month' },
                { id: 'thisYear', label: 'This Year' },
                { id: 'lastYear', label: 'Last Year' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodPreset(p.id)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                  periodPreset === p.id
                    ? 'bg-[#3563e9] text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Specific Date & Custom Date Range Selectors */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {/* Specific Single Day */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPeriodPreset('specific')}
              className={`px-2.5 py-1 rounded-lg font-semibold border transition-all ${
                periodPreset === 'specific'
                  ? 'bg-violet-50 text-violet-700 border-violet-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Specific Date:
            </button>
            <input
              type="date"
              value={singleDate}
              onChange={(e) => {
                setSingleDate(e.target.value);
                setPeriodPreset('specific');
              }}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9]"
            />
          </div>

          {/* Custom Date Range */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPeriodPreset('custom')}
              className={`px-2.5 py-1 rounded-lg font-semibold border transition-all ${
                periodPreset === 'custom'
                  ? 'bg-violet-50 text-violet-700 border-violet-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Custom Range:
            </button>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setPeriodPreset('custom');
                }}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9]"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setPeriodPreset('custom');
                }}
                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid (Phases 4.2 & 4.3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Gross Sales */}
        <div className="card-3d bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Sales</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight font-mono">
              {loading ? '—' : formatCurrency(data?.kpis.totalSales)}
            </h3>
            <p className="text-xs text-slate-400 mt-1.5">
              {data?.kpis.completedInvoices || 0} invoices billed
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-blue-50 text-[#3563e9] border border-blue-200/60 shadow-2xs">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2: Net Sales */}
        <div className="card-3d bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Sales</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight font-mono">
              {loading ? '—' : formatCurrency(data?.kpis.netSales)}
            </h3>
            <p className="text-xs text-emerald-600 mt-1.5 font-medium">
              After ₹{(data?.kpis.totalRefunds || 0).toFixed(2)} refunds
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200/60 shadow-2xs">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3: Cost of Goods Sold (COGS) */}
        <div className="card-3d bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost of Goods (COGS)</p>
            <h3 className="text-2xl font-bold text-slate-700 mt-1 tracking-tight font-mono">
              {loading ? '—' : formatCurrency(data?.kpis.cogs)}
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">
              {data?.kpis.unitsSold || 0} units sold
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4: Gross Profit & Margin % */}
        <div className="card-3d bg-white border border-violet-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between bg-violet-50/20">
          <div>
            <div className="flex items-center gap-1 text-xs font-semibold text-violet-700 uppercase tracking-wider">
              <span>Gross Profit</span>
              <span className="text-[10px] font-bold bg-violet-100 text-violet-800 px-1.5 py-0.2 rounded-full">
                {data?.kpis.grossProfitMarginPercent || 0}% Margin
              </span>
            </div>
            <h3 className="text-2xl font-bold text-violet-950 mt-1 tracking-tight font-mono">
              {loading ? '—' : formatCurrency(data?.kpis.grossProfit)}
            </h3>
            <p className="text-xs text-violet-700 mt-1.5 font-medium">
              Net Sales − Cost of Goods Sold
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-violet-100 text-violet-700 border border-violet-200 shadow-2xs">
            <Percent className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 print:hidden">
        <div className="inline-flex rounded-xl bg-slate-200/70 p-1 text-xs font-semibold shadow-inner">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'overview'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Overview &amp; Split
          </button>
          <button
            onClick={() => setActiveTab('brands')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'brands'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Brand Performance ({data?.brands.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'products'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Product Velocity
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'invoices'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Invoice History ({data?.invoices.length || 0})
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & PAYMENT SPLIT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Payment Split Cards (Phase 4.6 - Cash vs UPI) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-3d bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Cash Collections</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {data?.paymentSplit.cashInvoicesCount || 0} Bills
                </span>
              </div>
              <h4 className="text-xl font-bold text-slate-900 font-mono">
                {formatCurrency(data?.paymentSplit.cashSales)}
              </h4>
              <p className="text-xs text-slate-400 mt-1">Physical counter cash received</p>
            </div>

            <div className="card-3d bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700">UPI / QR Digital</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {data?.paymentSplit.upiInvoicesCount || 0} Bills
                </span>
              </div>
              <h4 className="text-xl font-bold text-slate-900 font-mono">
                {formatCurrency(data?.paymentSplit.upiSales)}
              </h4>
              <p className="text-xs text-slate-400 mt-1">Direct bank settlements via UPI</p>
            </div>
          </div>

          {/* Quick Snapshot Table of Brands */}
          <div className="card-3d bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#3563e9]" />
                <span>Top Brand Contributions in Selected Period</span>
              </h3>
              <button
                onClick={() => setActiveTab('brands')}
                className="text-xs font-semibold text-[#3563e9] hover:underline flex items-center gap-1"
              >
                <span>View Full Brand Report</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-bold uppercase text-[11px]">Brand Name</th>
                    <th className="py-2.5 px-3 text-right font-semibold uppercase text-[11px]">Units Sold</th>
                    <th className="py-2.5 px-3 text-right font-semibold uppercase text-[11px]">Revenue</th>
                    <th className="py-2.5 px-3 text-right font-semibold uppercase text-[11px]">COGS</th>
                    <th className="py-2.5 px-3 text-right font-bold uppercase text-[11px] text-violet-700">Gross Profit</th>
                    <th className="py-2.5 px-3 text-right font-bold uppercase text-[11px]">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {data?.brands.slice(0, 5).map((b) => (
                    <tr key={b.brandName} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-sans font-bold text-slate-900">{b.brandName}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{b.unitsSold}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">₹{b.grossRevenue.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">₹{b.cogs.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-violet-700">₹{b.grossProfit.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{b.grossProfitMarginPercent}%</td>
                    </tr>
                  ))}
                  {(!data?.brands || data.brands.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                        No sales recorded for any brand during this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BRAND-WISE PERFORMANCE REPORT (Phase 4.4) */}
      {activeTab === 'brands' && (
        <div className="card-3d bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden space-y-4">
          <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#3563e9]" />
                <span>Brand-Wise Financial Breakdown</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed profitability by company/brand based on historical purchase cost snapshots. Click brand to view product-level breakdown.
              </p>
            </div>

            {/* Sorting controls */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">Sort by:</span>
              <button
                onClick={() => {
                  if (brandSortField === 'grossRevenue') setBrandSortAsc(!brandSortAsc);
                  else {
                    setBrandSortField('grossRevenue');
                    setBrandSortAsc(false);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg border font-medium ${
                  brandSortField === 'grossRevenue' ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold' : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                Revenue {brandSortField === 'grossRevenue' ? (brandSortAsc ? '↑' : '↓') : ''}
              </button>
              <button
                onClick={() => {
                  if (brandSortField === 'unitsSold') setBrandSortAsc(!brandSortAsc);
                  else {
                    setBrandSortField('unitsSold');
                    setBrandSortAsc(false);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg border font-medium ${
                  brandSortField === 'unitsSold' ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold' : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                Units Sold {brandSortField === 'unitsSold' ? (brandSortAsc ? '↑' : '↓') : ''}
              </button>
              <button
                onClick={() => {
                  if (brandSortField === 'grossProfit') setBrandSortAsc(!brandSortAsc);
                  else {
                    setBrandSortField('grossProfit');
                    setBrandSortAsc(false);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg border font-medium ${
                  brandSortField === 'grossProfit' ? 'bg-violet-50 border-violet-300 text-violet-700 font-bold' : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                Gross Profit {brandSortField === 'grossProfit' ? (brandSortAsc ? '↑' : '↓') : ''}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-[11px]">Brand Name</th>
                  <th className="py-3 px-4 font-semibold text-center uppercase tracking-wider text-[11px]">Catalog Products</th>
                  <th className="py-3 px-4 font-semibold text-right uppercase tracking-wider text-[11px]">Units Sold</th>
                  <th className="py-3 px-4 font-semibold text-right uppercase tracking-wider text-[11px]">Sales Revenue</th>
                  <th className="py-3 px-4 font-semibold text-right uppercase tracking-wider text-[11px]">COGS</th>
                  <th className="py-3 px-4 font-bold text-right text-violet-700 uppercase tracking-wider text-[11px]">Gross Profit</th>
                  <th className="py-3 px-4 font-bold text-right uppercase tracking-wider text-[11px]">Gross Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {sortedBrands.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                      No brand sales recorded for this period.
                    </td>
                  </tr>
                ) : (
                  sortedBrands.map((b) => {
                    const isExpanded = expandedBrands.has(b.brandName);
                    return (
                      <React.Fragment key={b.brandName}>
                        <tr
                          onClick={() => toggleBrandExpansion(b.brandName)}
                          className="hover:bg-blue-50/30 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4 font-sans font-bold text-slate-900 flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-[#3563e9]" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <span>{b.brandName}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-sans text-slate-600">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                              {b.distinctProductsCount} item{b.distinctProductsCount === 1 ? '' : 's'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-800">
                            {b.unitsSold}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            ₹{b.grossRevenue.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500">
                            ₹{b.cogs.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-violet-700">
                            ₹{b.grossProfit.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-700">
                            {b.grossProfitMarginPercent}%
                          </td>
                        </tr>

                        {/* Expandable nested product-level breakdown */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 font-sans">
                            <td colSpan={7} className="p-4">
                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                                <div className="p-3 bg-slate-100/70 border-b border-slate-200 text-xs font-bold text-slate-700">
                                  Product Breakdown for {b.brandName} ({b.products.length} sold items)
                                </div>
                                <table className="w-full text-xs font-mono">
                                  <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase border-b border-slate-200">
                                    <tr>
                                      <th className="py-2 px-3 text-left">Code</th>
                                      <th className="py-2 px-3 text-left font-sans">Product Name</th>
                                      <th className="py-2 px-3 text-left">Size</th>
                                      <th className="py-2 px-3 text-right">Units Sold</th>
                                      <th className="py-2 px-3 text-right">Revenue</th>
                                      <th className="py-2 px-3 text-right">COGS</th>
                                      <th className="py-2 px-3 text-right text-violet-700">Gross Profit</th>
                                      <th className="py-2 px-3 text-right">Margin %</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {b.products.map((p) => (
                                      <tr key={p.productId} className="hover:bg-slate-50">
                                        <td className="py-2 px-3 font-bold text-[#3563e9]">{p.productCode}</td>
                                        <td className="py-2 px-3 font-sans font-medium text-slate-900">{p.name}</td>
                                        <td className="py-2 px-3 text-slate-500">{p.size || '—'}</td>
                                        <td className="py-2 px-3 text-right font-semibold">{p.unitsSold} {p.unit}</td>
                                        <td className="py-2 px-3 text-right font-bold text-slate-900">₹{p.revenue.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-right text-slate-500">₹{p.cogs.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-right font-bold text-violet-700">₹{p.grossProfit.toFixed(2)}</td>
                                        <td className="py-2 px-3 text-right font-semibold text-emerald-700">{p.marginPercent}%</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PRODUCT-WISE PERFORMANCE (Phase 4.5) */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* Best-Sellers Card */}
          <div className="card-3d bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50/50">
              <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span>Best-Selling Products (Ranked by Sales Revenue)</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-bold uppercase text-[11px]">Rank</th>
                    <th className="py-3 px-4 font-bold uppercase text-[11px]">Product Code</th>
                    <th className="py-3 px-4 font-semibold uppercase text-[11px]">Product Name</th>
                    <th className="py-3 px-4 font-semibold uppercase text-[11px]">Brand</th>
                    <th className="py-3 px-4 font-semibold text-right uppercase text-[11px]">Units Sold</th>
                    <th className="py-3 px-4 font-semibold text-right uppercase text-[11px]">Revenue</th>
                    <th className="py-3 px-4 font-bold text-right uppercase text-[11px] text-violet-700">Gross Profit</th>
                    <th className="py-3 px-4 font-bold text-right uppercase text-[11px]">Margin %</th>
                    <th className="py-3 px-4 font-semibold text-center uppercase text-[11px]">Stock Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {data?.products.bestSellers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                        No product sales recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    data?.products.bestSellers.map((p, idx) => (
                      <tr key={p.productId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-400 font-sans">#{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-[#3563e9]">
                          <Link href={`/products/${p.productId}`} className="hover:underline">
                            {p.productCode}
                          </Link>
                        </td>
                        <td className="py-3 px-4 font-sans font-medium text-slate-900">{p.name}</td>
                        <td className="py-3 px-4 text-slate-600">{p.brand}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">{p.unitsSold} {p.unit}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">₹{p.revenue.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-bold text-violet-700">₹{p.grossProfit.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">{p.marginPercent}%</td>
                        <td className="py-3 px-4 text-center font-sans">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              p.stockStatus === 'outOfStock'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : p.stockStatus === 'lowStock'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            {p.stockStatus === 'outOfStock' ? 'Out of Stock' : p.stockStatus === 'lowStock' ? 'Low Stock' : 'In Stock'}
                          </span>
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

      {/* TAB 4: INVOICE HISTORY (Phase 4.6) */}
      {activeTab === 'invoices' && (
        <div className="card-3d bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#3563e9]" />
              <span>Invoices Billed in Selected Period</span>
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              {data?.invoices.length || 0} completed invoices
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold uppercase text-[11px]">Invoice #</th>
                  <th className="py-3 px-4 font-semibold uppercase text-[11px]">Date &amp; Time</th>
                  <th className="py-3 px-4 font-semibold uppercase text-[11px]">Customer</th>
                  <th className="py-3 px-4 font-semibold text-center uppercase text-[11px]">Payment</th>
                  <th className="py-3 px-4 font-semibold text-center uppercase text-[11px]">Items</th>
                  <th className="py-3 px-4 font-semibold text-right uppercase text-[11px]">Discount</th>
                  <th className="py-3 px-4 font-bold text-right uppercase text-[11px]">Final Total</th>
                  <th className="py-3 px-4 font-semibold text-center uppercase text-[11px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {data?.invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                      No invoices found for the selected period.
                    </td>
                  </tr>
                ) : (
                  data?.invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#3563e9]">
                        <Link href={`/invoices/${inv.id}`} className="hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(inv.billDate).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-700">
                        {inv.customerName || 'Walk-in Customer'}
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            inv.paymentMode === 'CASH'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : inv.paymentMode === 'UPI'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-violet-50 text-violet-700 border-violet-200'
                          }`}
                        >
                          {inv.paymentMode}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600">
                        {inv.itemCount}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        ₹{inv.discountAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                        ₹{inv.finalTotal.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#3563e9]/10 text-[#3563e9] hover:bg-[#3563e9]/15 transition-colors"
                        >
                          View Bill
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
