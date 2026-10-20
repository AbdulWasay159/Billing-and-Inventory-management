// src/lib/excel/exporter.ts
import * as XLSX from 'xlsx';
import { Product } from '@/types';

/**
 * Sanitizes cell values to prevent CSV / Spreadsheet formula injection (CWE-1236).
 * Prepends a single quote if string begins with =, +, -, @, tab, or carriage return.
 */
export function sanitizeCell(value: any): any {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^[=+\-@\t\r]/.test(trimmed)) {
      return `'${value}`;
    }
  }
  return value;
}

export function exportProductsToWorkbook(products: Product[]): XLSX.WorkBook {
  const rows = products.map((p) => ({
    'Product ID': sanitizeCell(p.productId),
    'Product Name': sanitizeCell(p.name),
    'Size': sanitizeCell(p.size),
    'Company / Brand': sanitizeCell(p.companyBrand),
    'Unit': sanitizeCell(p.unit),
    'Stock': p.stockQuantity,
    'Low Stock Limit': p.lowStockLimit,
    'MRP': p.mrp,
    'Discount %': p.purchaseDiscountPercent,
    'Purchase Price': p.purchasePrice,
    'Profit Margin %': p.profitMarginPercent,
    'Selling Price': p.sellingPrice,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
  return workbook;
}

export function exportProductsToCsvString(products: Product[]): string {
  const wb = exportProductsToWorkbook(products);
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_csv(firstSheet);
}
