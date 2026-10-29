// src/lib/db/prisma-adapter.ts
import { prisma } from './prisma';
import {
  Product,
  PriceHistory,
  StockTransaction,
  Invoice,
  InvoiceItem,
  InvoiceReturn,
  ReturnItem,
  CustomFieldDefinition,
  ShopProfile,
  DashboardStats,
  MonthlyBillingSummary,
  ProductSalesSummary,
} from '@/types';
import {
  IProductRepository,
  IStockRepository,
  IInvoiceRepository,
  IReturnRepository,
  ICustomFieldRepository,
  IShopRepository,
  ProductFilter,
} from './types';

// ==========================================
// Helper Type Mappers
// ==========================================

function toIsoString(date: Date | string | null | undefined): string {
  if (!date) return new Date().toISOString();
  if (date instanceof Date) return date.toISOString();
  return new Date(date).toISOString();
}

export function mapProduct(p: any): Product {
  const customFields: Record<string, string> = {};
  if (p.customFieldValues && Array.isArray(p.customFieldValues)) {
    for (const cfv of p.customFieldValues) {
      if (cfv.fieldDefinition) {
        customFields[cfv.fieldDefinition.fieldKey] = cfv.fieldValue;
      }
    }
  }

  return {
    id: p.id,
    productId: p.productId,
    name: p.name,
    size: p.size ?? '',
    companyBrand: p.companyBrand ?? '',
    unit: p.unit ?? 'Pcs',
    stockQuantity: Number(p.stockQuantity ?? 0),
    lowStockLimit: Number(p.lowStockLimit ?? 0),
    mrp: Number(p.mrp ?? 0),
    purchaseDiscountPercent: Number(p.purchaseDiscountPercent ?? 0),
    purchasePrice: Number(p.purchasePrice ?? 0),
    profitMarginPercent: Number(p.profitMarginPercent ?? 0),
    sellingPrice: Number(p.sellingPrice ?? 0),
    previousSellingPrice: p.previousSellingPrice !== null && p.previousSellingPrice !== undefined ? Number(p.previousSellingPrice) : null,
    isActive: Boolean(p.isActive),
    createdAt: toIsoString(p.createdAt),
    updatedAt: toIsoString(p.updatedAt),
    customFields,
  };
}

export function mapPriceHistory(ph: any): PriceHistory {
  return {
    id: ph.id,
    productId: ph.productId,
    oldSellingPrice: ph.oldSellingPrice !== null && ph.oldSellingPrice !== undefined ? Number(ph.oldSellingPrice) : null,
    newSellingPrice: Number(ph.newSellingPrice),
    oldPurchasePrice: ph.oldPurchasePrice !== null && ph.oldPurchasePrice !== undefined ? Number(ph.oldPurchasePrice) : null,
    newPurchasePrice: Number(ph.newPurchasePrice),
    changeReason: ph.changeReason ?? undefined,
    changedBy: ph.changedBy ?? 'Owner',
    changedAt: toIsoString(ph.changedAt),
  };
}

export function mapStockTransaction(st: any): StockTransaction {
  return {
    id: st.id,
    productId: st.productId,
    productName: st.product?.name ?? undefined,
    transactionType: st.transactionType,
    quantityChange: Number(st.quantityChange),
    stockBefore: Number(st.stockBefore),
    stockAfter: Number(st.stockAfter),
    referenceId: st.referenceId ?? undefined,
    referenceType: st.referenceType ?? undefined,
    notes: st.notes ?? undefined,
    createdAt: toIsoString(st.createdAt),
  };
}

export function mapInvoiceItem(item: any): InvoiceItem {
  return {
    id: item.id,
    invoiceId: item.invoiceId,
    productId: item.productId,
    productIdSnapshot: item.productIdSnapshot,
    productNameSnapshot: item.productNameSnapshot,
    sizeSnapshot: item.sizeSnapshot ?? '',
    unitSnapshot: item.unitSnapshot ?? 'Pcs',
    sellingPriceSnapshot: Number(item.sellingPriceSnapshot),
    purchaseCostSnapshot: Number(item.purchaseCostSnapshot ?? 0),
    quantity: Number(item.quantity),
    lineTotal: Number(item.lineTotal),
  };
}

