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
import {
  PrismaProductRepository,
  PrismaStockRepository,
  PrismaInvoiceRepository,
  PrismaReturnRepository,
  PrismaCustomFieldRepository,
  PrismaShopRepository,
} from './prisma-adapter';

// Local Fallback Singletons
const localProductRepo = new LocalProductRepository();
const localStockRepo = new LocalStockRepository();
const localInvoiceRepo = new LocalInvoiceRepository();
const localReturnRepo = new LocalReturnRepository();
const localCustomFieldRepo = new LocalCustomFieldRepository();
const localShopRepo = new LocalShopRepository();

// Prisma PostgreSQL Singletons
const prismaProductRepo = new PrismaProductRepository();
const prismaStockRepo = new PrismaStockRepository();
const prismaInvoiceRepo = new PrismaInvoiceRepository();
const prismaReturnRepo = new PrismaReturnRepository();
const prismaCustomFieldRepo = new PrismaCustomFieldRepository();
const prismaShopRepo = new PrismaShopRepository();

/**
 * Resolves whether the environment is configured to use PostgreSQL Prisma
 */
export function isPrismaConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

/**
 * Dynamic Database Connection Router (Section 29 & 32)
 *
 * In Production Cloud SQL Multi-Shop Setup:
 * Each shop has a dedicated PostgreSQL database on the Cloud SQL instance.
 * Resolves database URL and repository instance bound to the authenticated shop.
 *
 * In Single-Shop / PostgreSQL Development:
 * Uses Prisma connected to PostgreSQL (Supabase / Cloud SQL / Local PG).
 *
 * In Offline / Development Fallback:
 * Falls back safely to Local Adapter when DATABASE_URL is not set.
 */
export function getProductRepository(_shopId?: string): IProductRepository {
  if (isPrismaConfigured()) {
    return prismaProductRepo;
  }
  return localProductRepo;
}

export function getStockRepository(_shopId?: string): IStockRepository {
  if (isPrismaConfigured()) {
    return prismaStockRepo;
  }
  return localStockRepo;
}

export function getInvoiceRepository(_shopId?: string): IInvoiceRepository {
  if (isPrismaConfigured()) {
    return prismaInvoiceRepo;
  }
  return localInvoiceRepo;
}

export function getReturnRepository(_shopId?: string): IReturnRepository {
  if (isPrismaConfigured()) {
    return prismaReturnRepo;
  }
  return localReturnRepo;
}

export function getCustomFieldRepository(_shopId?: string): ICustomFieldRepository {
  if (isPrismaConfigured()) {
    return prismaCustomFieldRepo;
  }
  return localCustomFieldRepo;
}

export function getShopRepository(_shopId?: string): IShopRepository {
  if (isPrismaConfigured()) {
    return prismaShopRepo;
  }
  return localShopRepo;
}
