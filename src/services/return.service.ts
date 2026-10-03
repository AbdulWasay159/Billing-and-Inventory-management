// src/services/return.service.ts
import { getInvoiceRepository, getReturnRepository, getStockRepository } from '@/lib/db/connection-router';
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
