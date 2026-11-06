// scripts/reset-data.ts
//
// Clears all test / garbage business data so the shop can start fresh.
//
// KEEPS:   shop profile (name, address, etc.) and user logins.
// DELETES: products, price history, stock transactions, invoices, invoice items,
//          returns, return items, custom fields (definitions + values), audit logs.
// RESETS:  invoice and return number counters (next bill = INV-001001, next return = RET-000001).
//
// Usage:
//   npm run db:reset -- --yes
//
// Works for both storage modes:
//   - DATABASE_URL set (PostgreSQL / Cloud SQL) -> clears the Prisma database
//   - DATABASE_URL not set                      -> clears .tradestock-data/shop-database.json

import fs from 'fs';
import path from 'path';

const INVOICE_START = 1000; // next invoice will be INV-001001
const RETURN_START = 0; // next return will be RET-000001

function loadEnvFiles() {
  for (const file of ['.env.local', '.env']) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, 'utf-8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let value = m[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

async function resetPrisma() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Children first, then parents (respecting foreign keys).
      const invoicePayments = await tx.invoicePayment.deleteMany();
      const returnItems = await tx.returnItem.deleteMany();
      const invoiceReturns = await tx.invoiceReturn.deleteMany();
      const invoiceItems = await tx.invoiceItem.deleteMany();
      const invoices = await tx.invoice.deleteMany();
      const customFieldValues = await tx.customFieldValue.deleteMany();
      const customFieldDefinitions = await tx.customFieldDefinition.deleteMany();
      const priceHistory = await tx.priceHistory.deleteMany();
      const stockTransactions = await tx.stockTransaction.deleteMany();
      const products = await tx.product.deleteMany();
      const auditLogs = await tx.auditLog.deleteMany();

      await tx.sequenceCounter.upsert({
        where: { name: 'INVOICE' },
        update: { currentValue: INVOICE_START },
        create: { name: 'INVOICE', currentValue: INVOICE_START },
      });
      await tx.sequenceCounter.upsert({
        where: { name: 'RETURN' },
        update: { currentValue: RETURN_START },
        create: { name: 'RETURN', currentValue: RETURN_START },
      });

      return {
        products: products.count,
        priceHistory: priceHistory.count,
        stockTransactions: stockTransactions.count,
        invoices: invoices.count,
        invoiceItems: invoiceItems.count,
        invoiceReturns: invoiceReturns.count,
        returnItems: returnItems.count,
        invoicePayments: invoicePayments.count,
        customFieldDefinitions: customFieldDefinitions.count,
        customFieldValues: customFieldValues.count,
        auditLogs: auditLogs.count,
      };
    });

    const shops = await prisma.shopProfile.findMany({ select: { name: true } });
    const users = await prisma.user.count();
    console.log('🗑️  Deleted rows:', result);
    console.log(`✓ Kept shop profile(s): ${shops.map((s) => s.name).join(', ') || '(none)'}`);
    console.log(`✓ Kept ${users} user login(s)`);
  } finally {
    await prisma.$disconnect();
  }
}

function resetLocal() {
  const dbFile = path.join(process.cwd(), '.tradestock-data', 'shop-database.json');
  if (!fs.existsSync(dbFile)) {
    console.log(`No local data file found at ${dbFile}. Nothing to clear.`);
    return;
  }

  // Back up first, just in case.
  const backup = dbFile.replace(/\.json$/, `.backup-${Date.now()}.json`);
  fs.copyFileSync(dbFile, backup);

  const data = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  const counts = {
    products: data.products?.length ?? 0,
    invoices: data.invoices?.length ?? 0,
    invoiceReturns: data.invoiceReturns?.length ?? 0,
    stockTransactions: data.stockTransactions?.length ?? 0,
    priceHistory: data.priceHistory?.length ?? 0,
    customFieldDefinitions: data.customFieldDefinitions?.length ?? 0,
  };

  const cleaned = {
    ...data,
    profile: data.profile, // kept
    users: data.users ?? [], // kept
    products: [],
    priceHistory: [],
    stockTransactions: [],
    invoices: [],
    invoiceReturns: [],
    customFieldDefinitions: [],
    customFieldValues: {},
    lastInvoiceSequence: INVOICE_START,
  };
  if ('auditLogs' in data) cleaned.auditLogs = [];
  if ('lastReturnSequence' in data) cleaned.lastReturnSequence = RETURN_START;

  const tmp = `${dbFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cleaned, null, 2), 'utf-8');
  fs.renameSync(tmp, dbFile);

  console.log('🗑️  Cleared:', counts);
  console.log(`✓ Kept shop profile: ${data.profile?.name ?? '(none)'}`);
  console.log(`✓ Kept ${(data.users ?? []).length} user login(s)`);
  console.log(`💾 Backup saved to ${backup}`);
}

async function main() {
  if (!process.argv.includes('--yes')) {
    console.log('This permanently deletes all products, stock, invoices, returns, custom fields and audit logs.');
    console.log('Shop profile and logins are kept. Re-run with --yes to confirm:');
    console.log('  npm run db:reset -- --yes');
    process.exit(1);
  }

  loadEnvFiles();
  const usePrisma = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
  console.log(`🧹 Resetting ${usePrisma ? 'PostgreSQL database (DATABASE_URL)' : 'local JSON data store'}...`);

  if (usePrisma) await resetPrisma();
  else resetLocal();

  console.log('🎉 Done. Shop is ready for real data.');
}

main().catch((e) => {
  console.error('❌ Reset failed (nothing was partially deleted in database mode):', e);
  process.exit(1);
});
