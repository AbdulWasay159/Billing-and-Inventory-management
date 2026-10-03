// src/services/inventory.service.ts
import { getStockRepository, getProductRepository } from '@/lib/db/connection-router';
import { StockTransaction, StockTransactionType } from '@/types';

export class InventoryService {
  private stockRepo = getStockRepository();
  private productRepo = getProductRepository();

  async adjustStock(params: {
    productId: string;
    quantityChange: number;
    transactionType: StockTransactionType;
    referenceId?: string;
    notes?: string;
  }): Promise<{ newStock: number; transaction: StockTransaction }> {
    const product = await this.productRepo.findById(params.productId);
    if (!product) throw new Error('Product not found for inventory adjustment.');

    return this.stockRepo.updateStockAtomically(
      params.productId,
      params.quantityChange,
      params.transactionType,
      params.referenceId,
      params.notes
    );
  }

  async getTransactionsForProduct(productId: string): Promise<StockTransaction[]> {
    return this.stockRepo.getTransactionsByProduct(productId);
  }

  async getRecentTransactions(limit: number = 50): Promise<StockTransaction[]> {
    return this.stockRepo.getAllTransactions(limit);
  }
}

export const inventoryService = new InventoryService();
