// scripts/seed-owner.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding TradeStock Pro Initial Database Setup...');

  const ownerEmail = process.env.INITIAL_OWNER_EMAIL || 'owner@tradestock.com';
  const ownerPassword = process.env.INITIAL_OWNER_PASSWORD || 'password123';
  const shopName = process.env.INITIAL_SHOP_NAME || 'TradeStock Hardware & Sanitary';

  const passwordHash = await bcrypt.hash(ownerPassword, 10);

  // 1. Seed or Update Shop Profile
  const shop = await prisma.shopProfile.upsert({
    where: { slug: 'tradestock-main' },
    update: {
      name: shopName,
      email: ownerEmail,
    },
    create: {
      slug: 'tradestock-main',
      name: shopName,
      email: ownerEmail,
      phone: '+91 98765 43210',
      address: 'Shop No. 12, Market Yard, Hardware Lane, Hyderabad, India',
      currencySymbol: '₹',
      receiptFooterMessage: 'Goods once sold cannot be taken back without original bill. Thank you!',
    },
  });
  console.log(`✓ Shop Profile configured: "${shop.name}" (${shop.id})`);

  // 2. Seed or Update Owner User
  const user = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      name: 'Shop Owner',
      passwordHash,
      role: 'OWNER',
      isActive: true,
    },
    create: {
      email: ownerEmail,
      name: 'Shop Owner',
      passwordHash,
      role: 'OWNER',
      isActive: true,
    },
  });
  console.log(`✓ Owner account ready: ${user.email}`);

  // 3. Initialize Sequence Counters
  await prisma.sequenceCounter.upsert({
    where: { name: 'INVOICE' },
    update: {},
    create: { name: 'INVOICE', currentValue: 1000 },
  });
  await prisma.sequenceCounter.upsert({
    where: { name: 'RETURN' },
    update: {},
    create: { name: 'RETURN', currentValue: 0 },
  });
  console.log('✓ Sequential invoice & return counters initialized.');

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
