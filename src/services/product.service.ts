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
    const cleanProductId = data.productId.trim().toUpperCase();
    const existing = await this.productRepo.findByProductId(cleanProductId);
    if (existing) {
      throw new Error(`Product ID "${cleanProductId}" is already in use.`);
    }

    const calculatedCost = calculatePurchasePrice(data.mrp, data.purchaseDiscountPercent);
    const purchasePrice =
      data.customPurchasePrice !== undefined && data.customPurchasePrice >= 0
        ? data.customPurchasePrice
        : calculatedCost;

    const { profitMarginPercent } = calculateProfitMargin(purchasePrice, data.sellingPrice);

    const product = await this.productRepo.create({
      productId: cleanProductId,
      name: data.name.trim(),
      size: data.size?.trim() || '',
      companyBrand: data.companyBrand?.trim() || '',
      unit: data.unit?.trim() || 'Pcs',
      stockQuantity: Number(data.stockQuantity) || 0,
      lowStockLimit: Number(data.lowStockLimit) >= 0 ? Number(data.lowStockLimit) : 5,
      mrp: Number(data.mrp) || 0,
      purchaseDiscountPercent: Number(data.purchaseDiscountPercent) || 0,
      purchasePrice,
      profitMarginPercent,
      sellingPrice: Number(data.sellingPrice) || 0,
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

    const mrp = data.mrp !== undefined ? Number(data.mrp) : existing.mrp;
    const discount =
      data.purchaseDiscountPercent !== undefined
        ? Number(data.purchaseDiscountPercent)
        : existing.purchaseDiscountPercent;

    const calculatedCost = calculatePurchasePrice(mrp, discount);
    const purchasePrice =
      data.customPurchasePrice !== undefined && data.customPurchasePrice >= 0
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
