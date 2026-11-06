// src/app/(dashboard)/billing/history/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Eye, Download, Plus, Wallet, IndianRupee } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Invoice } from '@/types';
import { PaymentStatusBadge } from '@/components/billing/payment-status-badge';
import { RecordPaymentModal } from '@/components/billing/record-payment-modal';

type BalanceFilter = 'all' | 'DUE' | 'PAID';

export default function InvoiceHistoryPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all');
  const [outstanding, setOutstanding] = useState<{ totalOutstanding: number; invoiceCount: number } | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('customer', search);
      if (startDate) params.set('startDate', new Date(startDate).toISOString());
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59);
        params.set('endDate', e.toISOString());
      }
      if (balanceFilter !== 'all') params.set('balance', balanceFilter);
      params.set('limit', '100');

      const res = await fetch(`/api/billing?${params.toString()}`);
      const data = await res.json();
      setInvoices(data.invoices || []);
      if (data.outstanding) setOutstanding(data.outstanding);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [startDate, endDate, balanceFilter]);

  const handlePaymentSaved = (updated: Invoice) => {
    setPayingInvoice(null);
    setInvoices((prev) =>
      balanceFilter === 'DUE' && updated.balanceDue <= 0
        ? prev.filter((i) => i.id !== updated.id)
        : prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i))
    );
    fetchInvoices();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInvoices();
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Invoice History
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Complete database audit of all past bills, customer records, and payment modes
          </p>
        </div>

        <Link
          href="/billing"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/25 self-start sm:self-auto transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create New Bill</span>
        </Link>
      </div>

      {/* Outstanding balance summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setBalanceFilter(balanceFilter === 'DUE' ? 'all' : 'DUE')}
          className={`card-3d text-left bg-white border p-4 rounded-2xl shadow-sm flex items-center gap-3 transition-colors ${
            balanceFilter === 'DUE' ? 'border-rose-300 ring-2 ring-rose-500/15' : 'border-slate-200/80 hover:border-rose-200'
          }`}
        >
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Total balance to collect</p>
            <p className="text-lg font-bold font-mono text-rose-700">{formatCurrency(outstanding?.totalOutstanding ?? 0)}</p>
            <p className="text-[11px] text-slate-500">
              {outstanding?.invoiceCount ?? 0} bill{(outstanding?.invoiceCount ?? 0) === 1 ? '' : 's'} with balance ·{' '}
              <span className="font-semibold text-rose-600">{balanceFilter === 'DUE' ? 'Show all' : 'Show only these'}</span>
            </p>
          </div>
        </button>

        <div className="card-3d bg-white border border-slate-200/80 p-2 rounded-2xl shadow-sm flex items-center gap-1.5">
          {(
            [
              { key: 'all', label: 'All bills' },
              { key: 'DUE', label: 'Balance due' },
              { key: 'PAID', label: 'Fully paid' },
            ] as { key: BalanceFilter; label: string }[]
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setBalanceFilter(opt.key)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                balanceFilter === opt.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Date Range Bar */}
      <div className="card-3d bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Invoice Number, Customer Name, or Phone..."
            className="w-full pl-10 pr-24 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-xs font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-xs font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Invoice List Table */}
      <div className="card-3d bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 select-none">
              <tr>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-[11px]">Invoice No</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Date</th>
                <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[11px]">Customer</th>
                <th className="py-3 px-4 font-semibold text-center uppercase tracking-wider text-[11px]">Payment</th>
                <th className="py-3 px-4 font-semibold text-right uppercase tracking-wider text-[11px]">Items</th>
                <th className="py-3 px-4 font-bold text-right uppercase tracking-wider text-[11px]">Amount</th>
                <th className="py-3 px-4 font-semibold text-right uppercase tracking-wider text-[11px]">Paid</th>
                <th className="py-3 px-4 font-bold text-right uppercase tracking-wider text-[11px]">Balance</th>
                <th className="py-3 px-4 font-semibold text-center uppercase tracking-wider text-[11px]">Status</th>
                <th className="py-3 px-4 font-semibold text-center uppercase tracking-wider text-[11px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No invoices found matching criteria.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">
                      <Link href={`/invoices/${inv.id}`} className="hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(inv.billDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {inv.customerName || 'Walk-in Customer'}
                      {inv.customerPhone && (
                        <span className="block text-[11px] text-slate-400 font-mono">
                          {inv.customerPhone}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${
                          inv.paymentMode === 'UPI'
                            ? 'bg-violet-50 text-violet-700 border-violet-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {inv.paymentMode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {inv.items.length} items
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                      {formatCurrency(inv.finalTotal)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700">
                      {formatCurrency(inv.amountPaid)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        inv.balanceDue > 0 ? 'text-rose-600' : 'text-slate-400'
                      }`}
                    >
                      {formatCurrency(inv.balanceDue)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                      <PaymentStatusBadge status={inv.paymentStatus} />
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          inv.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : inv.status === 'EDITED'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {inv.status}
                      </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {inv.balanceDue > 0 && inv.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => setPayingInvoice(inv)}
                            title="Record payment"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                          >
                            <IndianRupee className="w-3 h-3" />
                            Collect
                          </button>
                        )}
                        <Link
                          href={`/invoices/${inv.id}`}
                          title="View & Print A4 Invoice"
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <a
                          href={`/api/invoices/${inv.id}/pdf`}
                          target="_blank"
                          title="Download PDF"
                          className="p-1.5 text-slate-400 hover:text-violet-600 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RecordPaymentModal
        invoice={payingInvoice}
        onClose={() => setPayingInvoice(null)}
        onSaved={handlePaymentSaved}
      />
    </div>
  );
}
