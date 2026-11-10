// src/services/billing.service.ts
import {
  getInvoiceRepository,
  getProductRepository,
  getStockRepository,
  isPrismaConfigured,
} from '@/lib/db/connection-router';
import { prisma, TX_OPTIONS } from '@/lib/db/prisma';
import { mapInvoice } from '@/lib/db/prisma-adapter';
import type { InvoiceListFilter } from '@/lib/db/types';
import { Invoice, InvoiceItem, PaymentMode } from '@/types';
import { assertCustomerForBalance, resolveAmountPaid, round2 } from '@/lib/payments';

const VALID_PAYMENT_MODES: PaymentMode[] = ['CASH', 'UPI'];

export interface RecordPaymentInput {
  amount: number;
  paymentMode?: PaymentMode;
  note?: string;
}

export interface CreateBillItemInput {
  productId: string;
  quantity: number;
}

export interface CreateInvoiceInput {
  customerName?: string;
  customerPhone?: string;
  paymentMode: PaymentMode;
  discountAmount?: number;
  /** Amount received now. Leave out to treat the bill as paid in full. */
  amountPaid?: number;
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

        // Fetch every billed product in ONE round trip instead of 1-2 queries per line.
        const lookupKeys = input.items.map((it) => String(it.productId ?? '').trim());
        const fetchedProducts = await tx.product.findMany({
          where: {
            OR: [
              { id: { in: lookupKeys } },
              { productId: { in: lookupKeys.map((k) => k.toUpperCase()) } },
            ],
          },
        });
        const byKey = new Map<string, (typeof fetchedProducts)[number]>();
        for (const p of fetchedProducts) {
          byKey.set(p.id, p);
          byKey.set(p.productId.toUpperCase(), p);
        }
        // Running stock per product so the same product on two lines stays correct.
        const runningStock = new Map<string, number>();

