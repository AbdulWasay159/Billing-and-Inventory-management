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

  // Inject authoritative Excel formulas into calculated columns
  // Column H = MRP, Column I = Discount %, Column J = Purchase Price
  // Column K = Profit Margin %, Column L = Selling Price
  products.forEach((p, idx) => {
    const r = idx + 2;

    // Purchase Price Formula: =ROUND(H{r}*(1-I{r}/100),2) with preserved initial numeric value
    worksheet['J' + r] = {
      t: 'n',
      v: Number(p.purchasePrice) || 0,
      f: `ROUND(H${r}*(1-I${r}/100),2)`,
      z: '#,##0.00',
    };

    // Selling Price Formula: =IF(OR(K{r}<0,K{r}>=100),"",ROUND(J${r}/(1-K${r}/100),2))
    worksheet['L' + r] = {
      t: 'n',
      v: Number(p.sellingPrice) || 0,
      f: `IF(OR(K${r}<0,K${r}>=100),"",ROUND(J${r}/(1-K${r}/100),2))`,
      z: '#,##0.00',
    };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
  return workbook;
}

export function exportProductsToCsvString(products: Product[]): string {
  // CSV does not support Excel cell formulas; export clean, static calculated numeric values
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
  return XLSX.utils.sheet_to_csv(worksheet);
}
