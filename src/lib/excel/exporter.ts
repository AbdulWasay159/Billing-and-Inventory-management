// src/lib/excel/exporter.ts
import * as XLSX from 'xlsx';
import { Product } from '@/types';

export function exportProductsToWorkbook(products: Product[]): XLSX.WorkBook {
  const rows = products.map((p) => ({
    'Product ID': p.productId,
    'Product Name': p.name,
    'Size': p.size,
    'Company / Brand': p.companyBrand,
    'Unit': p.unit,
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