        for (const itemInput of input.items) {
          if (itemInput.quantity <= 0 || !isFinite(itemInput.quantity)) {
            throw new Error('Quantity must be a positive finite number for all items.');
          }

          const key = String(itemInput.productId ?? '').trim();
          const product = byKey.get(key) ?? byKey.get(key.toUpperCase());
          if (!product) {
            throw new Error(`Product not found.`);
          }

          const stockBefore = runningStock.has(product.id)
            ? (runningStock.get(product.id) as number)
            : Number(product.stockQuantity);
          if (stockBefore < itemInput.quantity) {
            throw new Error(
              `Insufficient stock for "${product.name}" (${product.productId}). Available: ${stockBefore}, Requested: ${itemInput.quantity}`
            );
          }

          const lineTotal = Math.round(Number(product.sellingPrice) * Number(itemInput.quantity) * 100) / 100;
          subtotal += lineTotal;

          // Deduct stock atomically within transaction using conditional update to eliminate race conditions
          const updateResult = await tx.product.updateMany({
            where: {
              id: product.id,
              stockQuantity: { gte: itemInput.quantity },
            },
            data: {
              stockQuantity: { decrement: itemInput.quantity },
            },
          });

          if (updateResult.count === 0) {
            throw new Error(
              `Insufficient stock for "${product.name}" (${product.productId}). Available: ${stockBefore}, Requested: ${itemInput.quantity}`
            );
          }

          const stockAfter = Math.round((stockBefore - itemInput.quantity) * 1000) / 1000;
          runningStock.set(product.id, stockAfter);

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

        const rawDiscount = Number(input.discountAmount ?? 0);
        if (isNaN(rawDiscount) || !isFinite(rawDiscount) || rawDiscount < 0) {
          throw new Error('Discount amount must be a valid non-negative number.');
        }
        if (rawDiscount > subtotal) {
          throw new Error(
            `Discount amount (₹${rawDiscount.toFixed(2)}) cannot exceed the invoice subtotal (₹${subtotal.toFixed(2)}).`
          );
        }
        const discountAmount = Math.round(rawDiscount * 100) / 100;
        const finalTotal = Math.round((subtotal - discountAmount) * 100) / 100;
        const amountPaid = resolveAmountPaid(input.amountPaid, finalTotal);
        const balanceDue = round2(finalTotal - amountPaid);
        assertCustomerForBalance(balanceDue, input.customerName, input.customerPhone);
        const billDate = new Date();

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
            billDate,
            customerName: input.customerName?.trim() || undefined,
            customerPhone: input.customerPhone?.trim() || undefined,
            paymentMode: input.paymentMode,
            subtotal: Math.round(subtotal * 100) / 100,
            discountAmount,
            finalTotal,
            amountPaid,
            balanceDue,
            status: 'COMPLETED',
            notes: input.notes?.trim() || undefined,
            payments:
              amountPaid > 0
                ? {
                    create: [
                      {
                        type: 'PAYMENT',
                        amount: amountPaid,
                        paymentMode: input.paymentMode,
                        note: 'Paid at billing',
                        paidAt: billDate,
                      },
                    ],
                  }
                : undefined,
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
            payments: { orderBy: { paidAt: 'asc' } },
          },
        });

        // Record all stock transactions in a single insert
        await tx.stockTransaction.createMany({
          data: validatedItems.map((item) => ({
            productId: item.productId,
            transactionType: 'SALE',
            quantityChange: -item.quantity,
            stockBefore: item.stockBefore,
            stockAfter: item.stockAfter,
            referenceId: invoice.id,
            referenceType: 'INVOICE',
            notes: `Invoice ${invoice.invoiceNumber}`,
          })),
        });

        return mapInvoice(invoice);
      }, TX_OPTIONS);
    }

    // ==============================================================
    // Local Adapter Flow (with strict pre-validation & rollback guard)
    // ==============================================================
    const validatedItems: Omit<InvoiceItem, 'id' | 'invoiceId'>[] = [];
    let subtotal = 0;

    for (const itemInput of input.items) {
      if (itemInput.quantity <= 0 || !isFinite(itemInput.quantity)) {
        throw new Error('Quantity must be a positive finite number for all items.');
      }

      let product = await this.productRepo.findById(itemInput.productId);
      if (!product) {
        product = await this.productRepo.findByProductId(itemInput.productId);
      }
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

    const rawDiscount = Number(input.discountAmount ?? 0);
    if (isNaN(rawDiscount) || !isFinite(rawDiscount) || rawDiscount < 0) {
      throw new Error('Discount amount must be a valid non-negative number.');
    }
    if (rawDiscount > subtotal) {
      throw new Error(
        `Discount amount (₹${rawDiscount.toFixed(2)}) cannot exceed the invoice subtotal (₹${subtotal.toFixed(2)}).`
      );
    }
    const discountAmount = Math.round(rawDiscount * 100) / 100;
    const finalTotal = Math.round((subtotal - discountAmount) * 100) / 100;
    const amountPaid = resolveAmountPaid(input.amountPaid, finalTotal);
    const balanceDue = round2(finalTotal - amountPaid);
    assertCustomerForBalance(balanceDue, input.customerName, input.customerPhone);

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
        amountPaid,
        balanceDue,
        paymentStatus: balanceDue <= 0 ? 'PAID' : amountPaid > 0 ? 'PARTIAL' : 'UNPAID',
        status: 'COMPLETED',
        notes: input.notes?.trim() || undefined,
      },
      validatedItems
    );

    // Atomically deduct stock with rollback guard on persistence failure
    const deductedItems: { productId: string; quantity: number }[] = [];
    try {
      for (const item of validatedItems) {
        await this.stockRepo.updateStockAtomically(
          item.productId,
          -item.quantity,
          'SALE',
          invoice.id,
          `Invoice ${invoice.invoiceNumber}`
        );
        deductedItems.push({ productId: item.productId, quantity: item.quantity });
      }
    } catch (stockErr) {
      // Revert already deducted stock items
      for (const d of deductedItems) {
        try {
          await this.stockRepo.updateStockAtomically(
            d.productId,
            d.quantity,
            'ADJUSTMENT',
            invoice.id,
            `Rollback failed invoice ${invoice.invoiceNumber}`
          );
        } catch {}
      }
      // Remove partial invoice from local database
      try {
        const { LocalDatabaseManager } = await import('@/lib/db/local-adapter');
        const db = LocalDatabaseManager.getInstance();
        const invoices = db.getData().invoices;
        const idx = invoices.findIndex((i) => i.id === invoice.id);
        if (idx !== -1) {
          invoices.splice(idx, 1);
          db.persist();
        }
      } catch {}
      throw stockErr;
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
            payments: { orderBy: { paidAt: 'asc' } },
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

        const rawDiscount = input.discountAmount !== undefined ? Number(input.discountAmount) : Number(originalInvoice.discountAmount);
        if (isNaN(rawDiscount) || !isFinite(rawDiscount) || rawDiscount < 0) {
          throw new Error('Discount amount must be a valid non-negative number.');
        }
        if (rawDiscount > subtotal) {
          throw new Error(
            `Discount amount (₹${rawDiscount.toFixed(2)}) cannot exceed the invoice subtotal (₹${subtotal.toFixed(2)}).`
          );
        }
        const discountAmount = Math.round(rawDiscount * 100) / 100;
        const finalTotal = Math.round((subtotal - discountAmount) * 100) / 100;

        // Keep what was already collected; if the new total is lower, the extra is refunded.
        // A bill that was fully paid stays fully paid: any increase is collected with the edit.
        const previouslyPaid = round2(Number(originalInvoice.amountPaid ?? originalInvoice.finalTotal));
        const wasFullyPaid = round2(Number(originalInvoice.balanceDue ?? 0)) <= 0;
        const refundOnEdit = round2(Math.max(0, previouslyPaid - finalTotal));
        const extraPaidOnEdit = wasFullyPaid ? round2(Math.max(0, finalTotal - previouslyPaid)) : 0;
        const amountPaid = round2(previouslyPaid - refundOnEdit + extraPaidOnEdit);
        const balanceDue = round2(Math.max(0, finalTotal - amountPaid));
        const effectivePaymentMode = input.paymentMode !== undefined ? input.paymentMode : originalInvoice.paymentMode;
        assertCustomerForBalance(
          balanceDue,
          input.customerName !== undefined ? input.customerName : originalInvoice.customerName ?? undefined,
          input.customerPhone !== undefined ? input.customerPhone : originalInvoice.customerPhone ?? undefined
        );

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
            amountPaid,
            balanceDue,
            status: 'EDITED',
            notes: input.notes !== undefined ? input.notes : originalInvoice.notes,
            payments:
              refundOnEdit > 0 || extraPaidOnEdit > 0
                ? {
                    create: [
                      refundOnEdit > 0
                        ? {
                            type: 'REFUND',
                            amount: -refundOnEdit,
                            paymentMode: effectivePaymentMode,
                            note: 'Refund after bill was edited',
                          }
                        : {
                            type: 'PAYMENT',
                            amount: extraPaidOnEdit,
                            paymentMode: effectivePaymentMode,
                            note: 'Extra amount paid after bill was edited',
                          },
                    ],
                  }
                : undefined,
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
            payments: { orderBy: { paidAt: 'asc' } },
          },
        });

        return mapInvoice(updated!);
      }, TX_OPTIONS);
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

    const rawDiscount = input.discountAmount !== undefined ? Number(input.discountAmount) : Number(originalInvoice.discountAmount);
    if (isNaN(rawDiscount) || !isFinite(rawDiscount) || rawDiscount < 0) {
      throw new Error('Discount amount must be a valid non-negative number.');
    }
    if (rawDiscount > subtotal) {
      throw new Error(
        `Discount amount (₹${rawDiscount.toFixed(2)}) cannot exceed the invoice subtotal (₹${subtotal.toFixed(2)}).`
      );
    }
    const discountAmount = Math.round(rawDiscount * 100) / 100;
    const finalTotal = Math.round((subtotal - discountAmount) * 100) / 100;

    // Keep what was already collected; if the new total is lower, the extra is refunded.
    // A bill that was fully paid stays fully paid: any increase is collected with the edit.
    const previouslyPaid = round2(originalInvoice.amountPaid);
    const wasFullyPaid = round2(originalInvoice.balanceDue) <= 0;
    const refundOnEdit = round2(Math.max(0, previouslyPaid - finalTotal));
    const extraPaidOnEdit = wasFullyPaid ? round2(Math.max(0, finalTotal - previouslyPaid)) : 0;
    const amountPaid = round2(previouslyPaid - refundOnEdit + extraPaidOnEdit);
    const balanceDue = round2(Math.max(0, finalTotal - amountPaid));
    const effectivePaymentMode = input.paymentMode !== undefined ? input.paymentMode : originalInvoice.paymentMode;
    assertCustomerForBalance(
      balanceDue,
      input.customerName !== undefined ? input.customerName : originalInvoice.customerName,
      input.customerPhone !== undefined ? input.customerPhone : originalInvoice.customerPhone
    );

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
        amountPaid,
        balanceDue,
        paymentStatus: balanceDue <= 0 ? 'PAID' : amountPaid > 0 ? 'PARTIAL' : 'UNPAID',
        payments:
          refundOnEdit > 0 || extraPaidOnEdit > 0
            ? [
                ...(originalInvoice.payments ?? []),
                {
                  id: 'pay_' + Math.random().toString(36).substring(2, 9),
                  invoiceId: originalInvoice.id,
                  type: refundOnEdit > 0 ? 'REFUND' : 'PAYMENT',
                  amount: refundOnEdit > 0 ? -refundOnEdit : extraPaidOnEdit,
                  paymentMode: effectivePaymentMode,
                  note: refundOnEdit > 0 ? 'Refund after bill was edited' : 'Extra amount paid after bill was edited',
                  paidAt: new Date().toISOString(),
                },
              ]
            : originalInvoice.payments,
        notes: input.notes !== undefined ? input.notes : originalInvoice.notes,
      },
      updatedItems
    );
  }

  /** Collect part or all of the remaining balance on a bill. */
  async recordPayment(invoiceId: string, input: RecordPaymentInput): Promise<Invoice> {
    const amount = round2(Number(input.amount));
    if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }
    if (input.paymentMode !== undefined && !VALID_PAYMENT_MODES.includes(input.paymentMode)) {
      throw new Error('Payment mode must be CASH or UPI.');
    }
    const note = input.note?.toString().trim().slice(0, 200) || undefined;

    if (isPrismaConfigured()) {
      return prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new Error('Invoice not found.');
        if (invoice.status === 'CANCELLED') throw new Error('Cannot take a payment on a cancelled invoice.');
        const balance = round2(Number(invoice.balanceDue));
        if (balance <= 0) throw new Error('This invoice is already fully paid.');
        if (amount > balance) {
          throw new Error(`Payment (₹${amount.toFixed(2)}) is more than the balance due (₹${balance.toFixed(2)}).`);
        }

        // Guarded update: fails if another payment changed the balance meanwhile.
        const res = await tx.invoice.updateMany({
          where: { id: invoiceId, balanceDue: invoice.balanceDue },
          data: {
            amountPaid: round2(Number(invoice.amountPaid) + amount),
            balanceDue: round2(balance - amount),
          },
        });
        if (res.count === 0) throw new Error('The balance changed while saving. Please refresh and try again.');

        await tx.invoicePayment.create({
          data: {
            invoiceId,
            type: 'PAYMENT',
            amount,
            paymentMode: input.paymentMode ?? invoice.paymentMode,
            note,
          },
        });

        const updated = await tx.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            items: true,
            returns: { include: { items: true } },
            payments: { orderBy: { paidAt: 'asc' } },
          },
        });
        return mapInvoice(updated!);
      }, TX_OPTIONS);
    }

    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice) throw new Error('Invoice not found.');
    if (invoice.status === 'CANCELLED') throw new Error('Cannot take a payment on a cancelled invoice.');
    if (invoice.balanceDue <= 0) throw new Error('This invoice is already fully paid.');
    if (amount > invoice.balanceDue) {
      throw new Error(
        `Payment (₹${amount.toFixed(2)}) is more than the balance due (₹${invoice.balanceDue.toFixed(2)}).`
      );
    }
    return this.invoiceRepo.applyPaymentChange(
      invoiceId,
      { amountPaid: round2(invoice.amountPaid + amount), balanceDue: round2(invoice.balanceDue - amount) },
      {
        type: 'PAYMENT',
        amount,
        paymentMode: input.paymentMode ?? invoice.paymentMode,
        note,
        paidAt: new Date().toISOString(),
      }
    );
  }

  async getOutstandingSummary() {
    return this.invoiceRepo.getOutstandingSummary();
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    const inv = await this.invoiceRepo.findById(id);
    if (inv) return inv;
    return this.invoiceRepo.findByInvoiceNumber(id);
  }

  async getInvoices(params?: InvoiceListFilter) {
    return this.invoiceRepo.findMany(params);
  }
}

export const billingService = new BillingService();
