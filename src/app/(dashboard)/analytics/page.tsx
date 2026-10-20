// src/app/(dashboard)/analytics/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Calendar,
  FileSpreadsheet,
  Printer,
  Receipt,
  Download,
  Package,
} from 'lucide-react';
import { formatCurrency, formatQuantity } from '@/lib/utils';
import { MonthlyBillingSummary } from '@/types';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'monthly' | 'products'>('monthly');

  // Monthly Summary State
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyBillingSummary | null>(null);
  const [loadingMonthly, setLoadingMonthly] = useState(true);

  // Product-wise Sales State
  const [productSales, setProductSales] = useState<
    {
      productId: string;
      productCode: string;
      name: string;
      size: string;
      unit: string;
      totalQuantitySold: number;
      totalRevenue: number;
    }[]
  >([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const fetchMonthlySummary = async () => {
    setLoadingMonthly(true);
    try {
      const res = await fetch(`/api/analytics/monthly?year=${selectedYear}&month=${selectedMonth}`);
      if (res.ok) {
        const data = await res.json();
        setMonthlySummary(data);
      }
    } catch (err) {
      console.error('Failed to load monthly summary:', err);
    } finally {
      setLoadingMonthly(false);
    }
  };

  const fetchProductSales = async () => {
    setLoadingProducts(true);
    try {
      const res = await fetch('/api/analytics/products');
      if (res.ok) {
        const data = await res.json();
        setProductSales(data || []);
      }
    } catch (err) {
      console.error('Failed to load product sales:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'monthly') {
      fetchMonthlySummary();
    } else {
      fetchProductSales();
    }
  }, [activeTab, selectedYear, selectedMonth]);

  const handlePrintMonthlySummary = () => {
    window.print();
  };

  const handleExportMonthlyCsv = () => {
    if (!monthlySummary) return;
    const sanitizeCsv = (val: string) => {
      const trimmed = String(val).trim();
      return /^[=+\-@\t\r]/.test(trimmed) ? `'${trimmed}` : trimmed;
    };
    const header = 'Invoice Number,Date,Total Amount,Payment Mode\n';
    const rows = monthlySummary.invoices
      .map(
        (i) =>
          `"${sanitizeCsv(i.invoiceNumber)}","${new Date(i.billDate).toLocaleDateString('en-IN')}",${i.finalTotal},"${sanitizeCsv(i.paymentMode)}"`
      )
      .join('\n');
    const footer = `\n"Total Invoices",${monthlySummary.totalInvoices},"Total Sales",${monthlySummary.totalSales}`;
    const blob = new Blob([header + rows + footer], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Billing-Summary-${monthlySummary.month.replace(/\s+/g, '-')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Sales & Billing Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Periodic sales performance and monthly billing summaries (No profit analytics)
          </p>
        </div>

        {/* Tab switch */}
        <div className="inline-flex rounded-xl bg-slate-200/70 p-1 text-xs font-semibold self-start sm:self-auto shadow-inner">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              activeTab === 'monthly'
                ? 'bg-gradient-to-r from-[#3563e9] to-[#7656e8] text-white shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly Billing Summary
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-1.5 rounded-lg transition-all ${
              activeTab === 'products'
                ? 'bg-gradient-to-r from-[#3563e9] to-[#7656e8] text-white shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Product-Wise Sales
          </button>
        </div>
      </div>

      {activeTab === 'monthly' ? (
        <div className="space-y-4">
          {/* Controls bar (Hidden during print) */}
          <div className="card-3d bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-slate-600">
                Select Month:
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9]"
              >
                {[
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December',
                ].map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#3563e9]/20 focus:border-[#3563e9]"
              >
                {Array.from({ length: 6 }, (_, idx) => new Date().getFullYear() - 3 + idx).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportMonthlyCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handlePrintMonthlySummary}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-[#3563e9] to-[#7656e8] hover:opacity-95 rounded-xl shadow-md shadow-[#3563e9]/20 transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Summary</span>
              </button>
            </div>
          </div>

          {/* Printable Monthly Summary Sheet (Section 18 & 36) */}
          <div className="card-3d bg-white text-slate-900 border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden p-6 sm:p-8 print:border-none print:shadow-none print:p-0">
            <div className="border-b border-slate-200 pb-4 mb-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-tight text-slate-900">
                  Monthly Billing Summary
                </h2>
                <p className="text-sm font-semibold text-[#3563e9] mt-1">
                  {monthlySummary?.month || 'Loading...'}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-slate-500">Generated on</p>
                <p className="text-xs font-medium text-slate-700">{new Date().toLocaleDateString('en-IN')}</p>
              </div>
            </div>

            {loadingMonthly ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Compiling monthly billing records...
              </div>
            ) : !monthlySummary || monthlySummary.invoices.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No invoices found for {monthlySummary?.month || 'the selected month'}.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-300 text-slate-700 bg-slate-50">
                        <th className="py-2.5 px-4 font-bold text-center w-12 uppercase tracking-wider text-[11px]">#</th>
                        <th className="py-2.5 px-4 font-bold uppercase tracking-wider text-[11px]">Invoice Number</th>
                        <th className="py-2.5 px-4 font-bold uppercase tracking-wider text-[11px]">Date</th>
                        <th className="py-2.5 px-4 font-bold text-center uppercase tracking-wider text-[11px]">Payment Mode</th>
                        <th className="py-2.5 px-4 font-bold text-right uppercase tracking-wider text-[11px]">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {monthlySummary.invoices.map((inv, idx) => (
                        <tr key={inv.invoiceNumber} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-4 text-center text-slate-400 font-sans">{idx + 1}</td>
                          <td className="py-2.5 px-4 font-bold text-[#3563e9]">
                            <Link href={`/invoices/${inv.id || inv.invoiceNumber}`} className="hover:underline">
                              {inv.invoiceNumber}
                            </Link>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 font-sans">
                            {new Date(inv.billDate).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-2.5 px-4 text-center font-sans">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                              {inv.paymentMode}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                            {formatCurrency(inv.finalTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer Totals (Section 18 requirement) */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div>
                    <span className="text-xs text-slate-500 font-medium">Total Invoices Billed:</span>
                    <strong className="ml-2 font-mono text-base text-slate-900">
                      {monthlySummary.totalInvoices}
                    </strong>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold uppercase text-slate-700">Total Month Sales:</span>
                    <span className="font-mono text-2xl font-bold text-[#3563e9]">
                      {formatCurrency(monthlySummary.totalSales)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Product-Wise Sales Quantity Table (Section 19 & 20) */
        <div className="card-3d bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
            <h2 className="font-bold text-base text-slate-900">
              Product-Wise Quantity Sold (All-Time)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated directly from invoice records with drill-down links to original bills
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 select-none">
                <tr>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-[11px]">Item Code</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Product Name</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Size</th>
                  <th className="py-3 px-4 font-semibold text-right uppercase tracking-wider text-[11px]">Units Sold</th>
                  <th className="py-3 px-4 font-semibold text-right uppercase tracking-wider text-[11px]">Total Revenue</th>
                  <th className="py-3 px-4 font-semibold text-center uppercase tracking-wider text-[11px]">Sales History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {loadingProducts ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                      Loading product sales...
                    </td>
                  </tr>
                ) : productSales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                      No sales recorded for any products yet.
                    </td>
                  </tr>
                ) : (
                  productSales.map((ps) => (
                    <tr key={ps.productId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#3563e9]">
                        {ps.productCode}
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-slate-900">
                        {ps.name}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {ps.size || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                        {formatQuantity(ps.totalQuantitySold, ps.unit)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(ps.totalRevenue)}
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        <Link
                          href={`/products/${ps.productId}`}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#3563e9]/10 text-[#3563e9] border border-[#3563e9]/20 hover:bg-[#3563e9]/15 transition-colors"
                        >
                          View Invoices
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