export function mapInvoice(inv: any): Invoice {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    billDate: toIsoString(inv.billDate),
    customerName: inv.customerName ?? undefined,
    customerPhone: inv.customerPhone ?? undefined,
    paymentMode: inv.paymentMode as any,
    subtotal: Number(inv.subtotal),
    discountAmount: Number(inv.discountAmount),
    finalTotal: Number(inv.finalTotal),
    status: inv.status as any,
    notes: inv.notes ?? undefined,
    createdAt: toIsoString(inv.createdAt),
    updatedAt: toIsoString(inv.updatedAt),
    items: inv.items ? inv.items.map(mapInvoiceItem) : [],
    returns: inv.returns ? inv.returns.map(mapInvoiceReturn) : undefined,
  };
}

export function mapReturnItem(item: any): ReturnItem {
  return {
    id: item.id,
    returnId: item.returnId,
    invoiceItemId: item.invoiceItemId,
    productId: item.productId,
    productNameSnapshot: item.productNameSnapshot,
    quantity: Number(item.quantity),
    unitPriceSnapshot: Number(item.unitPriceSnapshot),
    refundAmount: Number(item.refundAmount),
  };
}

export function mapInvoiceReturn(ret: any): InvoiceReturn {
  return {
    id: ret.id,
    invoiceId: ret.invoiceId,
    returnNumber: ret.returnNumber,
    totalReturnedAmount: Number(ret.totalReturnedAmount),
    reason: ret.reason ?? undefined,
    createdAt: toIsoString(ret.createdAt),
    items: ret.items ? ret.items.map(mapReturnItem) : [],
  };
}

// ==========================================
// 1. Prisma Product Repository
// ==========================================

