// src/lib/excel/importer.ts
import * as XLSX from 'xlsx';
import { ImportPreviewRow, Product } from '@/types';
import { calculatePurchasePrice, calculateProfitMargin, calculateSellingPriceFromMargin } from '@/lib/utils';
import { IProductRepository } from '@/lib/db/types';

export interface ParseResult {
  previewRows: ImportPreviewRow[];
  totalRows: number;
  validRowsCount: number;
  newCount: number;
  updateCount: number;
  errorCount: number;
  duplicateIdsInFile: string[];
}

export async function parseAndValidateImportBuffer(
  fileBuffer: ArrayBuffer,
  productRepo: IProductRepository
): Promise<ParseResult> {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded spreadsheet contains no readable sheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  if (rawRows.length === 0) {
    throw new Error('The uploaded sheet is empty.');
  }

  // Pre-load all existing products to check existence by Product ID
  const { products: existingProducts } = await productRepo.findMany({ limit: 10000 });
  const existingMap = new Map<string, Product>();
  for (const p of existingProducts) {
    existingMap.set(p.productId.trim().toUpperCase(), p);
  }

  const seenIdsInFile = new Map<string, number>(); // ID -> first row number
  const duplicateIdsInFile: string[] = [];
  const previewRows: ImportPreviewRow[] = [];

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2; // Row 1 is header
    const errors: string[] = [];
    const warnings: string[] = [];

    // Flexible column header mapping
    const rawId = (
      row['Product ID'] ||
      row['ProductID'] ||
      row['product_id'] ||
      row['Item Code'] ||
      row['SKU'] ||
      ''
    ).toString().trim();

    const name = (
      row['Product Name'] ||
      row['ProductName'] ||
      row['name'] ||
      row['Description'] ||
      row['Item Name'] ||
      ''
    ).toString().trim();

    const size = (row['Size'] || row['size'] || row['Dimension'] || '').toString().trim();
    const companyBrand = (
      row['Company'] ||
      row['Brand'] ||
      row['company_brand'] ||
      row['Manufacturer'] ||
      ''
    ).toString().trim();

    const unit = (row['Unit'] || row['unit'] || 'Pcs').toString().trim();

    const rawStock = row['Stock'] ?? row['Quantity'] ?? row['Qty'] ?? row['stock_quantity'] ?? 0;
    const rawMrp = row['MRP'] ?? row['mrp'] ?? row['List Price'] ?? 0;
    const rawDisc = row['Discount %'] ?? row['Discount'] ?? row['purchase_discount_percent'] ?? 0;
    const rawPurchasePrice = row['Purchase Price'] ?? row['Cost Price'] ?? row['purchase_price'];
    const rawMargin = row['Profit Margin %'] ?? row['Margin %'] ?? row['profit_margin_percent'];
    const rawSellingPrice = row['Selling Price'] ?? row['Sale Price'] ?? row['selling_price'];
    const rawLowStock = row['Low Stock Limit'] ?? row['Min Stock'] ?? row['low_stock_limit'] ?? 5;

    // Validation
    if (!name) {
      errors.push('Product Name is required.');
    }

    let productId = rawId;
    if (!productId) {
      // Suggest automatic permanent ID if missing
      productId = `HW-${String(existingProducts.length + previewRows.length + 1).padStart(4, '0')}`;
      warnings.push(`Blank Product ID: Auto-assigned "${productId}".`);
    } else {
      const upperId = productId.toUpperCase();
      if (seenIdsInFile.has(upperId)) {
        errors.push(`Duplicate Product ID "${productId}" also appears on Row ${seenIdsInFile.get(upperId)}.`);
        if (!duplicateIdsInFile.includes(productId)) duplicateIdsInFile.push(productId);
      } else {
        seenIdsInFile.set(upperId, rowNum);
      }
    }

    const targetStock = Number(rawStock);
    if (isNaN(targetStock) || targetStock < 0) {
      errors.push('Stock Quantity must be a valid non-negative number.');
    }

    const mrp = Number(rawMrp);
    if (isNaN(mrp) || mrp < 0) {
      errors.push('MRP must be a valid non-negative number.');
    }

    const discountPercent = Number(rawDisc);
    if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      errors.push('Purchase Discount % must be between 0 and 100.');
    }

    // Purchase Price calculation with safe override support
    const formulaCost = calculatePurchasePrice(mrp, discountPercent);
    let purchasePrice = formulaCost;
    if (rawPurchasePrice !== undefined && rawPurchasePrice !== '') {
      const explicitCost = Number(rawPurchasePrice);
      if (!isNaN(explicitCost) && explicitCost >= 0) {
        // If explicit cost was supplied, use it; if formula produces different value and MRP was set,
        // formula recalculation takes priority unless explicit cost was manually intended override
        purchasePrice = explicitCost;
      }
    }

    let sellingPrice = Number(rawSellingPrice);
    const parsedMargin = rawMargin !== undefined && rawMargin !== '' ? Number(rawMargin) : NaN;

    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      // Try calculating selling price from margin % if available
      if (!isNaN(parsedMargin) && parsedMargin >= 0 && parsedMargin < 100) {
        sellingPrice = calculateSellingPriceFromMargin(purchasePrice, parsedMargin);
      } else {
        errors.push('Selling Price must be a positive number.');
        sellingPrice = 0;
      }
    }

    const lowStockLimit = Number(rawLowStock) >= 0 ? Number(rawLowStock) : 5;
    const { profitMarginPercent } = calculateProfitMargin(purchasePrice, sellingPrice);

    // Existing product check
    const existing = existingMap.get(productId.toUpperCase());
    const isExisting = Boolean(existing);
    let currentDbStock: number | undefined;
    let stockDelta: number | undefined;

    if (existing) {
      currentDbStock = existing.stockQuantity;
      stockDelta = Math.round((targetStock - currentDbStock) * 1000) / 1000;
    }

    previewRows.push({
      rowNumber: rowNum,
      productId,
      name,
      size,
      companyBrand,
      unit,
      targetStock: isNaN(targetStock) ? 0 : targetStock,
      lowStockLimit,
      mrp: isNaN(mrp) ? 0 : mrp,
      purchaseDiscountPercent: isNaN(discountPercent) ? 0 : discountPercent,
      purchasePrice,
      profitMarginPercent,
      sellingPrice: isNaN(sellingPrice) ? 0 : sellingPrice,
      isExisting,
      currentDbStock,
      stockDelta,
      errors,
      warnings,
    });
  });

  const errorCount = previewRows.filter((r) => r.errors.length > 0).length;
  const newCount = previewRows.filter((r) => !r.isExisting && r.errors.length === 0).length;
  const updateCount = previewRows.filter((r) => r.isExisting && r.errors.length === 0).length;

  return {
    previewRows,
    totalRows: previewRows.length,
    validRowsCount: previewRows.length - errorCount,
    newCount,
    updateCount,
    errorCount,
    duplicateIdsInFile,
  };
}
