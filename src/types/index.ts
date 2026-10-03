// src/types/index.ts

export type PaymentMode = 'CASH' | 'UPI';

export type StockTransactionType =
  | 'STOCK_RECEIVED'
  | 'SALE'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'IMPORT_SET';

export type InvoiceStatus = 'COMPLETED' | 'EDITED' | 'CANCELLED';

export type CustomFieldDataType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN';

export interface CustomFieldDefinition {
  id: string;
  fieldKey: string;
  label: string;
  dataType: CustomFieldDataType;
  isRequired: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface CustomFieldValue {
  id: string;
  productId: string;
  fieldDefinitionId: string;
  fieldValue: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  productId: string; // Permanent business identifier e.g. HW-0001
  name: string;
  size: string; // Flexible text e.g. "1.5 inch", "4 inch"
  companyBrand: string;
  unit: string; // "Pcs", "Nos", "Meters", "Feet", "Kg", etc.
  stockQuantity: number;
  lowStockLimit: number;
  mrp: number;
  purchaseDiscountPercent: number;
  purchasePrice: number;
  profitMarginPercent: number;
  sellingPrice: number;
  previousSellingPrice: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  customFields?: Record<string, string>;
}

export interface PriceHistory {
  id: string;
  productId: string;
  oldSellingPrice: number | null;
  newSellingPrice: number;
  oldPurchasePrice: number | null;
  newPurchasePrice: number;
  changeReason?: string;
  changedBy: string;
  changedAt: string;
}

export interface StockTransaction {
  id: string;
  productId: string;
  productName?: string;
  transactionType: StockTransactionType;
  quantityChange: number;
  stockBefore: number;
  stockAfter: number;
  referenceId?: string;
  referenceType?: 'INVOICE' | 'MANUAL' | 'IMPORT' | 'RETURN';
  notes?: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  productIdSnapshot: string;
  productNameSnapshot: string;
  sizeSnapshot: string;
  unitSnapshot: string;
  sellingPriceSnapshot: number;
  purchaseCostSnapshot: number;
  quantity: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. INV-000001
  billDate: string;
  customerName?: string;
  customerPhone?: string;
  paymentMode: PaymentMode;
  subtotal: number;
  discountAmount: number;
  finalTotal: number;
  status: InvoiceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
  returns?: InvoiceReturn[];
}

export interface ReturnItem {
  id: string;
  returnId: string;
  invoiceItemId: string;
  productId: string;
  productNameSnapshot: string;
  quantity: number;
  unitPriceSnapshot: number;
  refundAmount: number;
}

export interface InvoiceReturn {
  id: string;
  invoiceId: string;
  returnNumber: string; // e.g. RET-000001
  totalReturnedAmount: number;
  reason?: string;
  createdAt: string;
  items: ReturnItem[];
}

export interface ShopProfile {
  id: string;
  slug: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  currencySymbol: string;
  receiptFooterMessage?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  todaySalesAmount: number;
  todayInvoiceCount: number;
  selectedPeriodSalesAmount: number;
  selectedPeriodInvoiceCount: number;
}

export interface ProductSalesSummary {
  productId: string;
  productCode: string;
  name: string;
  size: string;
  totalQuantitySold: number;
  totalRevenue: number;
  invoices: {
    invoiceId: string;
    invoiceNumber: string;
    date: string;
    quantity: number;
    sellingPrice: number;
    lineTotal: number;
  }[];
}

export interface MonthlyBillingSummary {
  month: string; // e.g. "October 2026"
  totalInvoices: number;
  totalSales: number;
  invoices: {
    invoiceNumber: string;
    billDate: string;
    finalTotal: number;
    paymentMode: PaymentMode;
  }[];
}

export interface ImportPreviewRow {
  rowNumber: number;
  productId: string;
  name: string;
  size: string;
  companyBrand: string;
  unit: string;
  targetStock: number;
  lowStockLimit: number;
  mrp: number;
  purchaseDiscountPercent: number;
  purchasePrice: number;
  profitMarginPercent: number;
  sellingPrice: number;
  isExisting: boolean;
  currentDbStock?: number;
  stockDelta?: number;
  errors: string[];
  warnings: string[];
}

export interface ImportSummary {
  totalRows: number;
  newProductsCount: number;
  updatedProductsCount: number;
  errorCount: number;
  importedAt: string;
}