export class PrismaProductRepository implements IProductRepository {
  async findById(id: string): Promise<Product | null> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        customFieldValues: {
          include: { fieldDefinition: true },
        },
      },
    });
    return product ? mapProduct(product) : null;
  }

  async findByProductId(productId: string): Promise<Product | null> {
    const product = await prisma.product.findUnique({
      where: { productId: productId.trim().toUpperCase() },
      include: {
        customFieldValues: {
          include: { fieldDefinition: true },
        },
      },
    });
    return product ? mapProduct(product) : null;
  }

  async findMany(filter?: ProductFilter): Promise<{ products: Product[]; totalCount: number }> {
    const andConditions: any[] = [];

    // Active status filter: default to true to match local-adapter behavior
    if (filter?.isActive !== undefined) {
      andConditions.push({ isActive: filter.isActive });
    } else {
      andConditions.push({ isActive: true });
    }

    if (filter?.search) {
      const q = filter.search.trim();
      andConditions.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { productId: { contains: q, mode: 'insensitive' } },
          { companyBrand: { contains: q, mode: 'insensitive' } },
          { size: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (filter?.brand) {
      const targetBrand = filter.brand.trim();
      if (
        targetBrand.toLowerCase() === 'unbranded' ||
        targetBrand.toLowerCase() === '(no brand)' ||
        targetBrand === '__unbranded__'
      ) {
        andConditions.push({
          OR: [{ companyBrand: null }, { companyBrand: '' }],
        });
      } else {
        andConditions.push({
          companyBrand: { equals: targetBrand, mode: 'insensitive' },
        });
      }
    }

    if (filter?.size) {
      andConditions.push({ size: { equals: filter.size.trim(), mode: 'insensitive' } });
    }

    if (filter?.unit) {
      andConditions.push({ unit: { equals: filter.unit.trim(), mode: 'insensitive' } });
    }

    if (filter?.stockStatus === 'outOfStock' || filter?.outOfStockOnly) {
      andConditions.push({ stockQuantity: { lte: 0 } });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const isLowStockFilter = filter?.stockStatus === 'lowStock' || filter?.lowStockOnly;
    const isInStockFilter = filter?.stockStatus === 'inStock';

    if (isLowStockFilter || isInStockFilter) {
      // For column-to-column threshold comparisons (stockQuantity vs lowStockLimit):
      // Fetch candidate lightweight records matching static filters, filter and paginate accurately
      const candidates = await prisma.product.findMany({
        where,
        select: { id: true, stockQuantity: true, lowStockLimit: true },
        orderBy: { updatedAt: 'desc' },
      });

      const matchedIds = candidates
        .filter((p) => {
          const stock = Number(p.stockQuantity);
          const limit = Number(p.lowStockLimit);
          if (isLowStockFilter) {
            return stock > 0 && stock <= limit;
          }
          return stock > limit;
        })
        .map((p) => p.id);

      const totalCount = matchedIds.length;
      const offset = filter?.offset ?? 0;
      const limit = filter?.limit ?? 50;
      const pageIds = matchedIds.slice(offset, offset + limit);

      if (pageIds.length === 0) {
        return { products: [], totalCount };
      }

      const products = await prisma.product.findMany({
        where: { id: { in: pageIds } },
        orderBy: { updatedAt: 'desc' },
        include: {
          customFieldValues: {
            include: { fieldDefinition: true },
          },
        },
      });

      return { products: products.map(mapProduct), totalCount };
    }

    // Direct database pagination for standard filters
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        take: filter?.limit ?? 50,
        skip: filter?.offset ?? 0,
        orderBy: { updatedAt: 'desc' },
        include: {
          customFieldValues: {
            include: { fieldDefinition: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { products: products.map(mapProduct), totalCount };
  }

  async getDistinctFilterOptions(): Promise<{
    brands: string[];
    sizes: string[];
    units: string[];
    totalActiveCount: number;
  }> {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { companyBrand: true, size: true, unit: true },
    });

    const brandSet = new Set<string>();
    let hasUnbranded = false;
    const sizeSet = new Set<string>();
    const unitSet = new Set<string>();

    for (const p of products) {
      const b = (p.companyBrand || '').trim();
      if (b) {
        brandSet.add(b);
      } else {
        hasUnbranded = true;
      }

      const s = (p.size || '').trim();
      if (s) sizeSet.add(s);

      const u = (p.unit || '').trim();
      if (u) unitSet.add(u);
    }

    const sortedBrands = Array.from(brandSet).sort((a, b) => a.localeCompare(b));
    if (hasUnbranded) {
      sortedBrands.push('Unbranded');
    }

    return {
      brands: sortedBrands,
      sizes: Array.from(sizeSet).sort((a, b) => a.localeCompare(b)),
      units: Array.from(unitSet).sort((a, b) => a.localeCompare(b)),
      totalActiveCount: products.length,
    };
  }

  async create(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const normalizedProductId = data.productId.trim().toUpperCase();

    const created = await prisma.product.create({
      data: {
        productId: normalizedProductId,
        name: data.name.trim(),
        size: data.size || '',
        companyBrand: data.companyBrand || '',
        unit: data.unit || 'Pcs',
        stockQuantity: data.stockQuantity,
        lowStockLimit: data.lowStockLimit,
        mrp: data.mrp,
        purchaseDiscountPercent: data.purchaseDiscountPercent,
        purchasePrice: data.purchasePrice,
        profitMarginPercent: data.profitMarginPercent,
        sellingPrice: data.sellingPrice,
        previousSellingPrice: data.previousSellingPrice ?? null,
        isActive: data.isActive ?? true,
      },
      include: {
        customFieldValues: {
          include: { fieldDefinition: true },
        },
      },
    });

    return mapProduct(created);
  }

  async update(id: string, data: Partial<Product>): Promise<Product> {
    const current = await prisma.product.findUnique({ where: { id } });
    if (!current) throw new Error('Product not found.');

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.size !== undefined) updateData.size = data.size;
    if (data.companyBrand !== undefined) updateData.companyBrand = data.companyBrand;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.stockQuantity !== undefined) updateData.stockQuantity = data.stockQuantity;
    if (data.lowStockLimit !== undefined) updateData.lowStockLimit = data.lowStockLimit;
    if (data.mrp !== undefined) updateData.mrp = data.mrp;
    if (data.purchaseDiscountPercent !== undefined) updateData.purchaseDiscountPercent = data.purchaseDiscountPercent;
    if (data.purchasePrice !== undefined) updateData.purchasePrice = data.purchasePrice;
    if (data.profitMarginPercent !== undefined) updateData.profitMarginPercent = data.profitMarginPercent;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    if (
      data.sellingPrice !== undefined &&
      Number(data.sellingPrice) !== Number(current.sellingPrice)
    ) {
      updateData.sellingPrice = data.sellingPrice;
      updateData.previousSellingPrice = Number(current.sellingPrice);
      await this.logPriceHistory({
        productId: current.id,
        oldSellingPrice: Number(current.sellingPrice),
        newSellingPrice: Number(data.sellingPrice),
        oldPurchasePrice: Number(current.purchasePrice),
        newPurchasePrice: Number(data.purchasePrice ?? current.purchasePrice),
        changeReason: 'Manual price update',
        changedBy: 'Owner',
      });
    } else {
      if (data.sellingPrice !== undefined) updateData.sellingPrice = data.sellingPrice;
      if (data.previousSellingPrice !== undefined) updateData.previousSellingPrice = data.previousSellingPrice;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        customFieldValues: {
          include: { fieldDefinition: true },
        },
      },
    });

    return mapProduct(updated);
  }

  async softDelete(id: string): Promise<boolean> {
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    return true;
  }

  async logPriceHistory(history: Omit<PriceHistory, 'id' | 'changedAt'>): Promise<PriceHistory> {
    const created = await prisma.priceHistory.create({
      data: {
        productId: history.productId,
        oldSellingPrice: history.oldSellingPrice,
        newSellingPrice: history.newSellingPrice,
        oldPurchasePrice: history.oldPurchasePrice,
        newPurchasePrice: history.newPurchasePrice,
        changeReason: history.changeReason,
        changedBy: history.changedBy || 'Owner',
      },
    });
    return mapPriceHistory(created);
  }

  async getPriceHistory(productId: string): Promise<PriceHistory[]> {
    const records = await prisma.priceHistory.findMany({
      where: { productId },
      orderBy: { changedAt: 'desc' },
    });
    return records.map(mapPriceHistory);
  }
}

