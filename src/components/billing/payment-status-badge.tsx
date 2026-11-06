// src/components/billing/payment-status-badge.tsx
import React from 'react';
import { PaymentStatus } from '@/types';

const STYLES: Record<PaymentStatus, { label: string; className: string }> = {
  PAID: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PARTIAL: { label: 'Partial', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  UNPAID: { label: 'Unpaid', className: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export function PaymentStatusBadge({ status }: { status?: PaymentStatus }) {
  const style = STYLES[status ?? 'PAID'] ?? STYLES.PAID;
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${style.className}`}>
      {style.label}
    </span>
  );
}
