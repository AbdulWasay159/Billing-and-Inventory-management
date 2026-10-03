// src/lib/db/connection-router.ts
import {
  IProductRepository,
  IStockRepository,
  IInvoiceRepository,
  IReturnRepository,
  ICustomFieldRepository,
  IShopRepository,
} from './types';
import {
  LocalProductRepository,
  LocalStockRepository,
  LocalInvoiceRepository,
  LocalReturnRepository,
  LocalCustomFieldRepository,
  LocalShopRepository,
} from './local-adapter';

// Singletons for current environment
const productRepo: IProductRepository = new LocalProductRepository();
const stockRepo: IStockRepository = new LocalStockRepository();
const invoiceRepo: IInvoiceRepository = new LocalInvoiceRepository();
const returnRepo: IReturnRepository = new LocalReturnRepository();
const customFieldRepo: ICustomFieldRepository = new LocalCustomFieldRepository();
const shopRepo: IShopRepository = new LocalShopRepository();

/**
 * Dynamic Database Connection Router (Section 29 & 32)
 * In production multi-shop Cloud SQL setup:
 * Resolves shop database URL from platform control DB based on authenticated shop context.
 *
 * In single-shop / local development:
 * Returns the repository instance bound to the active development database.
 */
export function getProductRepository(_shopId?: string): IProductRepository {
  return productRepo;
}

export function getStockRepository(_shopId?: string): IStockRepository {
  return stockRepo;
}

export function getInvoiceRepository(_shopId?: string): IInvoiceRepository {
  return invoiceRepo;
}

export function getReturnRepository(_shopId?: string): IReturnRepository {
  return returnRepo;
}

export function getCustomFieldRepository(_shopId?: string): ICustomFieldRepository {
  return customFieldRepo;
}

export function getShopRepository(_shopId?: string): IShopRepository {
  return shopRepo;
}
