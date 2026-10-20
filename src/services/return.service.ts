// src/services/return.service.ts
import {
  getInvoiceRepository,
  getReturnRepository,
  getStockRepository,
  isPrismaConfigured,
} from '@/lib/db/connection-router';
import { prisma } from '@/lib/db/prisma';
import { mapInvoiceReturn } from '@/lib/db/prisma-adapter';
import { InvoiceReturn } from '@/types';

export interface ProcessReturnInput {
  invoiceId: string;
  reason?: string;
  items: {
    invoiceItemId: string;
    quantity: number;
  }[];
}

export class ReturnService {
  private invoiceRepo = getInvoiceRepository();
  private returnRepo = getReturnRepository();
  private stockRepo = getStockRepository();

  async processReturn(input: ProcessReturnInput): Promise<InvoiceReturn> {
    if (isPrismaConfigured()) {
      return prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({
          where: { id: input.invoiceId },
          include: { items: true },
        });
        if (!invoice) throw new Error('Invoice not found.');

        const existingReturns = await tx.invoiceReturn.findMany({
          where: { invoiceId: input.invoiceId },
          include: { items: true },
        });

        // Compute already returned quantity per invoice item
        const alreadyReturnedMap = new Map<string, number>();
        for (const ret of existingReturns) {
          for (const item of ret.items) {
            alreadyReturnedMap.set(
              item.invoiceItemId,
              (alreadyReturnedMap.get(item.invoiceItemId) || 0) + Number(item.quantity)
            );
          }
        }

        const returnItemsData: {
          invoiceItemId: string;
          productId: string;
          quantity: number;
          refundAmount: number;
          productNameSnapshot: string;
          unitPriceSnapshot: number;
        }[] = [];

        let totalRefund = 0;

        for (const reqItem of input.items) {
          if (reqItem.quantity <= 0) continue;

          const origItem = invoice.items.find((it) => it.id === reqItem.invoiceItemId);
          if (!origItem) throw new Error('Invoice item not found.');

          const alreadyReturned = alreadyReturnedMap.get(origItem.id) || 0;
          const availableToReturn = Number(origItem.quantity) - alreadyReturned;

          if (reqItem.quantity > availableToReturn) {
            throw new Error(
              `Cannot return ${reqItem.quantity} units of "${origItem.productNameSnapshot}". Maximum returnable: ${availableToReturn}`
            );
          }

          alreadyReturnedMap.set(origItem.id, alreadyReturned + reqItem.quantity);

          const refundAmount = Math.round(Number(origItem.sellingPriceSnapshot) * reqItem.quantity * 100) / 100;
          totalRefund += refundAmount;

          returnItemsData.push({
            invoiceItemId: origItem.id,
            productId: origItem.productId,
            quantity: reqItem.quantity,
            refundAmount,
            productNameSnapshot: origItem.productNameSnapshot,
            unitPriceSnapshot: Number(origItem.sellingPriceSnapshot),
          });
        }

        if (returnItemsData.length === 0) {
          throw new Error('Please select at least one item with a valid return quantity.');
        }

        // Atomic Sequence counter for return number
        const counter = await tx.sequenceCounter.upsert({
          where: { name: 'RETURN' },
          update: { currentValue: { increment: 1 } },
          create: { name: 'RETURN', currentValue: 1 },
        });
        const returnNumber = `RET-${String(counter.currentValue).padStart(6, '0')}`;

        // Create return record in tx
        const invoiceReturn = await tx.invoiceReturn.create({
          data: {
            invoiceId: input.invoiceId,
            returnNumber,
            totalReturnedAmount: Math.round(totalRefund * 100) / 100,
            reason: input.reason?.trim() || undefined,
            items: {
              create: returnItemsData.map((it) => ({
                invoiceItemId: it.invoiceItemId,
                productId: it.productId,
                productNameSnapshot: it.productNameSnapshot,
                quantity: it.quantity,
                unitPriceSnapshot: it.unitPriceSnapshot,
                refundAmount: it.refundAmount,
              })),
            },
          },
          include: { items: true },
        });

        // Restore stock and record RETURN transactions in tx
        for (const item of returnItemsData) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) continue;
          const stockBefore = Number(product.stockQuantity);
          const stockAfter = Math.round((stockBefore + item.quantity) * 1000) / 1000;

          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: stockAfter },
          });

          await tx.stockTransaction.create({
            data: {
              productId: item.productId,
              transactionType: 'RETURN',
              quantityChange: item.quantity,
              stockBefore,
              stockAfter,
              referenceId: invoiceReturn.id,
              referenceType: 'RETURN',
              notes: `Return ${invoiceReturn.returnNumber} for Invoice ${invoice.invoiceNumber}`,
            },
          });
        }

        return mapInvoiceReturn(invoiceReturn);
      });
    }

    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice) throw new Error('Invoice not found.');

    const existingReturns = await this.returnRepo.getReturnsByInvoice(input.invoiceId);

    // Compute already returned quantity per invoice item
    const alreadyReturnedMap = new Map<string, number>();
    for (const ret of existingReturns) {
      for (const item of ret.items) {
        alreadyReturnedMap.set(
          item.invoiceItemId,
          (alreadyReturnedMap.get(item.invoiceItemId) || 0) + Number(item.quantity)
        );
      }
    }

    const returnItemsData: {
      invoiceItemId: string;
      productId: string;
      quantity: number;
      refundAmount: number;
    }[] = [];

    for (const reqItem of input.items) {
      if (reqItem.quantity <= 0) continue;

      const origItem = invoice.items.find((it) => it.id === reqItem.invoiceItemId);
      if (!origItem) throw new Error('Invoice item not found.');

      const alreadyReturned = alreadyReturnedMap.get(origItem.id) || 0;
      const availableToReturn = origItem.quantity - alreadyReturned;

      if (reqItem.quantity > availableToReturn) {
        throw new Error(
          `Cannot return ${reqItem.quantity} units of "${origItem.productNameSnapshot}". Maximum returnable: ${availableToReturn}`
        );
      }

      alreadyReturnedMap.set(origItem.id, alreadyReturned + reqItem.quantity);

      const refundAmount = Math.round(Number(origItem.sellingPriceSnapshot) * reqItem.quantity * 100) / 100;

      returnItemsData.push({
        invoiceItemId: origItem.id,
        productId: origItem.productId,
        quantity: reqItem.quantity,
        refundAmount,
      });
    }

    if (returnItemsData.length === 0) {
      throw new Error('Please select at least one item with a valid return quantity.');
    }

    // Step 1: Create return record
    const invoiceReturn = await this.returnRepo.createReturn(
      input.invoiceId,
      returnItemsData,
      input.reason
    );

    // Step 2: Atomically restore stock for returned items
    for (const item of returnItemsData) {
      await this.stockRepo.updateStockAtomically(
        item.productId,
        item.quantity, // Positive to restore stock
        'RETURN',
        invoiceReturn.id,
        `Return ${invoiceReturn.returnNumber} for Invoice ${invoice.invoiceNumber}`
      );
    }

    return invoiceReturn;
  }

  async getReturnsForInvoice(invoiceId: string): Promise<InvoiceReturn[]> {
    return this.returnRepo.getReturnsByInvoice(invoiceId);
  }
}

export const returnService = new ReturnService();