// ==========================================
// 2. Prisma Stock Repository
// ==========================================

export class PrismaStockRepository implements IStockRepository {
  async recordTransaction(tx: Omit<StockTransaction, 'id' | 'createdAt'>): Promise<StockTransaction> {
    const created = await prisma.stockTransaction.create({
      data: {
        productId: tx.productId,
        transactionType: tx.transactionType,
        quantityChange: tx.quantityChange,
        stockBefore: tx.stockBefore,
        stockAfter: tx.stockAfter,
        referenceId: tx.referenceId,
        referenceType: tx.referenceType,
        notes: tx.notes,
      },
      include: { product: true },
    });
    return mapStockTransaction(created);
  }

  async getTransactionsByProduct(productId: string): Promise<StockTransaction[]> {
    const records = await prisma.stockTransaction.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      include: { product: true },
    });
    return records.map(mapStockTransaction);
  }

  async getAllTransactions(limit = 100): Promise<StockTransaction[]> {
    const records = await prisma.stockTransaction.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { product: true },
    });
    return records.map(mapStockTransaction);
  }

  async updateStockAtomically(
    productId: string,
    quantityChange: number,
    transactionType: StockTransaction['transactionType'],
    referenceId?: string,
    notes?: string
  ): Promise<{ newStock: number; transaction: StockTransaction }> {
    if (typeof quantityChange !== 'number' || !isFinite(quantityChange)) {
      throw new Error(`Invalid stock quantity adjustment: value must be a finite number.`);
    }

    const ALLOWED_TYPES = ['STOCK_RECEIVED', 'SALE', 'RETURN', 'ADJUSTMENT', 'IMPORT_SET'];
    if (!ALLOWED_TYPES.includes(transactionType)) {
      throw new Error(`Invalid transaction type: "${transactionType}".`);
    }

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });
      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      const stockBefore = Number(product.stockQuantity);
      const absChange = Math.abs(quantityChange);

      if (quantityChange < 0) {
        // Atomic conditional decrement to eliminate race conditions under concurrency
        const updateResult = await tx.product.updateMany({
          where: {
            id: productId,
            stockQuantity: { gte: absChange },
          },
          data: {
            stockQuantity: { decrement: absChange },
          },
        });

        if (updateResult.count === 0) {
          throw new Error(
            `Insufficient stock for "${product.name}". Available: ${stockBefore}, Requested deduction: ${absChange}`
          );
        }
      } else if (quantityChange > 0) {
        await tx.product.update({
          where: { id: productId },
          data: { stockQuantity: { increment: quantityChange } },
        });
      }

      const reloaded = await tx.product.findUnique({ where: { id: productId } });
      const stockAfter = Number(reloaded?.stockQuantity ?? stockBefore);

      const transaction = await tx.stockTransaction.create({
        data: {
          productId,
          transactionType,
          quantityChange,
          stockBefore,
          stockAfter,
          referenceId,
          referenceType:
            transactionType === 'SALE'
              ? 'INVOICE'
              : transactionType === 'RETURN'
              ? 'RETURN'
              : transactionType === 'IMPORT_SET'
              ? 'IMPORT'
              : 'MANUAL',
          notes,
        },
        include: { product: true },
      });

      return {
        newStock: stockAfter,
        transaction: mapStockTransaction(transaction),
      };
    });
  }
}

