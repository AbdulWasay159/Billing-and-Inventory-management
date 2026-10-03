// src/services/import-export.service.ts
import { getProductRepository, getStockRepository } from '@/lib/db/connection-router';
import { ImportPreviewRow, ImportSummary } from '@/types';
import { parseAndValidateImportBuffer, ParseResult } from '@/lib/excel/importer';
import { exportProductsToWorkbook, exportProductsToCsvString } from '@/lib/excel/exporter';

export class ImportExportService {
  private productRepo = getProductRepository();
  private stockRepo = getStockRepository();

  async parseAndPreview(fileBuffer: ArrayBuffer): Promise<ParseResult> {
    return parseAndValidateImportBuffer(fileBuffer, this.productRepo);
  }

  async commitImport(validatedRows: ImportPreviewRow[]): Promise<ImportSummary> {
    let newCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const row of validatedRows) {
      if (row.errors.length > 0) {
        errorCount++;
        continue;
      }

      const cleanId = row.productId.trim().toUpperCase();
      const existing = await this.productRepo.findByProductId(cleanId);

      if (existing) {
        // UPDATE EXISTING PRODUCT
        const stockDelta = Math.round((row.targetStock - existing.stockQuantity) * 1000) / 1000;

        await this.productRepo.update(existing.id, {
          name: row.name,
          size: row.size,
          companyBrand: row.companyBrand,
          unit: row.unit,
          stockQuantity: row.targetStock,
          lowStockLimit: row.lowStockLimit,
          mrp: row.mrp,
          purchaseDiscountPercent: row.purchaseDiscountPercent,
          purchasePrice: row.purchasePrice,
          profitMarginPercent: row.profitMarginPercent,
          sellingPrice: row.sellingPrice,
        });

        // Record auditable IMPORT_SET stock transaction if stock changed
        if (stockDelta !== 0) {
          await this.stockRepo.recordTransaction({
            productId: existing.id,
            productName: row.name,
            transactionType: 'IMPORT_SET',
            quantityChange: stockDelta,
            stockBefore: existing.stockQuantity,
            stockAfter: row.targetStock,
            referenceType: 'IMPORT',
            notes: `Excel Import set stock from ${existing.stockQuantity} to ${row.targetStock} (Delta: ${stockDelta > 0 ? '+' : ''}${stockDelta})`,
          });
        }

        updatedCount++;
      } else {
        // CREATE NEW PRODUCT
        const created = await this.productRepo.create({
          productId: cleanId,
          name: row.name,
          size: row.size,
          companyBrand: row.companyBrand,
          unit: row.unit,
          stockQuantity: row.targetStock,
          lowStockLimit: row.lowStockLimit,
          mrp: row.mrp,
          purchaseDiscountPercent: row.purchaseDiscountPercent,
          purchasePrice: row.purchasePrice,
          profitMarginPercent: row.profitMarginPercent,
          sellingPrice: row.sellingPrice,
          previousSellingPrice: null,
          isActive: true,
        });

        // Record initial stock transaction
        if (row.targetStock > 0) {
          await this.stockRepo.recordTransaction({
            productId: created.id,
            productName: row.name,
            transactionType: 'IMPORT_SET',
            quantityChange: row.targetStock,
            stockBefore: 0,
            stockAfter: row.targetStock,
            referenceType: 'IMPORT',
            notes: `Excel Import created new product with initial stock ${row.targetStock}`,
          });
        }

        newCount++;
      }
    }

    return {
      totalRows: validatedRows.length,
      newProductsCount: newCount,
      updatedProductsCount: updatedCount,
      errorCount,
      importedAt: new Date().toISOString(),
    };
  }

  async exportProducts(format: 'xlsx' | 'csv' = 'xlsx'): Promise<{ data: any; filename: string }> {
    const { products } = await this.productRepo.findMany({ limit: 10000 });
    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      const csv = exportProductsToCsvString(products);
      return { data: csv, filename: `tradestock-products-${timestamp}.csv` };
    }

    const wb = exportProductsToWorkbook(products);
    return { data: wb, filename: `tradestock-products-${timestamp}.xlsx` };
  }
}

export const importExportService = new ImportExportService();
