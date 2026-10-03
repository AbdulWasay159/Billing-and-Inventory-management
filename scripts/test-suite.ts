// scripts/test-suite.ts
/**
 * TradeStock Pro Comprehensive Test Suite
 * Validates Sections 6, 7, 8, 9, 10, 11, 12, 14, 15, 20, 21, 22, 38
 */

import { productService } from '../src/services/product.service';
import { billingService } from '../src/services/billing.service';
import { returnService } from '../src/services/return.service';
import { inventoryService } from '../src/services/inventory.service';
import { importExportService } from '../src/services/import-export.service';
import { analyticsService } from '../src/services/analytics.service';
import { paginateInvoiceItems, calculatePurchasePrice, calculateProfitMargin } from '../src/lib/utils';
import { InvoiceItem } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('🧪 Starting TradeStock Pro Test Suite...\n');

  // ==========================================
  // TEST 1: Pricing Calculations
  // ==========================================
  console.log('1. Pricing Engine & Margin Math');
  const cost = calculatePurchasePrice(150, 30); // MRP 150, 30% disc -> 105
  assert(cost === 105, `calculatePurchasePrice(150, 30) === 105 (got ${cost})`);

  const { profitAmount, profitMarginPercent } = calculateProfitMargin(105, 125);
  assert(profitAmount === 20, `profitAmount === 20 (got ${profitAmount})`);
  assert(Math.round(profitMarginPercent) === 19, `profitMarginPercent ~ 19% (got ${profitMarginPercent})`);

  // ==========================================
  // TEST 2: Product Creation & 5-Tier Pricing
  // ==========================================
  console.log('\n2. Product Master & Price History');
  const testProductId = `HW-TEST-${Date.now().toString().slice(-4)}`;
  const prod = await productService.createProduct({
    productId: testProductId,
    name: 'Heavy Duty Pipe Wrench 14"',
    size: '14 inch',
    companyBrand: 'Stanley',
    unit: 'Pcs',
    stockQuantity: 20,
    lowStockLimit: 5,
    mrp: 600,
    purchaseDiscountPercent: 25,
    sellingPrice: 500,
  });

  assert(prod.productId === testProductId, 'Product created with exact Product ID');
  assert(prod.purchasePrice === 450, `Purchase price auto-calculated to 450 (got ${prod.purchasePrice})`);
  assert(prod.stockQuantity === 20, 'Initial stock correctly set to 20');

  // Update selling rate -> verify previous rate & price history
  const updatedProd = await productService.updateProduct(prod.id, {
    sellingPrice: 550,
  });
  assert(updatedProd.sellingPrice === 550, 'Selling rate updated to 550');
  assert(updatedProd.previousSellingPrice === 500, 'Previous selling rate preserved as 500');

  const history = await productService.getPriceHistory(prod.id);
  assert(history.length >= 1, 'Price change history logged');
  assert(history[0].oldSellingPrice === 500 && history[0].newSellingPrice === 550, 'Price history captures 500 -> 550');

  // Duplicate Product ID should throw
  let duplicateThrew = false;
  try {
    await productService.createProduct({
      productId: testProductId,
      name: 'Duplicate Product',
      stockQuantity: 5,
      mrp: 100,
      purchaseDiscountPercent: 0,
      sellingPrice: 100,
    });
  } catch {
    duplicateThrew = true;
  }
  assert(duplicateThrew, 'Duplicate Product ID creation is strictly blocked');

  // ==========================================
  // TEST 3: Billing & Real-Time Stock Deduction
  // ==========================================
  console.log('\n3. Billing Counter & Atomic Stock Decrement');
  const initialStock = updatedProd.stockQuantity; // 20
  const invoice = await billingService.createInvoice({
    customerName: 'Ramesh Patel',
    paymentMode: 'UPI',
    items: [
      {
        productId: updatedProd.id,
        quantity: 3,
      },
    ],
  });

  assert(Boolean(invoice.invoiceNumber.startsWith('INV-')), `Invoice generated with sequence number: ${invoice.invoiceNumber}`);
  assert(invoice.items.length === 1, 'Invoice contains 1 line item');
  assert(invoice.finalTotal === 3 * 550, `Invoice total is ${3 * 550} (got ${invoice.finalTotal})`);

  // Verify stock decremented
  const prodAfterSale = await productService.getProductById(updatedProd.id);
  assert(
    prodAfterSale?.stockQuantity === initialStock - 3,
    `Stock decremented from ${initialStock} to ${initialStock - 3} (got ${prodAfterSale?.stockQuantity})`
  );

  // Overselling protection test
  let oversellThrew = false;
  try {
    await billingService.createInvoice({
      paymentMode: 'CASH',
      items: [{ productId: updatedProd.id, quantity: 9999 }], // Exceeds available stock
    });
  } catch {
    oversellThrew = true;
  }
  assert(oversellThrew, 'Overselling blocked when requested quantity exceeds available stock');

  // ==========================================
  // TEST 4: Bill Editing with Inventory Delta
  // ==========================================
  console.log('\n4. Bill Editing with Inventory Delta Adjustment');
  // Original invoice had qty = 3. Edit to qty = 5 (needs 2 more from stock)
  const editedInvoice = await billingService.editInvoice(invoice.id, {
    items: [{ productId: updatedProd.id, quantity: 5 }],
  });
  assert(editedInvoice.items[0].quantity === 5, 'Invoice updated to 5 units');

  const prodAfterEdit = await productService.getProductById(updatedProd.id);
  assert(
    prodAfterEdit?.stockQuantity === initialStock - 5,
    `Stock adjusted: 2 additional units deducted (now ${prodAfterEdit?.stockQuantity})`
  );

  // ==========================================
  // TEST 5: Customer Returns & Stock Restoration
  // ==========================================
  console.log('\n5. Returns & Stock Restoration');
  const invItemToReturn = editedInvoice.items[0];
  const ret = await returnService.processReturn({
    invoiceId: editedInvoice.id,
    reason: 'Customer bought excess units',
    items: [{ invoiceItemId: invItemToReturn.id, quantity: 2 }],
  });

  assert(Boolean(ret.returnNumber.startsWith('RET-')), `Return processed with number: ${ret.returnNumber}`);
  assert(ret.items[0].quantity === 2, '2 units recorded in return item');

  const prodAfterReturn = await productService.getProductById(updatedProd.id);
  assert(
    prodAfterReturn?.stockQuantity === initialStock - 5 + 2,
    `Stock restored by 2 units (now ${prodAfterReturn?.stockQuantity})`
  );

  // Return excess should throw
  let returnExcessThrew = false;
  try {
    await returnService.processReturn({
      invoiceId: editedInvoice.id,
      items: [{ invoiceItemId: invItemToReturn.id, quantity: 999 }],
    });
  } catch {
    returnExcessThrew = true;
  }
  assert(returnExcessThrew, 'Returning more than sold units is strictly blocked');

  // ==========================================
  // TEST 6: Strict A4 Pagination Engine (Section 15)
  // ==========================================
  console.log('\n6. Strict A4 Multi-Page Pagination (Max 20 rows/page)');

  // Case A: 15 items -> 1 page
  const items15 = Array.from({ length: 15 }, (_, i) => ({
    id: `item-${i}`,
    invoiceId: 'inv-test',
    productId: `p-${i}`,
    productIdSnapshot: `HW-${i}`,
    productNameSnapshot: `Product ${i}`,
    sizeSnapshot: '1"',
    unitSnapshot: 'Pcs',
    sellingPriceSnapshot: 100,
    purchaseCostSnapshot: 80,
    quantity: 1,
    lineTotal: 100,
  })) as InvoiceItem[];
  const chunks15 = paginateInvoiceItems(items15, 20);
  assert(chunks15.length === 1, `15 items fit on 1 A4 page (got ${chunks15.length})`);

  // Case B: 25 items -> 2 pages (20 items on page 1, 5 on page 2)
  const items25 = Array.from({ length: 25 }, (_, i) => ({
    id: `item-${i}`,
    invoiceId: 'inv-test',
    productId: `p-${i}`,
    productIdSnapshot: `HW-${i}`,
    productNameSnapshot: `Product ${i}`,
    sizeSnapshot: '1"',
    unitSnapshot: 'Pcs',
    sellingPriceSnapshot: 100,
    purchaseCostSnapshot: 80,
    quantity: 1,
    lineTotal: 100,
  })) as InvoiceItem[];
  const chunks25 = paginateInvoiceItems(items25, 20);
  assert(chunks25.length === 2, `25 items paginate into 2 pages (got ${chunks25.length})`);
  assert(chunks25[0].items.length === 20, `Page 1 contains exactly 20 items (got ${chunks25[0].items.length})`);
  assert(chunks25[1].items.length === 5, `Page 2 contains remaining 5 items (got ${chunks25[1].items.length})`);
  assert(chunks25[0].pageSubtotal === 2000, `Page 1 subtotal is 2000 (got ${chunks25[0].pageSubtotal})`);
  assert(chunks25[1].pageSubtotal === 500, `Page 2 subtotal is 500 (got ${chunks25[1].pageSubtotal})`);

  // Case C: 200 items -> 10 pages
  const items200 = Array.from({ length: 200 }, (_, i) => ({
    id: `item-${i}`,
    invoiceId: 'inv-test',
    productId: `p-${i}`,
    productIdSnapshot: `HW-${i}`,
    productNameSnapshot: `Product ${i}`,
    sizeSnapshot: '1"',
    unitSnapshot: 'Pcs',
    sellingPriceSnapshot: 10,
    purchaseCostSnapshot: 8,
    quantity: 1,
    lineTotal: 10,
  })) as InvoiceItem[];
  const chunks200 = paginateInvoiceItems(items200, 20);
  assert(chunks200.length === 10, `200 items paginate into exactly 10 pages (got ${chunks200.length})`);

  // ==========================================
  // TEST 7: Excel Re-Import Target Stock Rule (Section 10)
  // ==========================================
  console.log('\n7. Excel Re-Import & Absolute Target Stock');
  // Target Stock Rule: If product has stock 17, and Excel says stock 100, final stock MUST BE 100.
  const currentBeforeImport = (await productService.getProductById(updatedProd.id))?.stockQuantity || 0;
  const importSummary = await importExportService.commitImport([
    {
      rowNumber: 2,
      productId: updatedProd.productId,
      name: updatedProd.name,
      size: updatedProd.size,
      companyBrand: updatedProd.companyBrand,
      unit: updatedProd.unit,
      targetStock: 100, // Absolute target stock
      lowStockLimit: 10,
      mrp: 600,
      purchaseDiscountPercent: 25,
      purchasePrice: 450,
      profitMarginPercent: 22.2,
      sellingPrice: 550,
      isExisting: true,
      errors: [],
      warnings: [],
    },
  ]);

  assert(importSummary.updatedProductsCount === 1, '1 existing product updated by Product ID');
  const prodAfterImport = await productService.getProductById(updatedProd.id);
  assert(
    prodAfterImport?.stockQuantity === 100,
    `Target stock rule verified: Stock set to exactly 100 (was ${currentBeforeImport}, got ${prodAfterImport?.stockQuantity})`
  );

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n----------------------------------------------------');
  console.log(`Test Execution Results: ${passed} PASSED, ${failed} FAILED.`);
  console.log('----------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL INTEGRITY TESTS PASSED SUCCESSFULLY!\n');
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
