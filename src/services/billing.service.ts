// src/services/billing.service.ts
import {
  getInvoiceRepository,
  getProductRepository,
  getStockRepository,
  isPrismaConfigured,
} from '@/lib/db/connection-router';
import { prisma } from '@/lib/db/prisma';
import { mapInvoice } from '@/lib/db/prisma-adapter';
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

    // ==============================================================
    // PostgreSQL / Prisma Atomic Transaction Flow (Audit Finding #2 & #5)
    // ==============================================================
    if (isPrismaConfigured()) {
      return prisma.$transaction(async (tx) => {
        const validatedItems: {
          productId: string;
          productIdSnapshot: string;
          productNameSnapshot: string;
          sizeSnapshot: string;
          unitSnapshot: string;
          sellingPriceSnapshot: number;
          purchaseCostSnapshot: number;
          quantity: number;
          lineTotal: number;
          stockBefore: number;
          stockAfter: number;
        }[] = [];
        let subtotal = 0;

        for (const itemInput of input.items) {
          if (itemInput.quantity <= 0) {
            throw new Error('Quantity must be greater than zero for all items.');
          }

          const product = await tx.product.findUnique({
            where: { id: itemInput.productId },
          });
          if (!product) {
            throw new Error(`Product not found.`);
          }

          const stockBefore = Number(product.stockQuantity);
          if (stockBefore < itemInput.quantity) {
            throw new Error(
              `Insufficient stock for "${product.name}" (${product.productId}). Available: ${stockBefore}, Requested: ${itemInput.quantity}`
            );
          }

          const stockAfter = Math.round((stockBefore - itemInput.quantity) * 1000) / 1000;
          const lineTotal = Math.round(Number(product.sellingPrice) * Number(itemInput.quantity) * 100) / 100;
          subtotal += lineTotal;

          // Deduct stock atomically within transaction
          await tx.product.update({
            where: { id: product.id },
            data: { stockQuantity: stockAfter },
          });

          validatedItems.push({
            productId: product.id,
            productIdSnapshot: product.productId,
            productNameSnapshot: product.name,
            sizeSnapshot: product.size || '',
            unitSnapshot: product.unit || 'Pcs',
            sellingPriceSnapshot: Number(product.sellingPrice),
            purchaseCostSnapshot: Number(product.purchasePrice),
            quantity: Number(itemInput.quantity),
            lineTotal,
            stockBefore,
            stockAfter,
          });
        }

        const discountAmount = Math.max(0, Number(input.discountAmount) || 0);
        const finalTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

        // Atomic sequential invoice number
        const counter = await tx.sequenceCounter.upsert({
          where: { name: 'INVOICE' },
          update: { currentValue: { increment: 1 } },
          create: { name: 'INVOICE', currentValue: 1 },
        });
        const invoiceNumber = `INV-${String(counter.currentValue).padStart(6, '0')}`;

        // Create invoice & items
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            billDate: new Date(),
            customerName: input.customerName?.trim() || undefined,
            customerPhone: input.customerPhone?.trim() || undefined,
            paymentMode: input.paymentMode,
            subtotal: Math.round(subtotal * 100) / 100,
            discountAmount,
            finalTotal,
            status: 'COMPLETED',
            notes: input.notes?.trim() || undefined,
            items: {
              create: validatedItems.map((it) => ({
                productId: it.productId,
                productIdSnapshot: it.productIdSnapshot,
                productNameSnapshot: it.productNameSnapshot,
                sizeSnapshot: it.sizeSnapshot,
                unitSnapshot: it.unitSnapshot,
                sellingPriceSnapshot: it.sellingPriceSnapshot,
                purchaseCostSnapshot: it.purchaseCostSnapshot,
                quantity: it.quantity,
                lineTotal: it.lineTotal,
              })),
            },
          },
          include: {
            items: true,
            returns: { include: { items: true } },
          },
        });

        // Record stock transactions
        for (const item of validatedItems) {
          await tx.stockTransaction.create({
            data: {
              productId: item.productId,
              transactionType: 'SALE',
              quantityChange: -item.quantity,
              stockBefore: item.stockBefore,
              stockAfter: item.stockAfter,
              referenceId: invoice.id,
              referenceType: 'INVOICE',
              notes: `Invoice ${invoice.invoiceNumber}`,
            },
          });
        }

        return mapInvoice(invoice);
      });
    }

    // ==============================================================
    // Local Adapter Flow (with strict pre-validation & rollback guard)
    // ==============================================================
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

    const invoiceNumber = await this.invoiceRepo.generateNextInvoiceNumber();

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

    // Atomically deduct stock and log SALE transactions
    for (const item of validatedItems) {
      await this.stockRepo.updateStockAtomically(
        item.productId,
        -item.quantity,
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
    if (!input.items || input.items.length === 0) {
      throw new Error('An invoice must contain at least one item.');
    }
    if (input.items.length > 200) {
      throw new Error('An invoice cannot contain more than 200 items.');
    }
    for (const item of input.items) {
      if (!item.quantity || Number(item.quantity) <= 0) {
        throw new Error('Item quantity must be greater than zero for all items.');
      }
    }

    if (isPrismaConfigured()) {
      return prisma.$transaction(async (tx) => {
        const originalInvoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            items: true,
            returns: { include: { items: true } },
          },
        });
        if (!originalInvoice) throw new Error('Invoice not found.');

        if (originalInvoice.returns && originalInvoice.returns.length > 0) {
          throw new Error(
            'Cannot edit an invoice with processed returns. Please process a new return or credit note instead.'
          );
        }

        const oldQtyMap = new Map<string, number>();
        for (const item of originalInvoice.items) {
          oldQtyMap.set(item.productId, (oldQtyMap.get(item.productId) || 0) + Number(item.quantity));
        }

        const newQtyMap = new Map<string, number>();
        for (const item of input.items) {
          newQtyMap.set(item.productId, (newQtyMap.get(item.productId) || 0) + Number(item.quantity));
        }

        const allProductIds = Array.from(new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]));

        // Validate all stock deltas upfront
        for (const prodId of allProductIds) {
          const oldQty = oldQtyMap.get(prodId) || 0;
          const newQty = newQtyMap.get(prodId) || 0;
          const delta = newQty - oldQty;

          if (delta > 0) {
            const prod = await tx.product.findUnique({ where: { id: prodId } });
            if (!prod || Number(prod.stockQuantity) < delta) {
              throw new Error(
                `Cannot increase quantity for "${prod?.name || prodId}". Additional needed: ${delta}, Available in stock: ${prod?.stockQuantity || 0}`
              );
            }
          }
        }

        const updatedItems: {
          productId: string;
          productIdSnapshot: string;
          productNameSnapshot: string;
          sizeSnapshot: string;
          unitSnapshot: string;
          sellingPriceSnapshot: number;
          purchaseCostSnapshot: number;
          quantity: number;
          lineTotal: number;
        }[] = [];
        let subtotal = 0;

        for (const itemInput of input.items) {
          const prod = await tx.product.findUnique({ where: { id: itemInput.productId } });
          if (!prod) throw new Error(`Product not found.`);

          // Preserve historical price snapshots if product was already in this invoice
          const existingItemSnapshot = originalInvoice.items.find(
            (it) => it.productId === itemInput.productId
          );
          const sellingPriceSnapshot = existingItemSnapshot
            ? Number(existingItemSnapshot.sellingPriceSnapshot)
            : Number(prod.sellingPrice);
          const purchaseCostSnapshot = existingItemSnapshot
            ? Number(existingItemSnapshot.purchaseCostSnapshot)
            : Number(prod.purchasePrice);

          const lineTotal = Math.round(sellingPriceSnapshot * Number(itemInput.quantity) * 100) / 100;
          subtotal += lineTotal;

          updatedItems.push({
            productId: prod.id,
            productIdSnapshot: existingItemSnapshot ? existingItemSnapshot.productIdSnapshot : prod.productId,
            productNameSnapshot: existingItemSnapshot ? existingItemSnapshot.productNameSnapshot : prod.name,
            sizeSnapshot: existingItemSnapshot ? existingItemSnapshot.sizeSnapshot : (prod.size || ''),
            unitSnapshot: existingItemSnapshot ? existingItemSnapshot.unitSnapshot : (prod.unit || 'Pcs'),
            sellingPriceSnapshot,
            purchaseCostSnapshot,
            quantity: Number(itemInput.quantity),
            lineTotal,
          });
        }

        const discountAmount = input.discountAmount !== undefined ? input.discountAmount : Number(originalInvoice.discountAmount);
        const finalTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

        // Apply inventory corrections & transaction logs inside transaction
        for (const prodId of allProductIds) {
          const oldQty = oldQtyMap.get(prodId) || 0;
          const newQty = newQtyMap.get(prodId) || 0;
          const delta = newQty - oldQty;

          if (delta !== 0) {
            const product = await tx.product.findUnique({ where: { id: prodId } });
            if (!product) continue;
            const stockBefore = Number(product.stockQuantity);
            const stockAfter = Math.round((stockBefore - delta) * 1000) / 1000;

            await tx.product.update({
              where: { id: prodId },
              data: { stockQuantity: stockAfter },
            });

            await tx.stockTransaction.create({
              data: {
                productId: prodId,
                transactionType: 'ADJUSTMENT',
                quantityChange: -delta,
                stockBefore,
                stockAfter,
                referenceId: originalInvoice.id,
                referenceType: 'INVOICE',
                notes: `Stock adjustment from editing Invoice ${originalInvoice.invoiceNumber}`,
              },
            });
          }
        }

        // Delete existing items and recreate
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: originalInvoice.id },
        });

        await tx.invoice.update({
          where: { id: originalInvoice.id },
          data: {
            customerName: input.customerName !== undefined ? input.customerName : originalInvoice.customerName,
            customerPhone: input.customerPhone !== undefined ? input.customerPhone : originalInvoice.customerPhone,
            paymentMode: input.paymentMode !== undefined ? input.paymentMode : originalInvoice.paymentMode,
            subtotal: Math.round(subtotal * 100) / 100,
            discountAmount,
            finalTotal,
            status: 'EDITED',
            notes: input.notes !== undefined ? input.notes : originalInvoice.notes,
            items: {
              create: updatedItems.map((it) => ({
                productId: it.productId,
                productIdSnapshot: it.productIdSnapshot,
                productNameSnapshot: it.productNameSnapshot,
                sizeSnapshot: it.sizeSnapshot,
                unitSnapshot: it.unitSnapshot,
                sellingPriceSnapshot: it.sellingPriceSnapshot,
                purchaseCostSnapshot: it.purchaseCostSnapshot,
                quantity: it.quantity,
                lineTotal: it.lineTotal,
              })),
            },
          },
        });

        const updated = await tx.invoice.findUnique({
          where: { id: originalInvoice.id },
          include: {
            items: true,
            returns: { include: { items: true } },
          },
        });

        return mapInvoice(updated!);
      });
    }

    const originalInvoice = await this.invoiceRepo.findById(invoiceId);
    if (!originalInvoice) throw new Error('Invoice not found.');

    if (originalInvoice.returns && originalInvoice.returns.length > 0) {
      throw new Error(
        'Cannot edit an invoice with processed returns. Please process a new return or credit note instead.'
      );
    }

    const oldQtyMap = new Map<string, number>();
    for (const item of originalInvoice.items) {
      oldQtyMap.set(item.productId, (oldQtyMap.get(item.productId) || 0) + Number(item.quantity));
    }

    const newQtyMap = new Map<string, number>();
    for (const item of input.items) {
      newQtyMap.set(item.productId, (newQtyMap.get(item.productId) || 0) + Number(item.quantity));
    }

    const allProductIds = Array.from(new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]));

    // Validate all stock deltas upfront
    for (const prodId of allProductIds) {
      const oldQty = oldQtyMap.get(prodId) || 0;
      const newQty = newQtyMap.get(prodId) || 0;
      const delta = newQty - oldQty;

      if (delta > 0) {
        const prod = await this.productRepo.findById(prodId);
        if (!prod || prod.stockQuantity < delta) {
          throw new Error(
            `Cannot increase quantity for "${prod?.name || prodId}". Additional needed: ${delta}, Available in stock: ${prod?.stockQuantity || 0}`
          );
        }
      }
    }

    const updatedItems: Omit<InvoiceItem, 'id' | 'invoiceId'>[] = [];
    let subtotal = 0;

    for (const itemInput of input.items) {
      const prod = await this.productRepo.findById(itemInput.productId);
      if (!prod) throw new Error(`Product not found.`);

      // Preserve historical price snapshots if product was already in this invoice
      const existingItemSnapshot = originalInvoice.items.find(
        (it) => it.productId === itemInput.productId
      );
      const sellingPriceSnapshot = existingItemSnapshot
        ? Number(existingItemSnapshot.sellingPriceSnapshot)
        : Number(prod.sellingPrice);
      const purchaseCostSnapshot = existingItemSnapshot
        ? Number(existingItemSnapshot.purchaseCostSnapshot)
        : Number(prod.purchasePrice);

      const lineTotal = Math.round(sellingPriceSnapshot * Number(itemInput.quantity) * 100) / 100;
      subtotal += lineTotal;

      updatedItems.push({
        productId: prod.id,
        productIdSnapshot: existingItemSnapshot ? existingItemSnapshot.productIdSnapshot : prod.productId,
        productNameSnapshot: existingItemSnapshot ? existingItemSnapshot.productNameSnapshot : prod.name,
        sizeSnapshot: existingItemSnapshot ? existingItemSnapshot.sizeSnapshot : prod.size,
        unitSnapshot: existingItemSnapshot ? existingItemSnapshot.unitSnapshot : prod.unit,
        sellingPriceSnapshot,
        purchaseCostSnapshot,
        quantity: Number(itemInput.quantity),
        lineTotal,
      });
    }

    const discountAmount = input.discountAmount !== undefined ? input.discountAmount : originalInvoice.discountAmount;
    const finalTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    // Apply inventory corrections
    for (const prodId of allProductIds) {
      const oldQty = oldQtyMap.get(prodId) || 0;
      const newQty = newQtyMap.get(prodId) || 0;
      const delta = newQty - oldQty;

      if (delta !== 0) {
        await this.stockRepo.updateStockAtomically(
          prodId,
          -delta,
          'ADJUSTMENT',
          originalInvoice.id,
          `Stock adjustment from editing Invoice ${originalInvoice.invoiceNumber}`
        );
      }
    }

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
    const inv = await this.invoiceRepo.findById(id);
    if (inv) return inv;
    return this.invoiceRepo.findByInvoiceNumber(id);
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
