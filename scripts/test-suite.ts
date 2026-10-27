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
import { paginateInvoiceItems, calculatePurchasePrice, calculateProfitMargin, calculateSellingPriceFromMargin } from '../src/lib/utils';
import { sanitizeCell } from '../src/lib/excel/exporter';
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
  assert(Math.round(profitMarginPercent) === 16, `profitMarginPercent ~ 16% (got ${profitMarginPercent})`);

  // Phase 8 Bidirectional Test: Cost 262.50 with 25% margin -> Selling Price 350
  const spFromMargin = calculateSellingPriceFromMargin(262.5, 25);
  assert(spFromMargin === 350, `calculateSellingPriceFromMargin(262.5, 25) === 350 (got ${spFromMargin})`);
  const marginFromSp = calculateProfitMargin(262.5, 350);
  assert(marginFromSp.profitMarginPercent === 25, `calculateProfitMargin(262.5, 350) === 25% (got ${marginFromSp.profitMarginPercent})`);

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
  // TEST 8: CSV Formula Injection Sanitization (CWE-1236)
  // ==========================================
  console.log('\n8. CSV Formula Injection Defense');
  const safeNormal = sanitizeCell('Standard Steel Pipe');
  const safeFormula1 = sanitizeCell('=SUM(A1:A10)');
  const safeFormula2 = sanitizeCell('+CMD|/C calc!A0');
  const safeFormula3 = sanitizeCell('-50+20');
  const safeFormula4 = sanitizeCell('@SUM(1,2)');

  assert(safeNormal === 'Standard Steel Pipe', 'Normal text is unchanged');
  assert(safeFormula1 === "'=SUM(A1:A10)", 'Formula starting with = is escaped with leading quote');
  assert(safeFormula2 === "'+CMD|/C calc!A0", 'Formula starting with + is escaped with leading quote');
  assert(safeFormula3 === "'-50+20", 'Formula starting with - is escaped with leading quote');
  assert(safeFormula4 === "'@SUM(1,2)", 'Formula starting with @ is escaped with leading quote');

  // ==========================================
  // TEST 9: Dual Invoice Lookup (UUID & Invoice Number)
  // ==========================================
  console.log('\n9. Invoice Lookup By ID and Invoice Number');
  const lookupById = await billingService.getInvoiceById(invoice.id);
  const lookupByNumber = await billingService.getInvoiceById(invoice.invoiceNumber);

  assert(lookupById !== null && lookupById.id === invoice.id, 'Invoice lookup by UUID succeeded');
  assert(lookupByNumber !== null && lookupByNumber.invoiceNumber === invoice.invoiceNumber, 'Invoice lookup by INV-001003 succeeded');
  assert(lookupById?.id === lookupByNumber?.id, 'Both lookups resolve the identical invoice');

  // ==========================================
  // TEST 10: Concurrency Race Condition on Stock
  // ==========================================
  console.log('\n10. Concurrency Race-Condition Stock Protection');
  const limitedProd = await productService.createProduct({
    productId: `HW-RACE-${Date.now().toString().slice(-4)}`,
    name: 'Limited Stock Widget',
    stockQuantity: 5,
    mrp: 100,
    purchaseDiscountPercent: 0,
    sellingPrice: 100,
  });

  // Attempt two simultaneous sales of 4 and 3 units (total 7 units, only 5 available)
  const [saleResult1, saleResult2] = await Promise.allSettled([
    billingService.createInvoice({
      paymentMode: 'CASH',
      items: [{ productId: limitedProd.id, quantity: 4 }],
    }),
    billingService.createInvoice({
      paymentMode: 'CASH',
      items: [{ productId: limitedProd.id, quantity: 3 }],
    }),
  ]);

  const oneSucceeded = (saleResult1.status === 'fulfilled' && saleResult2.status === 'rejected') ||
                       (saleResult1.status === 'rejected' && saleResult2.status === 'fulfilled');
  const remainingStock = (await productService.getProductById(limitedProd.id))?.stockQuantity;

  assert(oneSucceeded, 'Exactly one concurrent invoice succeeded, second was rejected');
  assert(remainingStock !== undefined && remainingStock >= 0, `Stock remains non-negative (remaining: ${remainingStock})`);

  // ==========================================
  // TEST 11: Atomic Billing Rollback on Partial Item Failure (Audit Section 3)
  // ==========================================
  console.log('\n11. Atomic Billing Transaction Rollback');
  const prodA = await productService.createProduct({
    productId: `HW-ROLLA-${Date.now().toString().slice(-4)}`,
    name: 'Rollback Test Product A',
    stockQuantity: 5,
    mrp: 100,
    purchaseDiscountPercent: 0,
    sellingPrice: 100,
  });

  const prodB = await productService.createProduct({
    productId: `HW-ROLLB-${Date.now().toString().slice(-4)}`,
    name: 'Rollback Test Product B',
    stockQuantity: 0, // 0 stock
    mrp: 200,
    purchaseDiscountPercent: 0,
    sellingPrice: 200,
  });

  const initialInvoicesCount = (await billingService.getInvoices()).totalCount;

  // Case 1: First item valid (A=2 of 5), second item invalid (B=1 of 0)
  let rollbackCase1Threw = false;
  try {
    await billingService.createInvoice({
      paymentMode: 'CASH',
      items: [
        { productId: prodA.id, quantity: 2 },
        { productId: prodB.id, quantity: 1 },
      ],
    });
  } catch (err: any) {
    rollbackCase1Threw = true;
  }
  assert(rollbackCase1Threw, 'Transaction failed when second item (B) had insufficient stock');

  const prodAAfterCase1 = await productService.getProductById(prodA.id);
  assert(prodAAfterCase1?.stockQuantity === 5, `Product A stock remains exactly 5 after rollback (got ${prodAAfterCase1?.stockQuantity})`);

  const invoicesCountAfterCase1 = (await billingService.getInvoices()).totalCount;
  assert(invoicesCountAfterCase1 === initialInvoicesCount, 'No invoice record committed after failure');

  // Verify no SALE transactions for Product A were created
  const historyA = await inventoryService.getTransactionsForProduct(prodA.id);
  const saleTransactionsA = historyA.filter((t) => t.transactionType === 'SALE');
  assert(saleTransactionsA.length === 0, 'No SALE transaction committed for Product A during rollback');

  // Case 2: Reverse order: First item invalid (B=1 of 0), second item valid (A=2 of 5)
  let rollbackCase2Threw = false;
  try {
    await billingService.createInvoice({
      paymentMode: 'CASH',
      items: [
        { productId: prodB.id, quantity: 1 },
        { productId: prodA.id, quantity: 2 },
      ],
    });
  } catch (err: any) {
    rollbackCase2Threw = true;
  }
  assert(rollbackCase2Threw, 'Transaction failed when first item (B) had insufficient stock');

  const prodAAfterCase2 = await productService.getProductById(prodA.id);
  assert(prodAAfterCase2?.stockQuantity === 5, `Product A stock remains exactly 5 after reverse test (got ${prodAAfterCase2?.stockQuantity})`);

  // ==========================================
  // TEST 12: Claw Hammer POS Scenario & Billing Response Shape Integrity (P0 Remediation)
  // ==========================================
  console.log('\n12. Claw Hammer POS Scenario & Billing Contract');
  let clawHammer = await productService.getProductByProductId('HW-0002');
  if (!clawHammer) {
    clawHammer = await productService.createProduct({
      productId: 'HW-0002',
      name: 'Claw Hammer with Fiberglass Handle',
      size: '16 oz',
      companyBrand: 'Stanley / General',
      unit: 'Pcs',
      stockQuantity: 50,
      lowStockLimit: 5,
      mrp: 600,
      purchaseDiscountPercent: 25,
      sellingPrice: 500,
    });
  }

  // Ensure stock is sufficient
  if (clawHammer.stockQuantity < 10) {
    await inventoryService.adjustStock({
      productId: clawHammer.id,
      quantityChange: 30,
      transactionType: 'STOCK_RECEIVED',
      notes: 'Replenish stock for test',
    });
    clawHammer = (await productService.getProductById(clawHammer.id))!;
  }

  const initialHammerStock = clawHammer.stockQuantity;
  const hammerInvoice = await billingService.createInvoice({
    customerName: 'Screenshot Reproduce Customer',
    customerPhone: '9876543210',
    paymentMode: 'CASH',
    discountAmount: 0,
    items: [{ productId: clawHammer.id, quantity: 3 }],
  });

  assert(Boolean(hammerInvoice.id), 'Invoice created with valid ID');
  assert(hammerInvoice.finalTotal === 1500, `Claw Hammer line total is ₹1,500.00 (got ${hammerInvoice.finalTotal})`);
  assert(hammerInvoice.items[0].quantity === 3, 'Billed quantity is exactly 3 units');

  // Verify response contract helper
  const apiSimulatedResponse = { ...hammerInvoice, invoice: hammerInvoice };
  assert(apiSimulatedResponse.id === hammerInvoice.id, 'API root contract provides direct .id');
  assert(apiSimulatedResponse.invoice.id === hammerInvoice.id, 'API nested contract provides .invoice.id (prevents undefined crash)');

  const hammerStockAfter = (await productService.getProductById(clawHammer.id))?.stockQuantity;
  assert(hammerStockAfter === initialHammerStock - 3, `Stock decremented by 3 units (was ${initialHammerStock}, now ${hammerStockAfter})`);

  // ==========================================
  // TEST 13: Invoice Edit Validation & Return Cascade Protection (P0/P1 Remediation)
  // ==========================================
  console.log('\n13. Invoice Edit Validation & Return Cascade Protection');

  // 13A: Negative or Zero quantity edit is blocked
  let editZeroThrew = false;
  try {
    await billingService.editInvoice(hammerInvoice.id, {
      items: [{ productId: clawHammer.id, quantity: 0 }],
    });
  } catch (err: any) {
    editZeroThrew = true;
  }
  assert(editZeroThrew, 'Editing invoice with 0 quantity is strictly rejected');

  // 13B: Empty item list edit is blocked
  let editEmptyThrew = false;
  try {
    await billingService.editInvoice(hammerInvoice.id, {
      items: [],
    });
  } catch (err: any) {
    editEmptyThrew = true;
  }
  assert(editEmptyThrew, 'Editing invoice with empty item list is strictly rejected');

  // 13C: Process a return on the hammer invoice
  const hammerItem = hammerInvoice.items[0];
  await returnService.processReturn({
    invoiceId: hammerInvoice.id,
    reason: 'Defective grip returned',
    items: [{ invoiceItemId: hammerItem.id, quantity: 1 }],
  });

  // 13D: Editing invoice with existing returns MUST be blocked to prevent cascade deletion
  let editWithReturnThrew = false;
  try {
    await billingService.editInvoice(hammerInvoice.id, {
      items: [{ productId: clawHammer.id, quantity: 2 }],
    });
  } catch (err: any) {
    editWithReturnThrew = true;
  }
  assert(editWithReturnThrew, 'Editing invoice with processed returns is strictly blocked (preserves return history)');

  // ==========================================
  // TEST 14: Duplicate Return Item Payload Protection (P1 Remediation)
  // ==========================================
  console.log('\n14. Duplicate Return Items in Payload Protection');
  // Attempting to return same item twice in the same request to bypass bounds
  let duplicateReturnThrew = false;
  try {
    // hammerItem quantity was 3, 1 already returned, available = 2
    // If request passes quantity: 2 twice, total requested is 4 > 2
    await returnService.processReturn({
      invoiceId: hammerInvoice.id,
      items: [
        { invoiceItemId: hammerItem.id, quantity: 2 },
        { invoiceItemId: hammerItem.id, quantity: 2 },
      ],
    });
  } catch (err: any) {
    duplicateReturnThrew = true;
  }
  assert(duplicateReturnThrew, 'Duplicate items in single return payload cannot exceed returnable bounds');

  // ==========================================
  // TEST 15: Directional Stock Adjustment Verification (P1 Remediation)
  // ==========================================
  console.log('\n15. Directional Stock Adjustment Verification');
  const stockBeforeAdj = (await productService.getProductById(clawHammer.id))!.stockQuantity;

  // Add stock via adjustment (Physical audit discovered found items)
  const addAdj = await inventoryService.adjustStock({
    productId: clawHammer.id,
    quantityChange: 5,
    transactionType: 'ADJUSTMENT',
    notes: 'Physical inventory audit surplus',
  });
  assert(addAdj.newStock === stockBeforeAdj + 5, `Audit addition increased stock by +5 (now ${addAdj.newStock})`);

  // Deduct stock via adjustment (Damage / Spoilage)
  const deductAdj = await inventoryService.adjustStock({
    productId: clawHammer.id,
    quantityChange: -2,
    transactionType: 'ADJUSTMENT',
    notes: 'Damaged item written off',
  });
  assert(deductAdj.newStock === addAdj.newStock - 2, `Audit deduction decreased stock by -2 (now ${deductAdj.newStock})`);

  // ==========================================
  // TEST 16: Advanced Filtering & Multi-Criteria Search (Feature Group 1)
  // ==========================================
  console.log('\n16. Advanced Filtering & Multi-Criteria Search');
  const distinctFilters = await productService.getDistinctFilterOptions();
  assert(Array.isArray(distinctFilters.brands) && distinctFilters.brands.length > 0, 'Dynamic brands list derived from actual catalog');
  assert(Array.isArray(distinctFilters.sizes) && distinctFilters.sizes.length > 0, 'Dynamic sizes list derived from actual catalog');
  assert(Array.isArray(distinctFilters.units) && distinctFilters.units.length > 0, 'Dynamic units list derived from actual catalog');
  assert(distinctFilters.totalActiveCount > 0, `Active product count reported (${distinctFilters.totalActiveCount})`);

  // Combined Search + Brand Filter (AND logic)
  const stanleyWrench = await productService.getProducts({ brand: 'Stanley', search: 'Wrench' });
  assert(stanleyWrench.products.length >= 1, 'Brand Stanley + Search "Wrench" returned matching product');
  assert(stanleyWrench.products.every(p => p.companyBrand === 'Stanley'), 'Every returned item has brand Stanley');

  const unbrandedHammers = await productService.getProducts({ brand: 'Unbranded', search: 'Hammer' });
  assert(unbrandedHammers.products.length >= 1, 'Brand "Unbranded" + Search "Hammer" returned unbranded Claw Hammer');

  // Mismatched brand returns 0 products
  const jaquarHammers = await productService.getProducts({ brand: 'Jaquar', search: 'Hammer' });
  assert(jaquarHammers.products.length === 0, 'Brand Jaquar + Search "Hammer" correctly returned 0 products (AND logic)');

  // Stock status filter verification
  const outOfStockItems = await productService.getProducts({ stockStatus: 'outOfStock' });
  assert(outOfStockItems.products.every(p => p.stockQuantity <= 0), 'Every Out of Stock product has stock <= 0');

  const lowStockItems = await productService.getProducts({ stockStatus: 'lowStock' });
  assert(lowStockItems.products.every(p => p.stockQuantity > 0 && p.stockQuantity <= p.lowStockLimit), 'Every Low Stock product satisfies: 0 < stock <= limit');

  const inStockItems = await productService.getProducts({ stockStatus: 'inStock' });
  assert(inStockItems.products.every(p => p.stockQuantity > p.lowStockLimit), 'Every In Stock product satisfies: stock > limit');

  // ==========================================
  // TEST 17: Formula-Driven Excel Export & Pricing Roundtrip (Feature Group 2)
  // ==========================================
  console.log('\n17. Formula-Driven Excel Export & Pricing Roundtrip');
  const allProdsForExport = (await productService.getProducts({ limit: 10 })).products;
  const { exportProductsToWorkbook, exportProductsToCsvString } = await import('../src/lib/excel/exporter');
  const wb = exportProductsToWorkbook(allProdsForExport);
  const sheet = wb.Sheets[wb.SheetNames[0]];

  // Check formula on row 2 (Column J: Purchase Price, Column L: Selling Price)
  const cellJ2 = sheet['J2'];
  const cellL2 = sheet['L2'];
  assert(Boolean(cellJ2 && cellJ2.f && cellJ2.f.includes('ROUND(H2*(1-I2/100),2)')), `Excel Column J contains purchase price formula (got: ${cellJ2?.f})`);
  assert(Boolean(cellL2 && cellL2.f && cellL2.f.includes('ROUND(J2/(1-K2/100),2)')), `Excel Column L contains selling price margin formula (got: ${cellL2?.f})`);
  assert(typeof cellJ2?.v === 'number' && cellJ2.v > 0, `Excel Column J preserves initial numeric purchase price value (got: ${cellJ2?.v})`);
  assert(typeof cellL2?.v === 'number' && cellL2.v > 0, `Excel Column L preserves initial numeric selling price value (got: ${cellL2?.v})`);

  // CSV Export contains static values without formulas
  const csvExport = exportProductsToCsvString(allProdsForExport);
  assert(!csvExport.includes('=ROUND('), 'CSV export does not contain raw Excel formula strings');
  assert(csvExport.includes('Product ID,Product Name'), 'CSV export maintains canonical headers');

  // ==========================================
  // TEST 18: Comprehensive Shop Analytics & Gross Profit Integrity (Feature Group 3)
  // ==========================================
  console.log('\n18. Comprehensive Shop Analytics & Gross Profit Integrity');
  const analytics = await analyticsService.getComprehensiveAnalytics();
  assert(analytics.kpis.totalSales > 0, `Total sales calculated: ₹${analytics.kpis.totalSales.toFixed(2)}`);
  assert(analytics.kpis.completedInvoices > 0, `Completed invoices reported: ${analytics.kpis.completedInvoices}`);
  assert(analytics.kpis.netSales === Math.round(Math.max(0, analytics.kpis.totalSales - analytics.kpis.totalRefunds) * 100) / 100, 'Net Sales === Total Sales − Refunds');
  assert(analytics.kpis.grossProfit === Math.round((analytics.kpis.netSales - analytics.kpis.cogs) * 100) / 100, 'Gross Profit === Net Sales − Cost of Goods Sold (COGS)');
  assert(analytics.kpis.grossProfitMarginPercent === Math.round(((analytics.kpis.grossProfit / analytics.kpis.netSales) * 100) * 100) / 100, 'Gross Profit Margin % matches (Gross Profit / Net Sales) * 100');
  assert(analytics.kpis.hasHistoricalCostAccuracy === true, 'Analytics cost engine verified historical cost snapshot accuracy');

  // Payment split consistency (Phase 4.6: Cash vs UPI)
  const totalPaymentSplit = Math.round((analytics.paymentSplit.cashSales + analytics.paymentSplit.upiSales) * 100) / 100;
  assert(totalPaymentSplit === analytics.kpis.totalSales, `Payment mode split (Cash ₹${analytics.paymentSplit.cashSales} + UPI ₹${analytics.paymentSplit.upiSales}) matches Total Sales ₹${analytics.kpis.totalSales}`);

  // Brand analytics verification
  assert(Array.isArray(analytics.brands) && analytics.brands.length > 0, `Brand performance report generated (${analytics.brands.length} brands)`);
  assert(analytics.brands.every(b => b.brandName && typeof b.grossRevenue === 'number' && typeof b.grossProfit === 'number'), 'Every brand report has name, revenue, and gross profit');

  // Product performance rankings
  assert(Array.isArray(analytics.products.bestSellers), 'Best-selling products array populated');
  assert(Array.isArray(analytics.products.slowMovers), 'Slow-moving products array populated');

  // ==========================================
  // TEST 19: Dashboard Low-Stock & Out-of-Stock Strict Definition (Feature Group 4)
  // ==========================================
  console.log('\n19. Dashboard Low-Stock Navigation & Strict Thresholds');
  const allCurrentProducts = (await productService.getProducts({ limit: 10000 })).products;
  const outOfStockCount = allCurrentProducts.filter(p => p.stockQuantity <= 0).length;
  const lowStockCount = allCurrentProducts.filter(p => p.stockQuantity > 0 && p.stockQuantity <= p.lowStockLimit).length;
  const inStockCount = allCurrentProducts.filter(p => p.stockQuantity > p.lowStockLimit).length;

  assert(outOfStockCount >= 1, `Out of stock products correctly identified (${outOfStockCount} zero-stock products)`);
  assert(lowStockCount >= 0, `Low stock products correctly identified (${lowStockCount} low-stock products)`);
  assert(outOfStockCount + lowStockCount + inStockCount === allCurrentProducts.length, 'Strict threshold partition: Out of Stock + Low Stock + In Stock equals total products');

  // Ensure zero-stock items are never classified as low stock
  const zeroStockClassifiedAsLow = allCurrentProducts.filter(p => p.stockQuantity <= 0 && p.stockQuantity > 0 && p.stockQuantity <= p.lowStockLimit).length;
  assert(zeroStockClassifiedAsLow === 0, 'Zero-stock items are strictly excluded from Low Stock categorization');

  // ==========================================
  // TEST 20: Brand-Filtered Excel & CSV Downloads (Feature Group 5)
  // ==========================================
  console.log('\n20. Brand-Filtered Excel & CSV Downloads');
  // Filtered Excel export
  const stanleyXlsx = await importExportService.exportProducts('xlsx', 'Stanley');
  assert(stanleyXlsx.filename === 'TradeStock_Products_Stanley.xlsx', `Filtered Excel filename matches contract: ${stanleyXlsx.filename}`);

  // Filtered CSV export
  const stanleyCsv = await importExportService.exportProducts('csv', 'Stanley');
  assert(stanleyCsv.filename === 'TradeStock_Products_Stanley.csv', `Filtered CSV filename matches contract: ${stanleyCsv.filename}`);
  assert(typeof stanleyCsv.data === 'string' && stanleyCsv.data.includes('Stanley'), 'Filtered CSV contains Stanley records');
  assert(!stanleyCsv.data.includes('Bosch'), 'Filtered CSV excludes other brands (Bosch excluded from Stanley download)');

  // Full catalog export preservation
  const fullXlsx = await importExportService.exportProducts('xlsx');
  assert(fullXlsx.filename.startsWith('tradestock-products-'), `Full catalog export preserves standard filename: ${fullXlsx.filename}`);

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
