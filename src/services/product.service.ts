// src/services/product.service.ts
import { getProductRepository, getCustomFieldRepository } from '@/lib/db/connection-router';
import { Product, PriceHistory } from '@/types';
import { calculatePurchasePrice, calculateProfitMargin } from '@/lib/utils';

export class ProductService {
  private productRepo = getProductRepository();
  private customFieldRepo = getCustomFieldRepository();

  async getProducts(params?: {
    search?: string;
    isActive?: boolean;
    lowStockOnly?: boolean;
    outOfStockOnly?: boolean;
    brand?: string;
    size?: string;
    unit?: string;
    stockStatus?: 'all' | 'inStock' | 'lowStock' | 'outOfStock';
    limit?: number;
    offset?: number;
  }) {
    return this.productRepo.findMany(params);
  }

  async getDistinctFilterOptions() {
    return this.productRepo.getDistinctFilterOptions();
  }

  async getProductById(id: string): Promise<Product | null> {
    const product = await this.productRepo.findById(id);
    if (!product) return null;
    const customFields = await this.customFieldRepo.getValuesForProduct(product.id);
    return { ...product, customFields };
  }

  async getProductByProductId(productId: string): Promise<Product | null> {
    return this.productRepo.findByProductId(productId);
  }

  async createProduct(data: {
    productId: string;
    name: string;
    size?: string;
    companyBrand?: string;
    unit?: string;
    stockQuantity: number;
    lowStockLimit?: number;
    mrp: number;
    purchaseDiscountPercent: number;
    customPurchasePrice?: number;
    sellingPrice: number;
    customFields?: Record<string, string>;
  }): Promise<Product> {
    if (!data.name || !data.name.trim()) {
      throw new Error('Product name is required.');
    }
    if (!data.productId || !data.productId.trim()) {
      throw new Error('Product ID is required.');
    }

    const mrp = Number(data.mrp);
    if (isNaN(mrp) || !isFinite(mrp) || mrp < 0) {
      throw new Error('MRP must be a valid non-negative number.');
    }

    const discountPercent = Number(data.purchaseDiscountPercent);
    if (isNaN(discountPercent) || !isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      throw new Error('Purchase discount percentage must be between 0 and 100.');
    }

    const sellingPrice = Number(data.sellingPrice);
    if (isNaN(sellingPrice) || !isFinite(sellingPrice) || sellingPrice < 0) {
      throw new Error('Selling price must be a valid non-negative number.');
    }

    const stockQuantity = Number(data.stockQuantity);
    if (isNaN(stockQuantity) || !isFinite(stockQuantity) || stockQuantity < 0) {
      throw new Error('Stock quantity must be a valid non-negative number.');
    }

    const lowStockLimit = data.lowStockLimit !== undefined ? Number(data.lowStockLimit) : 5;
    if (isNaN(lowStockLimit) || !isFinite(lowStockLimit) || lowStockLimit < 0) {
      throw new Error('Low stock limit must be a valid non-negative number.');
    }

    const cleanProductId = data.productId.trim().toUpperCase();
    const existing = await this.productRepo.findByProductId(cleanProductId);
    if (existing) {
      throw new Error(`Product ID "${cleanProductId}" is already in use.`);
    }

    const calculatedCost = calculatePurchasePrice(mrp, discountPercent);
    const purchasePrice =
      data.customPurchasePrice !== undefined && isFinite(data.customPurchasePrice) && data.customPurchasePrice >= 0
        ? data.customPurchasePrice
        : calculatedCost;

    const { profitMarginPercent } = calculateProfitMargin(purchasePrice, sellingPrice);

    const product = await this.productRepo.create({
      productId: cleanProductId,
      name: data.name.trim(),
      size: data.size?.trim() || '',
      companyBrand: data.companyBrand?.trim() || '',
      unit: data.unit?.trim() || 'Pcs',
      stockQuantity,
      lowStockLimit,
      mrp,
      purchaseDiscountPercent: discountPercent,
      purchasePrice,
      profitMarginPercent,
      sellingPrice,
      previousSellingPrice: null,
      isActive: true,
    });

    if (data.customFields && Object.keys(data.customFields).length > 0) {
      await this.customFieldRepo.setValues(product.id, data.customFields);
    }

    return product;
  }

  async updateProduct(
    id: string,
    data: {
      name?: string;
      size?: string;
      companyBrand?: string;
      unit?: string;
      lowStockLimit?: number;
      mrp?: number;
      purchaseDiscountPercent?: number;
      customPurchasePrice?: number;
      sellingPrice?: number;
      customFields?: Record<string, string>;
    }
  ): Promise<Product> {
    const existing = await this.productRepo.findById(id);
    if (!existing) throw new Error('Product not found.');

    if (data.mrp !== undefined) {
      const v = Number(data.mrp);
      if (isNaN(v) || !isFinite(v) || v < 0) throw new Error('MRP must be a valid non-negative number.');
    }
    if (data.purchaseDiscountPercent !== undefined) {
      const v = Number(data.purchaseDiscountPercent);
      if (isNaN(v) || !isFinite(v) || v < 0 || v > 100) throw new Error('Purchase discount percentage must be between 0 and 100.');
    }
    if (data.sellingPrice !== undefined) {
      const v = Number(data.sellingPrice);
      if (isNaN(v) || !isFinite(v) || v < 0) throw new Error('Selling price must be a valid non-negative number.');
    }
    if (data.lowStockLimit !== undefined) {
      const v = Number(data.lowStockLimit);
      if (isNaN(v) || !isFinite(v) || v < 0) throw new Error('Low stock limit must be a valid non-negative number.');
    }

    const mrp = data.mrp !== undefined ? Number(data.mrp) : existing.mrp;
    const discount =
      data.purchaseDiscountPercent !== undefined
        ? Number(data.purchaseDiscountPercent)
        : existing.purchaseDiscountPercent;

    const calculatedCost = calculatePurchasePrice(mrp, discount);
    const purchasePrice =
      data.customPurchasePrice !== undefined && isFinite(data.customPurchasePrice) && data.customPurchasePrice >= 0
        ? data.customPurchasePrice
        : calculatedCost;

    const sellingPrice =
      data.sellingPrice !== undefined ? Number(data.sellingPrice) : existing.sellingPrice;
    const { profitMarginPercent } = calculateProfitMargin(purchasePrice, sellingPrice);

    const updated = await this.productRepo.update(id, {
      name: data.name !== undefined ? data.name.trim() : existing.name,
      size: data.size !== undefined ? data.size.trim() : existing.size,
      companyBrand:
        data.companyBrand !== undefined ? data.companyBrand.trim() : existing.companyBrand,
      unit: data.unit !== undefined ? data.unit.trim() : existing.unit,
      lowStockLimit:
        data.lowStockLimit !== undefined ? Number(data.lowStockLimit) : existing.lowStockLimit,
      mrp,
      purchaseDiscountPercent: discount,
      purchasePrice,
      profitMarginPercent,
      sellingPrice,
    });

    if (data.customFields) {
      await this.customFieldRepo.setValues(id, data.customFields);
    }

    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    // Soft-delete to preserve historical references
    return this.productRepo.softDelete(id);
  }

  async getPriceHistory(productId: string): Promise<PriceHistory[]> {
    return this.productRepo.getPriceHistory(productId);
  }
}

export const productService = new ProductService();
