// src/lib/db/local-adapter.ts
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
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
import {
  IProductRepository,
  IStockRepository,
  IInvoiceRepository,
  IReturnRepository,
  ICustomFieldRepository,
  IShopRepository,
  ProductFilter,
} from './types';

const DATA_DIR = path.join(process.cwd(), '.tradestock-data');
const DB_FILE = path.join(DATA_DIR, 'shop-database.json');

export interface LocalUserData {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DatabaseSchema {
  profile: ShopProfile;
  products: Product[];
  priceHistory: PriceHistory[];
  stockTransactions: StockTransaction[];
  invoices: Invoice[];
  invoiceReturns: InvoiceReturn[];
  customFieldDefinitions: CustomFieldDefinition[];
  customFieldValues: Record<string, Record<string, string>>; // productId -> { fieldKey: value }
  lastInvoiceSequence: number;
  users?: LocalUserData[];
}

function getInitialData(): DatabaseSchema {
  return {
    profile: {
      id: 'shop_001',
      slug: 'tradestock-demo-shop',
      name: 'TradeStock Hardware & Sanitary',
      email: 'owner@tradestock.com',
      phone: '+91 98765 43210',
      address: 'Shop No. 12, Market Yard, Hardware Lane, Hyderabad, India',
      currencySymbol: '₹',
      receiptFooterMessage: 'Goods once sold cannot be taken back without original bill. Thank you!',
      createdAt: new Date().toISOString(),
    },
    products: [
      {
        id: 'p-001',
        productId: 'HW-0001',
        name: 'Screwdriver Set (5-in-1 Magnetic)',
        size: 'Standard',
        companyBrand: 'Stanley',
        unit: 'Set',
        stockQuantity: 45,
        lowStockLimit: 10,
        mrp: 350,
        purchaseDiscountPercent: 25,
        purchasePrice: 262.5,
        profitMarginPercent: 18.1,
        sellingPrice: 310,
        previousSellingPrice: 290,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'p-002',
        productId: 'HW-0002',
        name: 'Claw Hammer with Fiberglass Handle',
        size: '16 oz',
        companyBrand: 'Bosch',
        unit: 'Pcs',
        stockQuantity: 18,
        lowStockLimit: 5,
        mrp: 550,
        purchaseDiscountPercent: 20,
        purchasePrice: 440,
        profitMarginPercent: 13.64,
        sellingPrice: 500,
        previousSellingPrice: 480,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'p-003',
        productId: 'SN-0001',
        name: 'Health Faucet with 1.2m Flexible Tube',
        size: '1.2 Mtr',
        companyBrand: 'Jaquar',
        unit: 'Set',
        stockQuantity: 14,
        lowStockLimit: 4,
        mrp: 1250,
        purchaseDiscountPercent: 30,
        purchasePrice: 875,
        profitMarginPercent: 14.17,
        sellingPrice: 999,
        previousSellingPrice: 950,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'p-004',
        productId: 'SN-0002',
        name: 'Angle Valve Chrome Plated',
        size: '0.5 inch',
        companyBrand: 'Hindware',
        unit: 'Pcs',
        stockQuantity: 32,
        lowStockLimit: 8,
        mrp: 480,
        purchaseDiscountPercent: 35,
        purchasePrice: 312,
        profitMarginPercent: 21.79,
        sellingPrice: 380,
        previousSellingPrice: 360,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'p-005',
        productId: 'PL-0001',
        name: 'CPVC Elbow 90 Degree',
        size: '1 inch',
        companyBrand: 'Astral',
        unit: 'Pcs',
        stockQuantity: 120,
        lowStockLimit: 25,
        mrp: 45,
        purchaseDiscountPercent: 35,
        purchasePrice: 29.25,
        profitMarginPercent: 19.66,
        sellingPrice: 35,
        previousSellingPrice: 32,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'p-006',
        productId: 'PL-0002',
        name: 'UPVC Brass FTA (Female Threaded Adaptor)',
        size: '0.75 inch x 0.5 inch',
        companyBrand: 'Supreme',
        unit: 'Pcs',
        stockQuantity: 65,
        lowStockLimit: 15,
        mrp: 95,
        purchaseDiscountPercent: 30,
        purchasePrice: 66.5,
        profitMarginPercent: 20.3,
        sellingPrice: 80,
        previousSellingPrice: 75,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'p-007',
        productId: 'EL-0001',
        name: 'FR PVC Insulated Copper Wire (90m Roll)',
        size: '1.5 sq mm',
        companyBrand: 'Havells',
        unit: 'Roll',
        stockQuantity: 8,
        lowStockLimit: 3,
        mrp: 2750,
        purchaseDiscountPercent: 22,
        purchasePrice: 2145,
        profitMarginPercent: 11.89,
        sellingPrice: 2400,
        previousSellingPrice: 2350,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'p-008',
        productId: 'EL-0002',
        name: 'Modular Switch 1 Way',
        size: '6A',
        companyBrand: 'Anchor',
        unit: 'Pcs',
        stockQuantity: 80,
        lowStockLimit: 20,
        mrp: 45,
        purchaseDiscountPercent: 28,
        purchasePrice: 32.4,
        profitMarginPercent: 23.46,
        sellingPrice: 40,
        previousSellingPrice: 38,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'p-009',
        productId: 'PT-0001',
        name: 'Acrylic Wall Putty Water Resistant',
        size: '20 Kg',
        companyBrand: 'Asian Paints',
        unit: 'Kg',
        stockQuantity: 6,
        lowStockLimit: 5,
        mrp: 850,
        purchaseDiscountPercent: 15,
        purchasePrice: 722.5,
        profitMarginPercent: 10.73,
        sellingPrice: 800,
        previousSellingPrice: 780,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'p-010',
        productId: 'HW-0003',
        name: 'Stainless Steel Wood Screws (Box of 100)',
        size: '1.5 inch x 8',
        companyBrand: 'General',
        unit: 'Box',
        stockQuantity: 0, // OUT OF STOCK for testing
        lowStockLimit: 5,
        mrp: 180,
        purchaseDiscountPercent: 20,
        purchasePrice: 144,
        profitMarginPercent: 18.06,
        sellingPrice: 170,
        previousSellingPrice: 160,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    priceHistory: [],
    stockTransactions: [],
    invoices: [],
    invoiceReturns: [],
    customFieldDefinitions: [
      {
        id: 'cf-rack',
        fieldKey: 'rack_location',
        label: 'Rack / Shelf No',
        dataType: 'TEXT',
        isRequired: false,
        displayOrder: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'cf-hsn',
        fieldKey: 'supplier_code',
        label: 'Distributor Item Code',
        dataType: 'TEXT',
        isRequired: false,
        displayOrder: 2,
        createdAt: new Date().toISOString(),
      },
    ],
    customFieldValues: {},
    lastInvoiceSequence: 1000,
    users: [
      {
        id: 'user_owner_001',
        email: 'owner@tradestock.com',
        passwordHash: bcrypt.hashSync('password123', 10),
        name: 'Shop Owner',
        role: 'OWNER',
        phone: '+91 98765 43210',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}

export class LocalDatabaseManager {
  private static instance: LocalDatabaseManager;
  private data: DatabaseSchema;
  private isLoaded = false;

  private constructor() {
    this.data = getInitialData();
    this.load();
  }

  public static getInstance(): LocalDatabaseManager {
    if (!LocalDatabaseManager.instance) {
      LocalDatabaseManager.instance = new LocalDatabaseManager();
    }
    return LocalDatabaseManager.instance;
  }

  private load(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.users || this.data.users.length === 0) {
          this.data.users = getInitialData().users;
          this.save();
        }
      } else {
        this.save();
      }
      this.isLoaded = true;
    } catch (err) {
      console.error('Error loading local database:', err);
      this.data = getInitialData();
    }
  }

  private save(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving local database:', err);
    }
  }

  public getData(): DatabaseSchema {
    if (!this.isLoaded) this.load();
    return this.data;
  }

  public persist(): void {
    this.save();
  }

  public getUserByEmail(email: string): LocalUserData | null {
    const users = this.getData().users || [];
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  public updateUser(email: string, updates: Partial<LocalUserData>): LocalUserData | null {
    const data = this.getData();
    if (!data.users) data.users = [];
    const idx = data.users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
    if (idx === -1) return null;
    data.users[idx] = {
      ...data.users[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
    return data.users[idx];
  }
}

export class LocalProductRepository implements IProductRepository {
  private db = LocalDatabaseManager.getInstance();

  async findById(id: string): Promise<Product | null> {
    const p = this.db.getData().products.find((prod) => prod.id === id);
    return p ? { ...p } : null;
  }

  async findByProductId(productId: string): Promise<Product | null> {
    const p = this.db.getData().products.find(
      (prod) => prod.productId.trim().toUpperCase() === productId.trim().toUpperCase()
    );
    return p ? { ...p } : null;
  }

  async findMany(filter?: ProductFilter): Promise<{ products: Product[]; totalCount: number }> {
    let prods = [...this.db.getData().products];

    if (filter?.isActive !== undefined) {
      prods = prods.filter((p) => p.isActive === filter.isActive);
    } else {
      prods = prods.filter((p) => p.isActive);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      prods = prods.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.productId.toLowerCase().includes(q) ||
          p.companyBrand.toLowerCase().includes(q) ||
          p.size.toLowerCase().includes(q)
      );
    }

    // Brand filtering (handles "Unbranded" explicitly)
    if (filter?.brand) {
      const targetBrand = filter.brand.trim().toLowerCase();
      if (
        targetBrand === 'unbranded' ||
        targetBrand === '(no brand)' ||
        targetBrand === '__unbranded__'
      ) {
        prods = prods.filter((p) => !p.companyBrand || p.companyBrand.trim() === '');
      } else {
        prods = prods.filter(
          (p) => p.companyBrand && p.companyBrand.trim().toLowerCase() === targetBrand
        );
      }
    }

    // Size filtering
    if (filter?.size) {
      const targetSize = filter.size.trim().toLowerCase();
      prods = prods.filter((p) => p.size && p.size.trim().toLowerCase() === targetSize);
    }

    // Unit filtering
    if (filter?.unit) {
      const targetUnit = filter.unit.trim().toLowerCase();
      prods = prods.filter((p) => p.unit && p.unit.trim().toLowerCase() === targetUnit);
    }

    // Stock Status filtering
    if (filter?.stockStatus) {
      if (filter.stockStatus === 'outOfStock') {
        prods = prods.filter((p) => p.stockQuantity <= 0);
      } else if (filter.stockStatus === 'lowStock') {
        prods = prods.filter((p) => p.stockQuantity <= p.lowStockLimit && p.stockQuantity > 0);
      } else if (filter.stockStatus === 'inStock') {
        prods = prods.filter((p) => p.stockQuantity > p.lowStockLimit);
      }
    } else {
      if (filter?.lowStockOnly) {
        prods = prods.filter((p) => p.stockQuantity <= p.lowStockLimit && p.stockQuantity > 0);
      }
      if (filter?.outOfStockOnly) {
        prods = prods.filter((p) => p.stockQuantity <= 0);
      }
    }

    const totalCount = prods.length;
    if (filter?.offset !== undefined || filter?.limit !== undefined) {
      const offset = filter.offset || 0;
      const limit = filter.limit || 50;
      prods = prods.slice(offset, offset + limit);
    }

    return { products: prods, totalCount };
  }

  async getDistinctFilterOptions(): Promise<{
    brands: string[];
    sizes: string[];
    units: string[];
    totalActiveCount: number;
  }> {
    const activeProducts = this.db.getData().products.filter((p) => p.isActive);
    const brandSet = new Set<string>();
    let hasUnbranded = false;
    const sizeSet = new Set<string>();
    const unitSet = new Set<string>();

    for (const p of activeProducts) {
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
      totalActiveCount: activeProducts.length,
    };
  }

  async create(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const existing = await this.findByProductId(productData.productId);
    if (existing) {
      throw new Error(`Product with ID "${productData.productId}" already exists.`);
    }

    const newProduct: Product = {
      ...productData,
      id: 'prod_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.db.getData().products.push(newProduct);
    this.db.persist();
    return newProduct;
  }

  async update(id: string, updates: Partial<Product>): Promise<Product> {
    const products = this.db.getData().products;
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) throw new Error(`Product not found.`);

    const current = products[index];

    // If selling price changed, preserve previous selling price
    if (
      updates.sellingPrice !== undefined &&
      Number(updates.sellingPrice) !== Number(current.sellingPrice)
    ) {
      updates.previousSellingPrice = current.sellingPrice;
      await this.logPriceHistory({
        productId: current.id,
        oldSellingPrice: current.sellingPrice,
        newSellingPrice: Number(updates.sellingPrice),
        oldPurchasePrice: current.purchasePrice,
        newPurchasePrice: Number(updates.purchasePrice ?? current.purchasePrice),
        changeReason: 'Manual price update',
        changedBy: 'Owner',
      });
    }

    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    products[index] = updated;
    this.db.persist();
    return updated;
  }

  async softDelete(id: string): Promise<boolean> {
    const products = this.db.getData().products;
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return false;

    products[index].isActive = false;
    products[index].updatedAt = new Date().toISOString();
    this.db.persist();
    return true;
  }

  async logPriceHistory(history: Omit<PriceHistory, 'id' | 'changedAt'>): Promise<PriceHistory> {
    const newEntry: PriceHistory = {
      ...history,
      id: 'ph_' + Math.random().toString(36).substring(2, 9),
      changedAt: new Date().toISOString(),
    };
    this.db.getData().priceHistory.push(newEntry);
    this.db.persist();
    return newEntry;
  }

  async getPriceHistory(productId: string): Promise<PriceHistory[]> {
    return this.db
      .getData()
      .priceHistory.filter((ph) => ph.productId === productId)
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  }
}

export class LocalStockRepository implements IStockRepository {
  private db = LocalDatabaseManager.getInstance();

  async recordTransaction(tx: Omit<StockTransaction, 'id' | 'createdAt'>): Promise<StockTransaction> {
    const newTx: StockTransaction = {
      ...tx,
      id: 'stx_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };
    this.db.getData().stockTransactions.push(newTx);
    this.db.persist();
    return newTx;
  }

  async getTransactionsByProduct(productId: string): Promise<StockTransaction[]> {
    return this.db
      .getData()
      .stockTransactions.filter((tx) => tx.productId === productId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAllTransactions(limit: number = 50): Promise<StockTransaction[]> {
    return this.db
      .getData()
      .stockTransactions.slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async updateStockAtomically(
    productId: string,
    quantityChange: number,
    transactionType: StockTransaction['transactionType'],
    referenceId?: string,
    notes?: string
  ): Promise<{ newStock: number; transaction: StockTransaction }> {
    const products = this.db.getData().products;
    const index = products.findIndex((p) => p.id === productId);
    if (index === -1) throw new Error(`Product not found for stock update.`);

    const product = products[index];
    const stockBefore = product.stockQuantity;
    const stockAfter = Math.round((stockBefore + quantityChange) * 1000) / 1000;

    // Concurrency / overselling protection: prevent negative stock on SALE
    if (transactionType === 'SALE' && stockAfter < 0) {
      throw new Error(
        `Insufficient stock for "${product.name}". Available: ${stockBefore}, Requested: ${Math.abs(
          quantityChange
        )}`
      );
    }

    product.stockQuantity = stockAfter;
    product.updatedAt = new Date().toISOString();

    const tx = await this.recordTransaction({
      productId: product.id,
      productName: product.name,
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
    });

    this.db.persist();
    return { newStock: stockAfter, transaction: tx };
  }
}

export class LocalInvoiceRepository implements IInvoiceRepository {
  private db = LocalDatabaseManager.getInstance();

  async findById(id: string): Promise<Invoice | null> {
    const inv = this.db.getData().invoices.find((i) => i.id === id);
    if (!inv) return null;
    const returns = this.db.getData().invoiceReturns.filter((r) => r.invoiceId === id);
    return { ...inv, returns };
  }

  async findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null> {
    const inv = this.db.getData().invoices.find(
      (i) => i.invoiceNumber.trim().toUpperCase() === invoiceNumber.trim().toUpperCase()
    );
    return inv ? { ...inv } : null;
  }

  async findMany(filter?: {
    startDate?: string;
    endDate?: string;
    customerSearch?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ invoices: Invoice[]; totalCount: number }> {
    let invoices = [...this.db.getData().invoices];

    if (filter?.startDate) {
      const s = new Date(filter.startDate).getTime();
      invoices = invoices.filter((i) => new Date(i.billDate).getTime() >= s);
    }
    if (filter?.endDate) {
      const e = new Date(filter.endDate).getTime();
      invoices = invoices.filter((i) => new Date(i.billDate).getTime() <= e);
    }
    if (filter?.customerSearch) {
      const q = filter.customerSearch.toLowerCase();
      invoices = invoices.filter(
        (i) =>
          (i.customerName && i.customerName.toLowerCase().includes(q)) ||
          (i.customerPhone && i.customerPhone.includes(q)) ||
          i.invoiceNumber.toLowerCase().includes(q)
      );
    }

    invoices.sort((a, b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime());

    const totalCount = invoices.length;
    if (filter?.offset !== undefined || filter?.limit !== undefined) {
      const offset = filter.offset || 0;
      const limit = filter.limit || 50;
      invoices = invoices.slice(offset, offset + limit);
    }

    return { invoices, totalCount };
  }

  async generateNextInvoiceNumber(): Promise<string> {
    // Atomic sequential numbering
    const data = this.db.getData();
    data.lastInvoiceSequence = (data.lastInvoiceSequence || 1000) + 1;
    this.db.persist();
    return `INV-${String(data.lastInvoiceSequence).padStart(6, '0')}`;
  }

  async create(
    invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'items'>,
    items: Omit<InvoiceItem, 'id' | 'invoiceId'>[]
  ): Promise<Invoice> {
    const invoiceId = 'inv_' + Math.random().toString(36).substring(2, 9);
    const invoiceItems: InvoiceItem[] = items.map((it) => ({
      ...it,
      id: 'item_' + Math.random().toString(36).substring(2, 9),
      invoiceId,
    }));

    const newInvoice: Invoice = {
      ...invoiceData,
      id: invoiceId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: invoiceItems,
      returns: [],
    };

    this.db.getData().invoices.push(newInvoice);
    this.db.persist();
    return newInvoice;
  }

  async update(
    id: string,
    updates: Partial<Invoice>,
    newItems?: Omit<InvoiceItem, 'id' | 'invoiceId'>[]
  ): Promise<Invoice> {
    const invoices = this.db.getData().invoices;
    const index = invoices.findIndex((i) => i.id === id);
    if (index === -1) throw new Error(`Invoice not found.`);

    const current = invoices[index];
    let updatedItems = current.items;

    if (newItems) {
      updatedItems = newItems.map((it) => ({
        ...it,
        id: 'item_' + Math.random().toString(36).substring(2, 9),
        invoiceId: id,
      }));
    }

    const updated: Invoice = {
      ...current,
      ...updates,
      items: updatedItems,
      status: 'EDITED',
      updatedAt: new Date().toISOString(),
    };

    invoices[index] = updated;
    this.db.persist();
    return updated;
  }

  async getMonthlySummary(year: number, month: number): Promise<MonthlyBillingSummary> {
    // month is 1-indexed (1-12)
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const monthLabel = `${monthNames[month - 1]} ${year}`;

    const invoices = this.db.getData().invoices.filter((inv) => {
      const d = new Date(inv.billDate);
      return d.getFullYear() === year && d.getMonth() + 1 === month && inv.status !== 'CANCELLED';
    });

    invoices.sort((a, b) => new Date(a.billDate).getTime() - new Date(b.billDate).getTime());

    const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.finalTotal), 0);

    return {
      month: monthLabel,
      totalInvoices: invoices.length,
      totalSales: Math.round(totalSales * 100) / 100,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        billDate: inv.billDate,
        finalTotal: Number(inv.finalTotal),
        paymentMode: inv.paymentMode,
      })),
    };
  }

  async getProductSalesSummary(
    productId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ProductSalesSummary> {
    const products = this.db.getData().products;
    const product = products.find((p) => p.id === productId);
    if (!product) throw new Error(`Product not found.`);

    let matchingInvoices = this.db.getData().invoices.filter((i) => i.status !== 'CANCELLED');
    if (startDate) {
      const s = new Date(startDate).getTime();
      matchingInvoices = matchingInvoices.filter((i) => new Date(i.billDate).getTime() >= s);
    }
    if (endDate) {
      const e = new Date(endDate).getTime();
      matchingInvoices = matchingInvoices.filter((i) => new Date(i.billDate).getTime() <= e);
    }

    const invoiceEntries: ProductSalesSummary['invoices'] = [];
    let totalQuantity = 0;
    let totalRevenue = 0;

    for (const inv of matchingInvoices) {
      const item = inv.items.find((it) => it.productId === productId);
      if (item) {
        totalQuantity += Number(item.quantity);
        totalRevenue += Number(item.lineTotal);
        invoiceEntries.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          date: inv.billDate,
          quantity: Number(item.quantity),
          sellingPrice: Number(item.sellingPriceSnapshot),
          lineTotal: Number(item.lineTotal),
        });
      }
    }

    return {
      productId: product.id,
      productCode: product.productId,
      name: product.name,
      size: product.size,
      totalQuantitySold: Math.round(totalQuantity * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      invoices: invoiceEntries.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    };
  }

  async getDashboardStats(startDate?: string, endDate?: string): Promise<DashboardStats> {
    const products = this.db.getData().products.filter((p) => p.isActive);
    const lowStockCount = products.filter(
      (p) => p.stockQuantity <= p.lowStockLimit && p.stockQuantity > 0
    ).length;
    const outOfStockCount = products.filter((p) => p.stockQuantity <= 0).length;

    // Today's invoices
    const today = new Date().toISOString().split('T')[0];
    const todayInvoices = this.db.getData().invoices.filter((inv) => {
      const invDate = new Date(inv.billDate).toISOString().split('T')[0];
      return invDate === today && inv.status !== 'CANCELLED';
    });

    const todaySales = todayInvoices.reduce((sum, inv) => sum + Number(inv.finalTotal), 0);

    // Selected period
    let periodInvoices = this.db.getData().invoices.filter((inv) => inv.status !== 'CANCELLED');
    if (startDate) {
      const s = new Date(startDate).getTime();
      periodInvoices = periodInvoices.filter((i) => new Date(i.billDate).getTime() >= s);
    }
    if (endDate) {
      const e = new Date(endDate).getTime();
      periodInvoices = periodInvoices.filter((i) => new Date(i.billDate).getTime() <= e);
    }

    const selectedPeriodSales = periodInvoices.reduce(
      (sum, inv) => sum + Number(inv.finalTotal),
      0
    );

    return {
      totalProducts: products.length,
      lowStockCount,
      outOfStockCount,
      todaySalesAmount: Math.round(todaySales * 100) / 100,
      todayInvoiceCount: todayInvoices.length,
      selectedPeriodSalesAmount: Math.round(selectedPeriodSales * 100) / 100,
      selectedPeriodInvoiceCount: periodInvoices.length,
    };
  }
}

export class LocalReturnRepository implements IReturnRepository {
  private db = LocalDatabaseManager.getInstance();

  async createReturn(
    invoiceId: string,
    items: { invoiceItemId: string; productId: string; quantity: number; refundAmount: number }[],
    reason?: string
  ): Promise<InvoiceReturn> {
    const invoice = this.db.getData().invoices.find((i) => i.id === invoiceId);
    if (!invoice) throw new Error(`Invoice not found for return.`);

    const returnNumber = `RET-${String(this.db.getData().invoiceReturns.length + 1).padStart(6, '0')}`;
    const returnId = 'ret_' + Math.random().toString(36).substring(2, 9);

    const totalRefund = items.reduce((sum, it) => sum + it.refundAmount, 0);

    const returnItems = items.map((it) => {
      const originalItem = invoice.items.find((orig) => orig.id === it.invoiceItemId);
      return {
        id: 'ritem_' + Math.random().toString(36).substring(2, 9),
        returnId,
        invoiceItemId: it.invoiceItemId,
        productId: it.productId,
        productNameSnapshot: originalItem?.productNameSnapshot || 'Product',
        quantity: it.quantity,
        unitPriceSnapshot: originalItem?.sellingPriceSnapshot || 0,
        refundAmount: it.refundAmount,
      };
    });

    const newReturn: InvoiceReturn = {
      id: returnId,
      invoiceId,
      returnNumber,
      totalReturnedAmount: Math.round(totalRefund * 100) / 100,
      reason,
      createdAt: new Date().toISOString(),
      items: returnItems,
    };

    this.db.getData().invoiceReturns.push(newReturn);
    this.db.persist();
    return newReturn;
  }

  async getReturnsByInvoice(invoiceId: string): Promise<InvoiceReturn[]> {
    return this.db.getData().invoiceReturns.filter((r) => r.invoiceId === invoiceId);
  }
}

export class LocalCustomFieldRepository implements ICustomFieldRepository {
  private db = LocalDatabaseManager.getInstance();

  async getDefinitions(): Promise<CustomFieldDefinition[]> {
    return [...this.db.getData().customFieldDefinitions].sort(
      (a, b) => a.displayOrder - b.displayOrder
    );
  }

  async createDefinition(
    def: Omit<CustomFieldDefinition, 'id' | 'createdAt'>
  ): Promise<CustomFieldDefinition> {
    const existing = this.db
      .getData()
      .customFieldDefinitions.find((d) => d.fieldKey.toLowerCase() === def.fieldKey.toLowerCase());
    if (existing) {
      throw new Error(`Column "${def.label}" (key: ${def.fieldKey}) already exists.`);
    }

    const newDef: CustomFieldDefinition = {
      ...def,
      id: 'cf_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };

    this.db.getData().customFieldDefinitions.push(newDef);
    this.db.persist();
    return newDef;
  }

  async deleteDefinition(id: string): Promise<boolean> {
    const defs = this.db.getData().customFieldDefinitions;
    const index = defs.findIndex((d) => d.id === id);
    if (index === -1) return false;

    defs.splice(index, 1);

    // Clean up stored values
    const allValues = this.db.getData().customFieldValues;
    for (const prodId of Object.keys(allValues)) {
      delete allValues[prodId][id];
    }

    this.db.persist();
    return true;
  }

  async setValues(productId: string, values: Record<string, string>): Promise<void> {
    if (!this.db.getData().customFieldValues[productId]) {
      this.db.getData().customFieldValues[productId] = {};
    }
    Object.assign(this.db.getData().customFieldValues[productId], values);
    this.db.persist();
  }

  async getValuesForProduct(productId: string): Promise<Record<string, string>> {
    return this.db.getData().customFieldValues[productId] || {};
  }
}

export class LocalShopRepository implements IShopRepository {
  private db = LocalDatabaseManager.getInstance();

  async getProfile(): Promise<ShopProfile> {
    return { ...this.db.getData().profile };
  }

  async updateProfile(profile: Partial<ShopProfile>): Promise<ShopProfile> {
    const updated = {
      ...this.db.getData().profile,
      ...profile,
    };
    this.db.getData().profile = updated;
    this.db.persist();
    return updated;
  }
}
