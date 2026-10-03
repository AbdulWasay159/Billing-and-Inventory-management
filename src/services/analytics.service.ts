// src/services/analytics.service.ts
import { getInvoiceRepository, getProductRepository } from '@/lib/db/connection-router';
import { DashboardStats, MonthlyBillingSummary, ProductSalesSummary, Product } from '@/types';

export class AnalyticsService {
  private invoiceRepo = getInvoiceRepository();
  private productRepo = getProductRepository();

  async getDashboardMetrics(startDate?: string, endDate?: string): Promise<DashboardStats> {
    return this.invoiceRepo.getDashboardStats(startDate, endDate);
  }

  async getLowStockProducts(): Promise<Product[]> {
    const { products } = await this.productRepo.findMany({ lowStockOnly: true });
    return products.sort((a, b) => a.stockQuantity - b.stockQuantity);
  }

  async getOutOfStockProducts(): Promise<Product[]> {
    const { products } = await this.productRepo.findMany({ outOfStockOnly: true });
    return products;
  }

  async getMonthlyBillingSummary(year: number, month: number): Promise<MonthlyBillingSummary> {
    return this.invoiceRepo.getMonthlySummary(year, month);
  }

  async getProductSalesSummary(
    productId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ProductSalesSummary> {
    return this.invoiceRepo.getProductSalesSummary(productId, startDate, endDate);
  }

  async getAllProductsSalesSummary(
    startDate?: string,
    endDate?: string
  ): Promise<{
    productId: string;
    productCode: string;
    name: string;
    size: string;
    unit: string;
    totalQuantitySold: number;
    totalRevenue: number;
  }[]> {
    const { products } = await this.productRepo.findMany({ limit: 10000 });
    const { invoices } = await this.invoiceRepo.findMany({ startDate, endDate, limit: 10000 });

    const salesMap = new Map<
      string,
      { totalQty: number; totalRevenue: number }
    >();

    for (const inv of invoices) {
      if (inv.status === 'CANCELLED') continue;
      for (const item of inv.items) {
        const current = salesMap.get(item.productId) || { totalQty: 0, totalRevenue: 0 };
        current.totalQty += Number(item.quantity);
        current.totalRevenue += Number(item.lineTotal);
        salesMap.set(item.productId, current);
      }
    }

    return products
      .map((p) => {
        const stats = salesMap.get(p.id) || { totalQty: 0, totalRevenue: 0 };
        return {
          productId: p.id,
          productCode: p.productId,
          name: p.name,
          size: p.size,
          unit: p.unit,
          totalQuantitySold: Math.round(stats.totalQty * 100) / 100,
          totalRevenue: Math.round(stats.totalRevenue * 100) / 100,
        };
      })
      .filter((p) => p.totalQuantitySold > 0)
      .sort((a, b) => b.totalQuantitySold - a.totalQuantitySold);
  }
}

export const analyticsService = new AnalyticsService();
