// src/lib/payments.ts
// Shared balance / partial-payment maths. Used by both the Prisma and local adapters
// and by the services, so every screen computes the balance the same way.
import { InvoiceStatus, PaymentStatus } from '@/types';

export const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/** Bill value after returns. */
export function netInvoiceTotal(finalTotal: number, returnedTotal: number): number {
  return round2(Math.max(0, Number(finalTotal || 0) - Number(returnedTotal || 0)));
}

/** Amount still to be collected. Never negative. */
export function computeBalanceDue(finalTotal: number, returnedTotal: number, amountPaid: number): number {
  return round2(Math.max(0, netInvoiceTotal(finalTotal, returnedTotal) - Number(amountPaid || 0)));
}

export function derivePaymentStatus(
  status: InvoiceStatus | string,
  amountPaid: number,
  balanceDue: number
): PaymentStatus {
  if (status === 'CANCELLED') return 'PAID';
  if (round2(balanceDue) <= 0) return 'PAID';
  if (round2(amountPaid) <= 0) return 'UNPAID';
  return 'PARTIAL';
}

/**
 * Validates the amount received at billing time.
 * Undefined / empty means "paid in full" (keeps older clients working).
 */
export function resolveAmountPaid(raw: unknown, finalTotal: number): number {
  if (raw === undefined || raw === null || raw === '') return round2(finalTotal);
  const value = Number(raw);
  if (isNaN(value) || !isFinite(value) || value < 0) {
    throw new Error('Amount received must be a valid non-negative number.');
  }
  const paid = round2(value);
  if (paid > round2(finalTotal)) {
    throw new Error(
      `Amount received (₹${paid.toFixed(2)}) cannot be more than the bill total (₹${round2(finalTotal).toFixed(2)}).`
    );
  }
  return paid;
}

/** A bill with money still owed must say who owes it. */
export function assertCustomerForBalance(balanceDue: number, customerName?: string, customerPhone?: string): void {
  if (round2(balanceDue) > 0 && (!customerName?.trim() || !customerPhone?.trim())) {
    throw new Error('Customer name and phone are required when a balance is left to be paid.');
  }
}
