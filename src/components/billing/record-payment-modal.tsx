// src/components/billing/record-payment-modal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { formatCurrency } from '@/lib/utils';
import { Invoice, PaymentMode } from '@/types';

interface RecordPaymentModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onSaved: (updated: Invoice) => void;
}

export function RecordPaymentModal({ invoice, onClose, onSaved }: RecordPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (invoice) {
      setAmount(invoice.balanceDue > 0 ? String(invoice.balanceDue) : '');
      setPaymentMode(invoice.paymentMode || 'CASH');
      setNote('');
      setError('');
    }
  }, [invoice]);

  if (!invoice) return null;

  const balance = invoice.balanceDue;
  const value = Number(amount);
  const valid = amount !== '' && !isNaN(value) && value > 0 && value <= balance + 0.0001;
  const remaining = valid ? Math.max(0, Math.round((balance - value) * 100) / 100) : balance;

  const handleSave = async () => {
    if (!valid) {
      setError(`Enter an amount between ₹0.01 and ${formatCurrency(balance)}.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: value, paymentMode, note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not record payment.');
      onSaved(data as Invoice);
    } catch (err: any) {
      setError(err.message || 'Could not record payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={!!invoice}
      onClose={saving ? () => {} : onClose}
      title={`Record Payment · ${invoice.invoiceNumber}`}
      maxWidth="sm"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !valid}
            className="px-4 py-2 text-xs font-semibold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Payment'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Bill</p>
            <p className="font-mono font-bold text-slate-900 text-xs mt-0.5">{formatCurrency(invoice.finalTotal)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2">
            <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Paid</p>
            <p className="font-mono font-bold text-emerald-700 text-xs mt-0.5">{formatCurrency(invoice.amountPaid)}</p>
          </div>
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-2">
            <p className="text-[10px] uppercase tracking-wider text-rose-700 font-semibold">Balance</p>
            <p className="font-mono font-bold text-rose-700 text-xs mt-0.5">{formatCurrency(balance)}</p>
          </div>
        </div>

        {invoice.customerName && (
          <p className="text-xs text-slate-500">
            Customer: <span className="font-semibold text-slate-800">{invoice.customerName}</span>
            {invoice.customerPhone ? ` · ${invoice.customerPhone}` : ''}
          </p>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Amount received (₹)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            max={balance}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-900"
          />
          <div className="flex items-center justify-between mt-1.5">
            <button
              type="button"
              onClick={() => setAmount(String(balance))}
              className="text-[11px] font-semibold text-emerald-700 hover:underline"
            >
              Full balance
            </button>
            <span className="text-[11px] text-slate-500">
              Left after this: <span className="font-mono font-semibold text-slate-800">{formatCurrency(remaining)}</span>
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Payment mode</label>
          <div className="grid grid-cols-2 gap-2">
            {(['CASH', 'UPI'] as PaymentMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPaymentMode(mode)}
                className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  paymentMode === mode
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Note (optional)</label>
          <input
            type="text"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Second instalment"
            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-slate-900"
          />
        </div>

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      </div>
    </Modal>
  );
}
