// src/services/analytics.service.ts
import { getInvoiceRepository, getProductRepository, isPrismaConfigured } from '@/lib/db/connection-router';
import { prisma } from '@/lib/db/prisma';
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

  /**
   * Phase 4: Comprehensive Shop Analytics Engine
   * Calculates real Net Sales, COGS (via purchase cost snapshots), Gross Profit,
   * Brand Performance, Product rankings, and Payment Mode splits.
   */
  async getComprehensiveAnalytics(startDate?: string, endDate?: string) {
    const { invoices } = await this.invoiceRepo.findMany({
      startDate,
      endDate,
    });
    const { products } = await this.productRepo.findMany({});
    const productMap = new Map<string, Product>();
    for (const p of products) {
      productMap.set(p.id, p);
      productMap.set(p.productId.trim().toUpperCase(), p);
    }

    const validInvoices = invoices.filter((inv) => inv.status !== 'CANCELLED');

    let totalSales = 0;
    let totalDiscounts = 0;
    let totalRefunds = 0;
    let completedInvoices = validInvoices.length;
    let cashSales = 0;
    let cashCount = 0;
    let upiSales = 0;
    let upiCount = 0;

    // Brand and product level aggregation maps
    const brandMap = new Map<
      string,
      {
        brandName: string;
        distinctProducts: Set<string>;
        unitsSold: number;
        grossRevenue: number;
        cogs: number;
        productsMap: Map<
          string,
          {
            productId: string;
            productCode: string;
            name: string;
            size: string;
            unit: string;
            unitsSold: number;
            revenue: number;
            cogs: number;
          }
        >;
      }
    >();

    const productSalesAgg = new Map<
      string,
      {
        productId: string;
        productCode: string;
        name: string;
        brand: string;
        size: string;
        unit: string;
        unitsSold: number;
        revenue: number;
        cogs: number;
        currentStock: number;
        lowStockLimit: number;
      }
    >();

    // Initialize product sales agg for all active products
    for (const p of products) {
      productSalesAgg.set(p.id, {
        productId: p.id,
        productCode: p.productId,
        name: p.name,
        brand: p.companyBrand || 'Unbranded',
        size: p.size || '',
        unit: p.unit || 'Pcs',
        unitsSold: 0,
        revenue: 0,
        cogs: 0,
        currentStock: p.stockQuantity,
        lowStockLimit: p.lowStockLimit,
      });
    }

    let totalUnitsSold = 0;
    let totalCOGS = 0;
    let hasHistoricalCostAccuracy = true;

    for (const inv of validInvoices) {
      totalSales += Number(inv.finalTotal) || 0;
      totalDiscounts += Number(inv.discountAmount) || 0;

      // Track item-level purchase costs for return adjustments
      const itemCostMap = new Map<string, number>();

      // Line items iteration
      for (const item of inv.items) {
        const p = productMap.get(item.productId);
        const qty = Number(item.quantity) || 0;
        const lineTotal = Number(item.lineTotal) || 0;

        // Purchase cost snapshot rule (Phase 4.3)
        let costPerUnit = 0;
        if (
          item.purchaseCostSnapshot !== undefined &&
          item.purchaseCostSnapshot !== null &&
          !isNaN(Number(item.purchaseCostSnapshot))
        ) {
          costPerUnit = Number(item.purchaseCostSnapshot);
        } else if (p && p.purchasePrice !== undefined) {
          costPerUnit = Number(p.purchasePrice);
          hasHistoricalCostAccuracy = false; // Flag that fallback was used
        }

        itemCostMap.set(item.id, costPerUnit);

        const itemCogs = qty * costPerUnit;
        totalUnitsSold += qty;
        totalCOGS += itemCogs;

        // Brand aggregation
        const rawBrand = (p?.companyBrand || '').trim();
        const brandKey = rawBrand ? rawBrand : 'Unbranded';
        let brandEntry = brandMap.get(brandKey);
        if (!brandEntry) {
          brandEntry = {
            brandName: brandKey,
            distinctProducts: new Set<string>(),
            unitsSold: 0,
            grossRevenue: 0,
            cogs: 0,
            productsMap: new Map(),
          };
          brandMap.set(brandKey, brandEntry);
        }

        brandEntry.distinctProducts.add(item.productId);
        brandEntry.unitsSold += qty;
        brandEntry.grossRevenue += lineTotal;
        brandEntry.cogs += itemCogs;

        // Brand product breakdown
        let bp = brandEntry.productsMap.get(item.productId);
        if (!bp) {
          bp = {
            productId: item.productId,
            productCode: item.productIdSnapshot || p?.productId || 'UNKNOWN',
            name: item.productNameSnapshot || p?.name || 'Unknown Product',
            size: item.sizeSnapshot || p?.size || '',
            unit: item.unitSnapshot || p?.unit || 'Pcs',
            unitsSold: 0,
            revenue: 0,
            cogs: 0,
          };
          brandEntry.productsMap.set(item.productId, bp);
        }
        bp.unitsSold += qty;
        bp.revenue += lineTotal;
        bp.cogs += itemCogs;

        // Product sales agg
        const pAgg = productSalesAgg.get(item.productId);
        if (pAgg) {
          pAgg.unitsSold += qty;
          pAgg.revenue += lineTotal;
          pAgg.cogs += itemCogs;
        }
      }

      // Returns refund and COGS reversal calculation
      if (inv.returns && inv.returns.length > 0) {
        for (const ret of inv.returns) {
          totalRefunds += Number(ret.totalReturnedAmount) || 0;

          if (ret.items && Array.isArray(ret.items)) {
            for (const retItem of ret.items) {
              const retQty = Number(retItem.quantity) || 0;
              const unitCost = itemCostMap.get(retItem.invoiceItemId) || 0;
              const returnedCogs = retQty * unitCost;

              // Reverse COGS and units sold on returns
              totalUnitsSold = Math.max(0, totalUnitsSold - retQty);
              totalCOGS = Math.max(0, totalCOGS - returnedCogs);

              const p = productMap.get(retItem.productId);
              const rawBrand = (p?.companyBrand || '').trim();
              const brandKey = rawBrand ? rawBrand : 'Unbranded';
              const bEntry = brandMap.get(brandKey);
              if (bEntry) {
                bEntry.unitsSold = Math.max(0, bEntry.unitsSold - retQty);
                bEntry.cogs = Math.max(0, bEntry.cogs - returnedCogs);
                const bp = bEntry.productsMap.get(retItem.productId);
                if (bp) {
                  bp.unitsSold = Math.max(0, bp.unitsSold - retQty);
                  bp.cogs = Math.max(0, bp.cogs - returnedCogs);
                }
              }

              const pAgg = productSalesAgg.get(retItem.productId);
              if (pAgg) {
                pAgg.unitsSold = Math.max(0, pAgg.unitsSold - retQty);
                pAgg.cogs = Math.max(0, pAgg.cogs - returnedCogs);
              }
            }
          }
        }
      }

      // Payment mode split (Phase 4.6 - Cash vs UPI split)
      if (inv.paymentMode === 'UPI') {
        upiSales += Number(inv.finalTotal) || 0;
        upiCount++;
      } else {
        cashSales += Number(inv.finalTotal) || 0;
        cashCount++;
      }
    }

    const netSales = Math.round(Math.max(0, totalSales - totalRefunds) * 100) / 100;
    const grossProfit = Math.round((netSales - totalCOGS) * 100) / 100;
    const grossProfitMarginPercent =
      netSales > 0 ? Math.round(((grossProfit / netSales) * 100) * 100) / 100 : 0;
    const averageInvoiceValue =
      completedInvoices > 0 ? Math.round((totalSales / completedInvoices) * 100) / 100 : 0;

    // Format brand breakdown
    const brandReports = Array.from(brandMap.values())
      .map((b) => {
        const bGrossProfit = Math.round((b.grossRevenue - b.cogs) * 100) / 100;
        const bMargin =
          b.grossRevenue > 0 ? Math.round(((bGrossProfit / b.grossRevenue) * 100) * 100) / 100 : 0;

        const productsBreakdown = Array.from(b.productsMap.values()).map((bp) => {
          const pProfit = Math.round((bp.revenue - bp.cogs) * 100) / 100;
          const pMargin =
            bp.revenue > 0 ? Math.round(((pProfit / bp.revenue) * 100) * 100) / 100 : 0;
          return {
            ...bp,
            grossProfit: pProfit,
            marginPercent: pMargin,
          };
        });

        return {
          brandName: b.brandName,
          distinctProductsCount: b.distinctProducts.size,
          unitsSold: Math.round(b.unitsSold * 100) / 100,
          grossRevenue: Math.round(b.grossRevenue * 100) / 100,
          cogs: Math.round(b.cogs * 100) / 100,
          grossProfit: bGrossProfit,
          grossProfitMarginPercent: bMargin,
          products: productsBreakdown.sort((x, y) => y.revenue - x.revenue),
        };
      })
      .sort((a, b) => b.grossRevenue - a.grossRevenue);

    // Format products rankings
    const allProductsAgg = Array.from(productSalesAgg.values()).map((p) => {
      const pProfit = Math.round((p.revenue - p.cogs) * 100) / 100;
      const pMargin = p.revenue > 0 ? Math.round(((pProfit / p.revenue) * 100) * 100) / 100 : 0;
      const stockStatus: 'inStock' | 'lowStock' | 'outOfStock' =
        p.currentStock <= 0
          ? 'outOfStock'
          : p.currentStock <= p.lowStockLimit
          ? 'lowStock'
          : 'inStock';

      return {
        ...p,
        grossProfit: pProfit,
        marginPercent: pMargin,
        stockStatus,
      };
    });

    const bestSellers = allProductsAgg
      .filter((p) => p.unitsSold > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const slowMovers = allProductsAgg
      .filter((p) => p.unitsSold === 0 || p.unitsSold <= 2)
      .sort((a, b) => a.unitsSold - b.unitsSold);

    return {
      period: {
        startDate: startDate || '',
        endDate: endDate || '',
      },
      kpis: {
        totalSales: Math.round(totalSales * 100) / 100,
        completedInvoices,
        averageInvoiceValue,
        unitsSold: Math.round(totalUnitsSold * 100) / 100,
        totalDiscounts: Math.round(totalDiscounts * 100) / 100,
        totalRefunds: Math.round(totalRefunds * 100) / 100,
        netSales,
        cogs: Math.round(totalCOGS * 100) / 100,
        grossProfit,
        grossProfitMarginPercent,
        hasHistoricalCostAccuracy,
      },
      paymentSplit: {
        cashSales: Math.round(cashSales * 100) / 100,
        cashInvoicesCount: cashCount,
        upiSales: Math.round(upiSales * 100) / 100,
        upiInvoicesCount: upiCount,
      },
      brands: brandReports,
      products: {
        bestSellers,
        slowMovers,
      },
      invoices: validInvoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        billDate: i.billDate,
        customerName: i.customerName,
        paymentMode: i.paymentMode,
        subtotal: i.subtotal,
        discountAmount: i.discountAmount,
        finalTotal: i.finalTotal,
        status: i.status,
        itemCount: i.items.length,
      })),
    };
  }

  /**
   * Database-Side SQL Aggregation (Audit Finding #6)
   * When PostgreSQL / Prisma is active, groups and sums directly in the database.
   */
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
    if (isPrismaConfigured()) {
      const where: any = {
        invoice: {
          status: { not: 'CANCELLED' },
        },
      };

      if (startDate || endDate) {
        where.invoice.billDate = {};
        if (startDate) where.invoice.billDate.gte = new Date(startDate);
        if (endDate) where.invoice.billDate.lte = new Date(endDate);
      }

      // Fast SQL GROUP BY aggregation
      const grouped = await prisma.invoiceItem.groupBy({
        by: ['productId'],
        where,
        _sum: {
          quantity: true,
          lineTotal: true,
        },
      });

      if (grouped.length === 0) return [];

      const productIds = grouped.map((g) => g.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, productId: true, name: true, size: true, unit: true },
      });

      const productMap = new Map(products.map((p) => [p.id, p]));

      return grouped
        .map((g) => {
          const p = productMap.get(g.productId);
          const totalQty = Number(g._sum.quantity || 0);
          const totalRev = Number(g._sum.lineTotal || 0);

          return {
            productId: g.productId,
            productCode: p?.productId || 'UNKNOWN',
            name: p?.name || 'Unknown Product',
            size: p?.size || '',
            unit: p?.unit || 'Pcs',
            totalQuantitySold: Math.round(totalQty * 100) / 100,
            totalRevenue: Math.round(totalRev * 100) / 100,
          };
        })
        .filter((p) => p.totalQuantitySold > 0)
        .sort((a, b) => b.totalQuantitySold - a.totalQuantitySold);
    }

    // Local in-memory fallback
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
