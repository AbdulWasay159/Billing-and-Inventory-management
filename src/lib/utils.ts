// src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { InvoiceItem } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return '₹0.00';
  const val = Number(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export function formatQuantity(qty: number | string | null | undefined, unit?: string): string {
  if (qty === null || qty === undefined || isNaN(Number(qty))) return '0';
  const val = Number(qty);
  // Show clean integer if whole, or up to 3 decimals
  const formatted = Number.isInteger(val) ? val.toString() : val.toFixed(2);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function calculatePurchasePrice(mrp: number, discountPercent: number): number {
  if (mrp <= 0) return 0;
  const disc = Math.max(0, Math.min(100, discountPercent));
  const cost = mrp - (mrp * disc) / 100;
  return Math.round(cost * 100) / 100;
}

export function calculateProfitMargin(purchasePrice: number, sellingPrice: number): {
  profitAmount: number;
  profitMarginPercent: number;
} {
  const profitAmount = Math.round((sellingPrice - purchasePrice) * 100) / 100;
  const profitMarginPercent =
    purchasePrice > 0 ? Math.round((profitAmount / purchasePrice) * 10000) / 100 : 0;
  return { profitAmount, profitMarginPercent };
}

/**
 * A4 INVOICE PAGINATION CHUNKER (CRITICAL REQUIREMENT - SECTION 15)
 * Exactly 20 item rows per A4 printed page.
 * Items 1-20 -> Page 1
 * Items 21-40 -> Page 2
 * Items 41-60 -> Page 3
 * Up to 200 items -> 10 Pages
 */
export interface InvoicePageChunk {
  pageNumber: number;
  totalPages: number;
  items: InvoiceItem[];
  startIndex: number;
  endIndex: number;
  pageSubtotal: number;
  isFirstPage: boolean;
  isLastPage: boolean;
}

export function paginateInvoiceItems(
  items: InvoiceItem[],
  maxRowsPerPage: number = 20
): InvoicePageChunk[] {
  if (!items || items.length === 0) {
    return [
      {
        pageNumber: 1,
        totalPages: 1,
        items: [],
        startIndex: 0,
        endIndex: 0,
        pageSubtotal: 0,
        isFirstPage: true,
        isLastPage: true,
      },
    ];
  }

  const totalPages = Math.ceil(items.length / maxRowsPerPage);
  const chunks: InvoicePageChunk[] = [];

  for (let p = 0; p < totalPages; p++) {
    const startIndex = p * maxRowsPerPage;
    const pageItems = items.slice(startIndex, startIndex + maxRowsPerPage);
    const pageSubtotal = pageItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);

    chunks.push({
      pageNumber: p + 1,
      totalPages,
      items: pageItems,
      startIndex,
      endIndex: startIndex + pageItems.length,
      pageSubtotal: Math.round(pageSubtotal * 100) / 100,
      isFirstPage: p === 0,
      isLastPage: p === totalPages - 1,
    });
  }

  return chunks;
}