// ==========================================
// 3. Prisma Invoice Repository
// ==========================================

export class PrismaInvoiceRepository implements IInvoiceRepository {
  async findById(id: string): Promise<Invoice | null> {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        returns: { include: { items: true } },
      },
    });
    return invoice ? mapInvoice(invoice) : null;
  }

  async findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null> {
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: invoiceNumber.trim().toUpperCase() },
      include: {
        items: true,
        returns: { include: { items: true } },
      },
    });
    return invoice ? mapInvoice(invoice) : null;
  }

  async findMany(filter?: {
    startDate?: string;
    endDate?: string;
    customerSearch?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ invoices: Invoice[]; totalCount: number }> {
    const where: any = {};

    if (filter?.startDate || filter?.endDate) {
      where.billDate = {};
      if (filter.startDate) where.billDate.gte = new Date(filter.startDate);
      if (filter.endDate) where.billDate.lte = new Date(filter.endDate);
    }

    if (filter?.customerSearch) {
      const q = filter.customerSearch.trim();
      where.OR = [
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q, mode: 'insensitive' } },
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [invoices, totalCount] = await Promise.all([
      prisma.invoice.findMany({
        where,
        take: filter?.limit ?? 50,
        skip: filter?.offset ?? 0,
        orderBy: { billDate: 'desc' },
        include: {
          items: true,
          returns: { include: { items: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      invoices: invoices.map(mapInvoice),
      totalCount,
    };
  }

  async generateNextInvoiceNumber(): Promise<string> {
    const counter = await prisma.sequenceCounter.upsert({
      where: { name: 'INVOICE' },
      update: { currentValue: { increment: 1 } },
      create: { name: 'INVOICE', currentValue: 1 },
    });
    return `INV-${String(counter.currentValue).padStart(6, '0')}`;
  }

  async create(
    invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'items'>,
    items: Omit<InvoiceItem, 'id' | 'invoiceId'>[]
  ): Promise<Invoice> {
    const created = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceData.invoiceNumber,
        billDate: new Date(invoiceData.billDate),
        customerName: invoiceData.customerName,
        customerPhone: invoiceData.customerPhone,
        paymentMode: invoiceData.paymentMode,
        subtotal: invoiceData.subtotal,
        discountAmount: invoiceData.discountAmount,
        finalTotal: invoiceData.finalTotal,
        status: invoiceData.status || 'COMPLETED',
        notes: invoiceData.notes,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            productIdSnapshot: item.productIdSnapshot,
            productNameSnapshot: item.productNameSnapshot,
            sizeSnapshot: item.sizeSnapshot || '',
            unitSnapshot: item.unitSnapshot || 'Pcs',
            sellingPriceSnapshot: item.sellingPriceSnapshot,
            purchaseCostSnapshot: item.purchaseCostSnapshot || 0,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
          })),
        },
      },
      include: {
        items: true,
        returns: { include: { items: true } },
      },
    });

    return mapInvoice(created);
  }

  async update(
    id: string,
    updates: Partial<Invoice>,
    newItems?: Omit<InvoiceItem, 'id' | 'invoiceId'>[]
  ): Promise<Invoice> {
    return prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (updates.customerName !== undefined) updateData.customerName = updates.customerName;
      if (updates.customerPhone !== undefined) updateData.customerPhone = updates.customerPhone;
      if (updates.paymentMode !== undefined) updateData.paymentMode = updates.paymentMode;
      if (updates.subtotal !== undefined) updateData.subtotal = updates.subtotal;
      if (updates.discountAmount !== undefined) updateData.discountAmount = updates.discountAmount;
      if (updates.finalTotal !== undefined) updateData.finalTotal = updates.finalTotal;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      if (newItems && newItems.length > 0) {
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: id },
        });

        await tx.invoiceItem.createMany({
          data: newItems.map((item) => ({
            invoiceId: id,
            productId: item.productId,
            productIdSnapshot: item.productIdSnapshot,
            productNameSnapshot: item.productNameSnapshot,
            sizeSnapshot: item.sizeSnapshot || '',
            unitSnapshot: item.unitSnapshot || 'Pcs',
            sellingPriceSnapshot: item.sellingPriceSnapshot,
            purchaseCostSnapshot: item.purchaseCostSnapshot || 0,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
          })),
        });
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: updateData,
        include: {
          items: true,
          returns: { include: { items: true } },
        },
      });

      return mapInvoice(updated);
    });
  }

  async getMonthlySummary(year: number, month: number): Promise<MonthlyBillingSummary> {
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const invoices = await prisma.invoice.findMany({
      where: {
        billDate: {
          gte: startDate,
          lte: endDate,
        },
        status: { not: 'CANCELLED' },
      },
      orderBy: { billDate: 'asc' },
      select: {
        id: true,
        invoiceNumber: true,
        billDate: true,
        finalTotal: true,
        paymentMode: true,
      },
    });

    const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    let totalSales = 0;

    const mappedInvoices = invoices.map((inv) => {
      const amount = Number(inv.finalTotal);
      totalSales += amount;
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        billDate: inv.billDate.toISOString(),
        finalTotal: amount,
        paymentMode: inv.paymentMode as any,
      };
    });

    return {
      month: monthName,
      totalInvoices: invoices.length,
      totalSales: Math.round(totalSales * 100) / 100,
      invoices: mappedInvoices,
    };
  }

  async getProductSalesSummary(productId: string, startDate?: string, endDate?: string): Promise<ProductSalesSummary> {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    const where: any = {
      productId,
      invoice: {
        status: { not: 'CANCELLED' },
      },
    };

    if (startDate || endDate) {
      where.invoice.billDate = {};
      if (startDate) where.invoice.billDate.gte = new Date(startDate);
      if (endDate) where.invoice.billDate.lte = new Date(endDate);
    }

    const items = await prisma.invoiceItem.findMany({
      where,
      include: {
        invoice: true,
      },
      orderBy: { invoice: { billDate: 'desc' } },
    });

    let totalQuantitySold = 0;
    let totalRevenue = 0;

    const invoices = items.map((it) => {
      const qty = Number(it.quantity);
      const total = Number(it.lineTotal);
      totalQuantitySold += qty;
      totalRevenue += total;

      return {
        invoiceId: it.invoice.id,
        invoiceNumber: it.invoice.invoiceNumber,
        date: it.invoice.billDate.toISOString(),
        quantity: qty,
        sellingPrice: Number(it.sellingPriceSnapshot),
        lineTotal: total,
      };
    });

    return {
      productId: product.id,
      productCode: product.productId,
      name: product.name,
      size: product.size,
      totalQuantitySold: Math.round(totalQuantitySold * 1000) / 1000,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      invoices,
    };
  }

  async getDashboardStats(startDate?: string, endDate?: string): Promise<DashboardStats> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const periodStart = startDate ? new Date(startDate) : startOfToday;
    const periodEnd = endDate ? new Date(endDate) : endOfToday;

    const [
      totalProducts,
      outOfStockCount,
      allActiveProducts,
      todayAggregate,
      periodAggregate,
    ] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true, stockQuantity: { lte: 0 } } }),
      prisma.product.findMany({
        where: { isActive: true },
        select: { stockQuantity: true, lowStockLimit: true },
      }),
      prisma.invoice.aggregate({
        where: {
          billDate: { gte: startOfToday, lte: endOfToday },
          status: { not: 'CANCELLED' },
        },
        _sum: { finalTotal: true },
        _count: { id: true },
      }),
      prisma.invoice.aggregate({
        where: {
          billDate: { gte: periodStart, lte: periodEnd },
          status: { not: 'CANCELLED' },
        },
        _sum: { finalTotal: true },
        _count: { id: true },
      }),
    ]);

    const lowStockCount = allActiveProducts.filter(
      (p) => Number(p.stockQuantity) > 0 && Number(p.stockQuantity) <= Number(p.lowStockLimit)
    ).length;

    return {
      totalProducts,
      lowStockCount,
      outOfStockCount,
      todaySalesAmount: Math.round(Number(todayAggregate._sum.finalTotal ?? 0) * 100) / 100,
      todayInvoiceCount: todayAggregate._count.id ?? 0,
      selectedPeriodSalesAmount: Math.round(Number(periodAggregate._sum.finalTotal ?? 0) * 100) / 100,
      selectedPeriodInvoiceCount: periodAggregate._count.id ?? 0,
    };
  }
}

