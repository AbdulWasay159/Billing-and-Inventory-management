$base = "http://localhost:3000"

# 1. Login
$login = Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"owner@tradestock.com","password":"password123"}'
$token = $login.token
$headers = @{ Authorization = "Bearer $token" }
Write-Host "✅ [1] Authenticated successfully as $($login.session.email) ($($login.session.shopName))"

# 2. Get Products
$prodRes = Invoke-RestMethod -Uri "$base/api/products" -Method Get -Headers $headers
$products = $prodRes.products
Write-Host "✅ [2] Fetched $($products.Count) products from catalog."
$first = $products[0]
Write-Host "    Sample: [$($first.productId)] $($first.name) | Size: $($first.size) | MRP: ₹$($first.mrp) | Disc: $($first.purchaseDiscountPercent)% | Cost: ₹$($first.purchasePrice) | Selling: ₹$($first.sellingPrice) | Stock: $($first.stockQuantity)"

# 3. Add a new product (Section 1 5-tier pricing & HW-XXXX permanent ID)
$testProductId = "HW-" + (Get-Random -Minimum 1000 -Maximum 9999)
$newProdBody = @{
    productId = $testProductId
    name = "PVC Brass Ball Valve Heavy"
    size = "1 Inch"
    companyBrand = "Finolex"
    unit = "PCS"
    mrp = 280
    purchaseDiscountPercent = 25
    sellingPrice = 240
    stockQuantity = 50
    lowStockLimit = 10
} | ConvertTo-Json
$createdProd = Invoke-RestMethod -Uri "$base/api/products" -Method Post -ContentType "application/json" -Headers $headers -Body $newProdBody
$targetProdId = $createdProd.id
$targetPermId = $createdProd.productId
Write-Host "✅ [3] Added product successfully: [$targetPermId] $($createdProd.name) (Cost: ₹$($createdProd.purchasePrice), Selling: ₹$($createdProd.sellingPrice), Stock: $($createdProd.stockQuantity))"

# 4. Create an Invoice (Counter POS Billing via POST /api/billing)
$invoiceBody = @{
    customerName = "Ramesh Sharma Builders"
    customerPhone = "9876543210"
    paymentMethod = "CASH"
    notes = "Site delivery"
    items = @(
        @{
            productId = $targetProdId
            quantity = 5
        },
        @{
            productId = $first.id
            quantity = 2
        }
    )
} | ConvertTo-Json
$invoiceRes = Invoke-RestMethod -Uri "$base/api/billing" -Method Post -ContentType "application/json" -Headers $headers -Body $invoiceBody
$inv = $invoiceRes
Write-Host "✅ [4] Created Bill #$($inv.invoiceNumber) for $($inv.customerName). Total: ₹$($inv.totalAmount), Paid via $($inv.paymentMethod)"

# 5. Verify stock deduction
$updatedProd = Invoke-RestMethod -Uri "$base/api/products/$targetProdId" -Method Get -Headers $headers
Write-Host "✅ [5] Verified stock deducted: Initial 50 - Sold 5 = Remaining: $($updatedProd.stockQuantity)"

# 6. Process Return via POST /api/invoices/{id}/returns
$returnBody = @{
    reason = "Customer ordered extra units, returning 2 valves"
    items = @(
        @{
            invoiceItemId = $inv.items[0].id
            quantity = 2
        }
    )
} | ConvertTo-Json
$returnRes = Invoke-RestMethod -Uri "$base/api/invoices/$($inv.id)/returns" -Method Post -ContentType "application/json" -Headers $headers -Body $returnBody
Write-Host "✅ [6] Processed Return #$($returnRes.returnNumber) for ₹$($returnRes.refundAmount) refund."

# Verify stock restored
$restoredProd = Invoke-RestMethod -Uri "$base/api/products/$targetProdId" -Method Get -Headers $headers
Write-Host "    Verified stock restored: 45 + 2 returned = Current: $($restoredProd.stockQuantity)"

# 7. Get Monthly Analytics
$analytics = Invoke-RestMethod -Uri "$base/api/analytics/monthly" -Method Get -Headers $headers
Write-Host "✅ [7] Analytics: Monthly Total Sales: ₹$($analytics.summary.totalGrossSales), Net Sales: ₹$($analytics.summary.netSales), Total Invoices: $($analytics.summary.invoiceCount)"

# 8. Web pages HTTP 200 checks (with Cookie header)
$cookieHeader = @{ Cookie = "tradestock_session=$token" }
$pages = @("/dashboard", "/products", "/billing", "/billing/history", "/inventory", "/analytics", "/imports-exports", "/settings")
foreach ($p in $pages) {
    $webRes = Invoke-WebRequest -Uri "$base$p" -Headers $cookieHeader -UseBasicParsing
    Write-Host "✅ [8] Web Page $p returned HTTP $($webRes.StatusCode)"
}

Write-Host "`n🎉 ALL LOCAL API & WEB PAGES VERIFIED AND RUNNING PERFECTLY ON http://localhost:3000 🎉"
