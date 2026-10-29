// scripts/verify-live.ts
import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

async function runLiveVerification() {
  console.log('🚀 Starting TradeStock Pro Live Server Verification on', BASE_URL);
  let sessionCookie = '';

  // 1. Verify Login Page
  console.log('\n[1] Verifying Login Page & Headers...');
  const loginPageRes = await fetch(`${BASE_URL}/login`);
  assert.strictEqual(loginPageRes.status, 200, 'Login page returned 200 OK');
  const loginHtml = await loginPageRes.text();
  assert(loginHtml.includes('TradeStock') || loginHtml.includes('login'), 'Login page renders TradeStock branding');
  console.log('  ✓ Login page responds 200 OK');

  // 2. Perform Authentication
  console.log('\n[2] Authenticating via POST /api/auth/login...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@tradestock.com', password: 'password123' }),
  });
  assert.strictEqual(loginRes.status, 200, 'Login API returned 200');
  const setCookieHeader = loginRes.headers.get('set-cookie');
  assert(Boolean(setCookieHeader), 'Login sets session cookie');
  sessionCookie = setCookieHeader!.split(';')[0];
  console.log('  ✓ Session cookie obtained successfully:', sessionCookie.substring(0, 25) + '...');

  const authHeaders = {
    Cookie: sessionCookie,
    'Content-Type': 'application/json',
  };

  // 3. Verify Session Identity via GET /api/auth/me
  console.log('\n[3] Verifying Identity via GET /api/auth/me...');
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: authHeaders });
  assert.strictEqual(meRes.status, 200, 'GET /api/auth/me returned 200');
  const meData = await meRes.json();
  assert.strictEqual(meData.session?.email, 'owner@tradestock.com', 'Session matches owner email');
  console.log('  ✓ Authenticated Session:', meData.session.shopName, `(${meData.session.email})`);

  // 4. Verify Product Filters API (Feature 1)
  console.log('\n[4] Verifying Dynamic Product Filters via GET /api/products/filters...');
  const filterRes = await fetch(`${BASE_URL}/api/products/filters`, { headers: authHeaders });
  assert.strictEqual(filterRes.status, 200, 'Filter API returned 200');
  const filterData = await filterRes.json();
  assert(Array.isArray(filterData.brands) && filterData.brands.length > 0, 'Dynamic brands list populated');
  assert(Array.isArray(filterData.sizes) && filterData.sizes.length > 0, 'Dynamic sizes list populated');
  assert(Array.isArray(filterData.units) && filterData.units.length > 0, 'Dynamic units list populated');
  console.log(`  ✓ Available Brands: ${filterData.brands.join(', ')}`);
  console.log(`  ✓ Available Units: ${filterData.units.join(', ')}`);

  // 5. Verify Multi-Criteria Search & Filtering (Feature 1)
  console.log('\n[5] Verifying Multi-Criteria Filtering via GET /api/products...');
  const prodRes = await fetch(`${BASE_URL}/api/products?status=lowStock`, { headers: authHeaders });
  assert.strictEqual(prodRes.status, 200, 'Products API returned 200');
  const prodData = await prodRes.json();
  assert(Array.isArray(prodData.products), 'Products returned as array');
  for (const p of prodData.products) {
    assert(p.stockQuantity > 0 && p.stockQuantity <= p.lowStockLimit, `Product ${p.productId} satisfies lowStock threshold`);
  }
  console.log(`  ✓ Low stock products correctly filtered: ${prodData.products.length} items`);

  // 6. Verify Dashboard Metrics & Clickable Navigation (Feature 4)
  console.log('\n[6] Verifying Dashboard Analytics via GET /api/analytics/dashboard...');
  const dashRes = await fetch(`${BASE_URL}/api/analytics/dashboard`, { headers: authHeaders });
  assert.strictEqual(dashRes.status, 200, 'Dashboard API returned 200');
  const dashData = await dashRes.json();
  assert(typeof dashData.stats.lowStockCount === 'number', 'lowStockCount is numeric');
  assert(typeof dashData.stats.outOfStockCount === 'number', 'outOfStockCount is numeric');
  console.log(`  ✓ Dashboard: ${dashData.stats.totalProducts} Total Products, ${dashData.stats.lowStockCount} Low Stock, ${dashData.stats.outOfStockCount} Out of Stock`);

  // 7. Verify Comprehensive Analytics with Presets (Feature 3)
  console.log('\n[7] Verifying Comprehensive Analytics via GET /api/analytics/comprehensive...');
  const analyticsRes = await fetch(`${BASE_URL}/api/analytics/comprehensive?preset=thisYear`, { headers: authHeaders });
  assert.strictEqual(analyticsRes.status, 200, 'Comprehensive Analytics API returned 200');
  const aData = await analyticsRes.json();
  assert(aData.kpis.totalSales > 0, 'Total sales is positive');
  assert.strictEqual(
    aData.kpis.netSales,
    Math.round(Math.max(0, aData.kpis.totalSales - aData.kpis.totalRefunds) * 100) / 100,
    'Net Sales === Total Sales - Refunds'
  );
  assert.strictEqual(
    aData.kpis.grossProfit,
    Math.round((aData.kpis.netSales - aData.kpis.cogs) * 100) / 100,
    'Gross Profit === Net Sales - COGS'
  );
  console.log(`  ✓ Net Sales: ₹${aData.kpis.netSales}, COGS: ₹${aData.kpis.cogs}, Gross Profit: ₹${aData.kpis.grossProfit} (${aData.kpis.grossProfitMarginPercent}%)`);
  console.log(`  ✓ Cash Sales: ₹${aData.paymentSplit.cashSales} (${aData.paymentSplit.cashInvoicesCount} bills) | UPI Sales: ₹${aData.paymentSplit.upiSales} (${aData.paymentSplit.upiInvoicesCount} bills)`);

  // 8. Verify Brand-Filtered Excel & CSV Export (Feature 5)
  console.log('\n[8] Verifying Brand-Filtered Export via GET /api/exports/products...');
  const exportXlsxRes = await fetch(`${BASE_URL}/api/exports/products?format=xlsx&brand=Stanley`, { headers: authHeaders });
  assert.strictEqual(exportXlsxRes.status, 200, 'Excel export returned 200');
  const xlsxDisposition = exportXlsxRes.headers.get('content-disposition');
  assert(xlsxDisposition?.includes('TradeStock_Products_Stanley.xlsx'), `Excel disposition filename matches: ${xlsxDisposition}`);
  const xlsxBuffer = await exportXlsxRes.arrayBuffer();
  assert(xlsxBuffer.byteLength > 1000, 'Excel file binary payload is non-empty');
  console.log(`  ✓ Brand-Filtered Excel export verified (${xlsxBuffer.byteLength} bytes, ${xlsxDisposition})`);

  const exportCsvRes = await fetch(`${BASE_URL}/api/exports/products?format=csv&brand=Stanley`, { headers: authHeaders });
  assert.strictEqual(exportCsvRes.status, 200, 'CSV export returned 200');
  const csvDisposition = exportCsvRes.headers.get('content-disposition');
  assert(csvDisposition?.includes('TradeStock_Products_Stanley.csv'), `CSV disposition filename matches: ${csvDisposition}`);
  const csvText = await exportCsvRes.text();
  assert(csvText.includes('Stanley'), 'CSV content contains Stanley');
  console.log(`  ✓ Brand-Filtered CSV export verified (${csvText.length} characters, ${csvDisposition})`);

  // 9. Mandatory Billing Investigation: Claw Hammer HW-0002 Scenario (Phase 2)
  console.log('\n[9] MANDATORY INVESTIGATION: Executing Claw Hammer (HW-0002) POS Bill...');
  // Find Claw Hammer product
  const hammerSearchRes = await fetch(`${BASE_URL}/api/products?search=HW-0002`, { headers: authHeaders });
  const hammerSearchData = await hammerSearchRes.json();
  const clawHammer = hammerSearchData.products.find((p: any) => p.productId === 'HW-0002');
  assert(Boolean(clawHammer), 'Claw Hammer HW-0002 found in database');
  console.log(`  Target Product: ${clawHammer.name} (${clawHammer.productId})`);
  console.log(`  Unit: ${clawHammer.unit}, Rate: ₹${clawHammer.sellingPrice}, Stock: ${clawHammer.stockQuantity}`);

  const initialStock = clawHammer.stockQuantity;
  const billPayload = {
    customerName: 'Aarav Sharma',
    customerPhone: '9876543210',
    paymentMode: 'CASH',
    discountAmount: 0,
    items: [
      {
        productId: clawHammer.id, // Internal ID
        quantity: 3,
      },
    ],
  };

  const billCreateRes = await fetch(`${BASE_URL}/api/billing`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(billPayload),
  });
  assert.strictEqual(billCreateRes.status, 201, 'Bill creation returned 201 Created');
  const billData = await billCreateRes.json();

  // CONTRACT VERIFICATION: Prove both .id and .invoice.id exist
  assert(Boolean(billData.id), 'Root billData.id exists (prevents undefined crash)');
  assert(Boolean(billData.invoice?.id), 'Nested billData.invoice.id exists (supports backwards compatibility)');
  const createdInvoiceId = billData.id || billData.invoice.id;
  assert.strictEqual(billData.finalTotal, 1500, 'Invoice total is exactly ₹1,500.00 (3 x ₹500.00)');
  console.log(`  ✓ Invoice Created Successfully: ${billData.invoiceNumber} (ID: ${createdInvoiceId})`);
  console.log(`  ✓ Total Billed: ₹${billData.finalTotal} across 3 units`);

  // Verify stock was decremented by exactly 3
  const afterProdRes = await fetch(`${BASE_URL}/api/products/${clawHammer.id}`, { headers: authHeaders });
  const afterProdData = await afterProdRes.json();
  assert.strictEqual(afterProdData.product.stockQuantity, initialStock - 3, `Stock decremented from ${initialStock} to ${initialStock - 3}`);
  console.log(`  ✓ Stock Decremented Atomically: ${initialStock} -> ${afterProdData.product.stockQuantity}`);

  // 10. Verify Invoice Detail & PDF Generation
  console.log('\n[10] Verifying Invoice View & PDF Generation...');
  const invDetailRes = await fetch(`${BASE_URL}/api/invoices/${createdInvoiceId}`, { headers: authHeaders });
  assert.strictEqual(invDetailRes.status, 200, 'Invoice detail returned 200');
  const invDetail = await invDetailRes.json();
  assert.strictEqual(invDetail.items.length, 1, 'Invoice contains 1 item');
  assert.strictEqual(invDetail.items[0].productNameSnapshot, clawHammer.name, 'Item snapshot preserves product name');

  const pdfRes = await fetch(`${BASE_URL}/api/invoices/${createdInvoiceId}/pdf`, { headers: authHeaders });
  assert.strictEqual(pdfRes.status, 200, 'PDF API returned 200');
  assert.strictEqual(pdfRes.headers.get('content-type'), 'application/pdf', 'Content-Type is application/pdf');
  const pdfBytes = await pdfRes.arrayBuffer();
  assert(pdfBytes.byteLength > 1000, 'PDF buffer contains valid PDF bytes');
  console.log(`  ✓ A4 PDF Generated Successfully (${pdfBytes.byteLength} bytes)`);

  console.log('\n======================================================');
  console.log('🎉 ALL LIVE SERVER WORKFLOWS VERIFIED 100% OPERATIONAL!');
  console.log('======================================================\n');
}

runLiveVerification().catch((err) => {
  console.error('\n❌ LIVE VERIFICATION FAILED:', err);
  process.exit(1);
});
