// src/lib/db/types.ts
import {
  Product,
  PriceHistory,
  StockTransaction,
  Invoice,
  InvoiceItem,
  InvoiceReturn,
  CustomFieldDefinition,
  ShopProfile,
  DashboardStats,
  MonthlyBillingSummary,
  ProductSalesSummary,
} from '@/types';

export interface ProductFilter {
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
}

export interface IProductRepository {
  findById(id: string): Promise<Product | null>;
  findByProductId(productId: string): Promise<Product | null>;
  findMany(filter?: ProductFilter): Promise<{ products: Product[]; totalCount: number }>;
  getDistinctFilterOptions(): Promise<{
    brands: string[];
    sizes: string[];
    units: string[];
    totalActiveCount: number;
  }>;
  create(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product>;
  update(id: string, product: Partial<Product>): Promise<Product>;
  softDelete(id: string): Promise<boolean>;
  logPriceHistory(history: Omit<PriceHistory, 'id' | 'changedAt'>): Promise<PriceHistory>;
  getPriceHistory(productId: string): Promise<PriceHistory[]>;
}

export interface IStockRepository {
  recordTransaction(tx: Omit<StockTransaction, 'id' | 'createdAt'>): Promise<StockTransaction>;
  getTransactionsByProduct(productId: string): Promise<StockTransaction[]>;
  getAllTransactions(limit?: number): Promise<StockTransaction[]>;
  updateStockAtomically(
    productId: string,
    quantityChange: number,
    transactionType: StockTransaction['transactionType'],
    referenceId?: string,
    notes?: string
  ): Promise<{ newStock: number; transaction: StockTransaction }>;
}

export interface IInvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null>;
  findMany(filter?: {
    startDate?: string;
    endDate?: string;
    customerSearch?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ invoices: Invoice[]; totalCount: number }>;
  generateNextInvoiceNumber(): Promise<string>;
  create(
    invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'items'>,
    items: Omit<InvoiceItem, 'id' | 'invoiceId'>[]
  ): Promise<Invoice>;
  update(
    id: string,
    updates: Partial<Invoice>,
    newItems?: Omit<InvoiceItem, 'id' | 'invoiceId'>[]
  ): Promise<Invoice>;
  getMonthlySummary(year: number, month: number): Promise<MonthlyBillingSummary>;
  getProductSalesSummary(productId: string, startDate?: string, endDate?: string): Promise<ProductSalesSummary>;
  getDashboardStats(startDate?: string, endDate?: string): Promise<DashboardStats>;
}

export interface IReturnRepository {
  createReturn(
    invoiceId: string,
    items: { invoiceItemId: string; productId: string; quantity: number; refundAmount: number }[],
    reason?: string
  ): Promise<InvoiceReturn>;
  getReturnsByInvoice(invoiceId: string): Promise<InvoiceReturn[]>;
}

export interface ICustomFieldRepository {
  getDefinitions(): Promise<CustomFieldDefinition[]>;
  createDefinition(def: Omit<CustomFieldDefinition, 'id' | 'createdAt'>): Promise<CustomFieldDefinition>;
  deleteDefinition(id: string): Promise<boolean>;
  setValues(productId: string, values: Record<string, string>): Promise<void>;
  getValuesForProduct(productId: string): Promise<Record<string, string>>;
}

export interface IShopRepository {
  getProfile(): Promise<ShopProfile>;
  updateProfile(profile: Partial<ShopProfile>): Promise<ShopProfile>;
}
