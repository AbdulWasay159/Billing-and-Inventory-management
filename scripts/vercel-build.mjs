// scripts/vercel-build.mjs
// Build pipeline for Vercel (and any CI):
//   1. prisma generate
//   2. prisma migrate deploy  (only when DATABASE_URL is set)
//   3. create the first owner account + counters if the database has no users yet
//   4. next build
//
// Migrations need a session-level connection. If DIRECT_URL is set it is used;
// otherwise a Supabase transaction-pooler URL (port 6543) is converted to the
// session pooler on the same host (port 5432).
import { execSync } from 'node:child_process';

function run(cmd, env = process.env) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env });
}

function migrationUrl(raw) {
  if (process.env.DIRECT_URL && process.env.DIRECT_URL.trim()) return process.env.DIRECT_URL.trim();
  try {
    const url = new URL(raw.trim());
    if (url.port === '6543') url.port = '5432';
    url.searchParams.delete('pgbouncer');
    url.searchParams.delete('connection_limit');
    return url.toString();
  } catch {
    return raw;
  }
}

async function ensureOwner() {
  const { PrismaClient } = await import('@prisma/client');
  const bcrypt = (await import('bcryptjs')).default;
  const prisma = new PrismaClient({ datasources: { db: { url: migrationUrl(process.env.DATABASE_URL) } } });
  try {
    await prisma.sequenceCounter.upsert({ where: { name: 'INVOICE' }, update: {}, create: { name: 'INVOICE', currentValue: 1000 } });
    await prisma.sequenceCounter.upsert({ where: { name: 'RETURN' }, update: {}, create: { name: 'RETURN', currentValue: 0 } });

    const users = await prisma.user.count();
    if (users > 0) {
      console.log(`✓ ${users} existing user account(s) kept as they are.`);
      return;
    }
    const email = process.env.INITIAL_OWNER_EMAIL || 'owner@tradestock.com';
    const password = process.env.INITIAL_OWNER_PASSWORD || 'password123';
    const shopName = process.env.INITIAL_SHOP_NAME || 'TradeStock Hardware & Sanitary';

    const shops = await prisma.shopProfile.count();
    if (shops === 0) {
      await prisma.shopProfile.create({
        data: { slug: 'tradestock-main', name: shopName, email, currencySymbol: '₹' },
      });
      console.log('✓ Shop profile created.');
    }
    await prisma.user.create({
      data: { email, name: 'Shop Owner', passwordHash: await bcrypt.hash(password, 10), role: 'OWNER', isActive: true },
    });
    console.log(`✓ First owner account created: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

run('npx prisma generate');

if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
  run('npx prisma migrate deploy', { ...process.env, DATABASE_URL: migrationUrl(process.env.DATABASE_URL) });
  await ensureOwner();
} else {
  console.log('ℹ DATABASE_URL not set: skipping migrations (local JSON store mode).');
}

run('npx next build');
