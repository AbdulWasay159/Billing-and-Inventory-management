// src/services/billing.service.ts
import { getInvoiceRepository, getProductRepository, getStockRepository } from '@/lib/db/connection-router';
import { Invoice, InvoiceItem, PaymentMode } from '@/types';

export interface CreateBillItemInput {
  productId: string;
  quantity: number;
}

export interface CreateInvoiceInput {
  customerName?: string;
  customerPhone?: string;
  paymentMode: PaymentMode;
  discountAmount?: number;
  notes?: string;
  items: CreateBillItemInput[];
}

export class BillingService {
  private invoiceRepo = getInvoiceRepository();
  private productRepo = getProductRepository();
  private stockRepo = getStockRepository();

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    if (!input.items || input.items.length === 0) {
      throw new Error('An invoice must contain at least one item.');
    }
    if (input.items.length > 200) {
      throw new Error('An invoice cannot contain more than 200 items.');
    }

    // Step 1: Pre-fetch and validate all products and stock availability
    const validatedItems: Omit<InvoiceItem, 'id' | 'invoiceId'>[] = [];
    let subtotal = 0;

    for (const itemInput of input.items) {
      if (itemInput.quantity <= 0) {
        throw new Error('Quantity must be greater than zero for all items.');
      }

      const product = await this.productRepo.findById(itemInput.productId);
      if (!product) {
        throw new Error(`Product not found.`);
      }

      if (product.stockQuantity < itemInput.quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}" (${product.productId}). Available: ${product.stockQuantity}, Requested: ${itemInput.quantity}`
        );
      }

      const lineTotal = Math.round(Number(product.sellingPrice) * Number(itemInput.quantity) * 100) / 100;
      subtotal += lineTotal;

      validatedItems.push({
        productId: product.id,
        productIdSnapshot: product.productId,
        productNameSnapshot: product.name,
        sizeSnapshot: product.size,
        unitSnapshot: product.unit,
        sellingPriceSnapshot: Number(product.sellingPrice),
        purchaseCostSnapshot: Number(product.purchasePrice),
        quantity: Number(itemInput.quantity),
        lineTotal,
      });
    }

    const discountAmount = Math.max(0, Number(input.discountAmount) || 0);
    const finalTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    // Step 2: Generate sequential invoice number
    const invoiceNumber = await this.invoiceRepo.generateNextInvoiceNumber();

    // Step 3: Create invoice record
    const invoice = await this.invoiceRepo.create(
      {
        invoiceNumber,
        billDate: new Date().toISOString(),
        customerName: input.customerName?.trim() || undefined,
        customerPhone: input.customerPhone?.trim() || undefined,
        paymentMode: input.paymentMode,
        subtotal: Math.round(subtotal * 100) / 100,
        discountAmount,
        finalTotal,
        status: 'COMPLETED',
        notes: input.notes?.trim() || undefined,
      },
      validatedItems
    );

    // Step 4: Atomically deduct stock and log SALE transactions
    for (const item of validatedItems) {
      await this.stockRepo.updateStockAtomically(
        item.productId,
        -item.quantity, // Negative for sale
        'SALE',
        invoice.id,
        `Invoice ${invoice.invoiceNumber}`
      );
    }

    return invoice;
  }

  async editInvoice(
    invoiceId: string,
    input: {
      customerName?: string;
      customerPhone?: string;
      paymentMode?: PaymentMode;
      discountAmount?: number;
      notes?: string;
      items: { productId: string; quantity: number }[];
    }
  ): Promise<Invoice> {
    const originalInvoice = await this.invoiceRepo.findById(invoiceId);
    if (!originalInvoice) throw new Error('Invoice not found.');

    // Build old quantity map
    const oldQtyMap = new Map<string, number>();
    for (const item of originalInvoice.items) {
      oldQtyMap.set(item.productId, (oldQtyMap.get(item.productId) || 0) + Number(item.quantity));
    }

    // Build new quantity map
    const newQtyMap = new Map<string, number>();
    for (const item of input.items) {
      newQtyMap.set(item.productId, (newQtyMap.get(item.productId) || 0) + Number(item.quantity));
    }

    // Step 1: Validate stock deltas
    const allProductIds = Array.from(new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]));
    for (const prodId of allProductIds) {
      const oldQty = oldQtyMap.get(prodId) || 0;
      const newQty = newQtyMap.get(prodId) || 0;
      const delta = newQty - oldQty; // e.g. was 5, now 7 -> delta = +2 (need 2 more from stock)

      if (delta > 0) {
        const prod = await this.productRepo.findById(prodId);
        if (!prod || prod.stockQuantity < delta) {
          throw new Error(
            `Cannot increase quantity for "${prod?.name || prodId}". Additional needed: ${delta}, Available in stock: ${prod?.stockQuantity || 0}`
          );
        }
      }
    }

    // Step 2: Prepare new items list
    const updatedItems: Omit<InvoiceItem, 'id' | 'invoiceId'>[] = [];
    let subtotal = 0;

    for (const itemInput of input.items) {
      const prod = await this.productRepo.findById(itemInput.productId);
      if (!prod) throw new Error(`Product not found.`);

      const lineTotal = Math.round(Number(prod.sellingPrice) * Number(itemInput.quantity) * 100) / 100;
      subtotal += lineTotal;

      updatedItems.push({
        productId: prod.id,
        productIdSnapshot: prod.productId,
        productNameSnapshot: prod.name,
        sizeSnapshot: prod.size,
        unitSnapshot: prod.unit,
        sellingPriceSnapshot: Number(prod.sellingPrice),
        purchaseCostSnapshot: Number(prod.purchasePrice),
        quantity: Number(itemInput.quantity),
        lineTotal,
      });
    }

    const discountAmount = input.discountAmount !== undefined ? input.discountAmount : originalInvoice.discountAmount;
    const finalTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    // Step 3: Apply inventory corrections
    for (const prodId of allProductIds) {
      const oldQty = oldQtyMap.get(prodId) || 0;
      const newQty = newQtyMap.get(prodId) || 0;
      const delta = newQty - oldQty;

      if (delta !== 0) {
        // If delta > 0, we deduct more (change = -delta)
        // If delta < 0, we restore stock (change = -delta, which is positive)
        await this.stockRepo.updateStockAtomically(
          prodId,
          -delta,
          'ADJUSTMENT',
          originalInvoice.id,
          `Stock adjustment from editing Invoice ${originalInvoice.invoiceNumber}`
        );
      }
    }

    // Step 4: Update invoice record
    return this.invoiceRepo.update(
      invoiceId,
      {
        customerName: input.customerName !== undefined ? input.customerName : originalInvoice.customerName,
        customerPhone: input.customerPhone !== undefined ? input.customerPhone : originalInvoice.customerPhone,
        paymentMode: input.paymentMode !== undefined ? input.paymentMode : originalInvoice.paymentMode,
        subtotal: Math.round(subtotal * 100) / 100,
        discountAmount,
        finalTotal,
        notes: input.notes !== undefined ? input.notes : originalInvoice.notes,
      },
      updatedItems
    );
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    return this.invoiceRepo.findById(id);
  }

  async getInvoices(params?: {
    startDate?: string;
    endDate?: string;
    customerSearch?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.invoiceRepo.findMany(params);
  }
}

export const billingService = new BillingService();
