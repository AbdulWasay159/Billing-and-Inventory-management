// src/services/import-export.service.ts
import { getProductRepository, getStockRepository, isPrismaConfigured } from '@/lib/db/connection-router';
import { prisma } from '@/lib/db/prisma';
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
    if (isPrismaConfigured()) {
      return prisma.$transaction(
        async (tx) => {
          let newCount = 0;
          let updatedCount = 0;
          let errorCount = 0;

          for (const row of validatedRows) {
            if (row.errors.length > 0) {
              errorCount++;
              continue;
            }

            const cleanId = row.productId.trim().toUpperCase();
            const existing = await tx.product.findUnique({
              where: { productId: cleanId },
            });

            if (existing) {
              const currentStock = Number(existing.stockQuantity);
              const stockDelta = Math.round((row.targetStock - currentStock) * 1000) / 1000;

              await tx.product.update({
                where: { id: existing.id },
                data: {
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
                },
              });

              if (stockDelta !== 0) {
                await tx.stockTransaction.create({
                  data: {
                    productId: existing.id,
                    transactionType: 'IMPORT_SET',
                    quantityChange: stockDelta,
                    stockBefore: currentStock,
                    stockAfter: row.targetStock,
                    referenceType: 'IMPORT',
                    notes: `Excel Import set stock from ${currentStock} to ${row.targetStock} (Delta: ${stockDelta > 0 ? '+' : ''}${stockDelta})`,
                  },
                });
              }

              updatedCount++;
            } else {
              const created = await tx.product.create({
                data: {
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
                },
              });

              if (row.targetStock > 0) {
                await tx.stockTransaction.create({
                  data: {
                    productId: created.id,
                    transactionType: 'IMPORT_SET',
                    quantityChange: row.targetStock,
                    stockBefore: 0,
                    stockAfter: row.targetStock,
                    referenceType: 'IMPORT',
                    notes: `Excel Import created new product with initial stock ${row.targetStock}`,
                  },
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
        },
        { timeout: 60000 }
      );
    }

    // Local in-memory / JSON fallback
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