// ==========================================
// 4. Prisma Return Repository
// ==========================================

export class PrismaReturnRepository implements IReturnRepository {
  async createReturn(
    invoiceId: string,
    items: { invoiceItemId: string; productId: string; quantity: number; refundAmount: number }[],
    reason?: string
  ): Promise<InvoiceReturn> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });
    if (!invoice) throw new Error('Invoice not found.');

    // Atomic Sequence counter for return number
    const counter = await prisma.sequenceCounter.upsert({
      where: { name: 'RETURN' },
      update: { currentValue: { increment: 1 } },
      create: { name: 'RETURN', currentValue: 1 },
    });
    const returnNumber = `RET-${String(counter.currentValue).padStart(6, '0')}`;

    let totalRefund = 0;
    for (const it of items) {
      totalRefund += it.refundAmount;
    }

    const invoiceReturn = await prisma.invoiceReturn.create({
      data: {
        invoiceId,
        returnNumber,
        totalReturnedAmount: Math.round(totalRefund * 100) / 100,
        reason,
        items: {
          create: items.map((item) => {
            const invItem = invoice.items.find((i) => i.id === item.invoiceItemId);
            return {
              invoiceItemId: item.invoiceItemId,
              productId: item.productId,
              productNameSnapshot: invItem?.productNameSnapshot || 'Product',
              quantity: item.quantity,
              unitPriceSnapshot: invItem ? Number(invItem.sellingPriceSnapshot) : 0,
              refundAmount: item.refundAmount,
            };
          }),
        },
      },
      include: { items: true },
    });

    return mapInvoiceReturn(invoiceReturn);
  }

  async getReturnsByInvoice(invoiceId: string): Promise<InvoiceReturn[]> {
    const returns = await prisma.invoiceReturn.findMany({
      where: { invoiceId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return returns.map(mapInvoiceReturn);
  }
}

// ==========================================
// 5. Prisma Custom Field Repository
// ==========================================

export class PrismaCustomFieldRepository implements ICustomFieldRepository {
  async getDefinitions(): Promise<CustomFieldDefinition[]> {
    const defs = await prisma.customFieldDefinition.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    return defs.map((d) => ({
      id: d.id,
      fieldKey: d.fieldKey,
      label: d.label,
      dataType: d.dataType as any,
      isRequired: d.isRequired,
      displayOrder: d.displayOrder,
      createdAt: toIsoString(d.createdAt),
    }));
  }

  async createDefinition(def: Omit<CustomFieldDefinition, 'id' | 'createdAt'>): Promise<CustomFieldDefinition> {
    const created = await prisma.customFieldDefinition.create({
      data: {
        fieldKey: def.fieldKey,
        label: def.label,
        dataType: def.dataType,
        isRequired: def.isRequired,
        displayOrder: def.displayOrder,
      },
    });
    return {
      id: created.id,
      fieldKey: created.fieldKey,
      label: created.label,
      dataType: created.dataType as any,
      isRequired: created.isRequired,
      displayOrder: created.displayOrder,
      createdAt: toIsoString(created.createdAt),
    };
  }

  async deleteDefinition(id: string): Promise<boolean> {
    await prisma.customFieldDefinition.delete({ where: { id } });
    return true;
  }

  async setValues(productId: string, values: Record<string, string>): Promise<void> {
    const definitions = await prisma.customFieldDefinition.findMany();
    const defMap = new Map(definitions.map((d) => [d.fieldKey, d.id]));

    for (const [key, value] of Object.entries(values)) {
      const defId = defMap.get(key);
      if (defId) {
        await prisma.customFieldValue.upsert({
          where: {
            productId_fieldDefinitionId: {
              productId,
              fieldDefinitionId: defId,
            },
          },
          update: { fieldValue: String(value) },
          create: {
            productId,
            fieldDefinitionId: defId,
            fieldValue: String(value),
          },
        });
      }
    }
  }

  async getValuesForProduct(productId: string): Promise<Record<string, string>> {
    const values = await prisma.customFieldValue.findMany({
      where: { productId },
      include: { fieldDefinition: true },
    });
    const result: Record<string, string> = {};
    for (const v of values) {
      result[v.fieldDefinition.fieldKey] = v.fieldValue;
    }
    return result;
  }
}

// ==========================================
// 6. Prisma Shop Repository
// ==========================================

export class PrismaShopRepository implements IShopRepository {
  async getProfile(): Promise<ShopProfile> {
    let profile = await prisma.shopProfile.findFirst();
    if (!profile) {
      profile = await prisma.shopProfile.create({
        data: {
          slug: 'tradestock-demo-shop',
          name: 'TradeStock Hardware & Sanitary',
          email: 'owner@tradestock.com',
          phone: '+91 98765 43210',
          address: 'Shop No. 12, Market Yard, Hardware Lane, Hyderabad, India',
          currencySymbol: '₹',
          receiptFooterMessage: 'Goods once sold cannot be taken back without original bill. Thank you!',
        },
      });
    }

    return {
      id: profile.id,
      slug: profile.slug,
      name: profile.name,
      email: profile.email,
      phone: profile.phone ?? undefined,
      address: profile.address ?? undefined,
      currencySymbol: profile.currencySymbol,
      receiptFooterMessage: profile.receiptFooterMessage ?? undefined,
      createdAt: toIsoString(profile.createdAt),
    };
  }

  async updateProfile(profileUpdates: Partial<ShopProfile>): Promise<ShopProfile> {
    let profile = await prisma.shopProfile.findFirst();
    if (!profile) {
      await this.getProfile();
      profile = (await prisma.shopProfile.findFirst())!;
    }

    const updated = await prisma.shopProfile.update({
      where: { id: profile.id },
      data: {
        name: profileUpdates.name !== undefined ? profileUpdates.name : profile.name,
        email: profileUpdates.email !== undefined ? profileUpdates.email : profile.email,
        phone: profileUpdates.phone !== undefined ? profileUpdates.phone : profile.phone,
        address: profileUpdates.address !== undefined ? profileUpdates.address : profile.address,
        currencySymbol: profileUpdates.currencySymbol !== undefined ? profileUpdates.currencySymbol : profile.currencySymbol,
        receiptFooterMessage: profileUpdates.receiptFooterMessage !== undefined ? profileUpdates.receiptFooterMessage : profile.receiptFooterMessage,
      },
    });

    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      email: updated.email,
      phone: updated.phone ?? undefined,
      address: updated.address ?? undefined,
      currencySymbol: updated.currencySymbol,
      receiptFooterMessage: updated.receiptFooterMessage ?? undefined,
      createdAt: toIsoString(updated.createdAt),
    };
  }
}
