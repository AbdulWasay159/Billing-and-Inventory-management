# TradeStock Pro — Initial Full Project Audit Findings

**Audit Date:** 2026-10-29  
**Auditor:** Principal Software Architect & Application Security Specialist  
**System Under Audit:** TradeStock Pro — Inventory Management & Billing System  
**Environment:** Next.js 16 (App Router), TypeScript 5, React 19, Tailwind CSS 4, Prisma 6 / PostgreSQL & Local JSON Persistence  

---

## 1. Executive Summary

A comprehensive architectural, security, database integrity, financial calculations, and runtime audit was conducted across the TradeStock Pro codebase.

The audit confirmed:
1. **Critical Billing & POS Runtime Error:** The previously observed `Cannot read properties of undefined (reading 'id')` runtime crash was traced to an API response contract mismatch between `/api/billing` and `BillingPage`, compounded by unsaved cart state lifecycles.
2. **High-Risk Security Weaknesses:** A predictable, publicly committed fallback `SESSION_SECRET` allows universal token forgery if environment variables are missing; hardcoded demo credentials were pre-filled on production login screens; and `xlsx@0.18.5` carries known prototype pollution advisories requiring strict input bounds and formula sanitization.
3. **Data Loss & Local Persistence Vulnerability:** The local JSON database manager silently wiped business data on any JSON parse or read error by replacing all records with default initial data. Persistence errors were swallowed without bubbling to callers.
4. **Data Corruption on Excel Roundtrip:** The catalog exporter generated the header `Company / Brand`, but the importer lacked an alias for `Company / Brand`, wiping every product's brand to blank upon re-import. Manual purchase cost overrides were overwritten by calculated formulas.
5. **Financial & Return Calculation Gaps:** Return refund calculations used undiscounted selling prices rather than allocating invoice-level discounts, refunding more money than customers paid. Returned goods did not reverse Cost of Goods Sold (COGS) in analytics.
6. **Query & Pagination Defects:** In PostgreSQL/Prisma mode, the "Unbranded" filter destroyed search OR conditions; low-stock and in-stock conditions were applied in memory after pagination limits were enforced, causing empty/truncated pages and incorrect total counts.

A detailed register of all confirmed defects, root causes, business/security impacts, and remediation plans is provided below.

---

## 2. Confirmed Issue Register

| Issue ID | Severity | Module | Affected File & Lines | Root Cause |
|---|---|---|---|---|
| **ISSUE-01** | **P0** | Billing & POS | `src/app/(dashboard)/billing/page.tsx:189-205`, `src/app/api/billing/route.ts:38-42` | Contract mismatch (`data.invoice.id` vs `data.id`). Undefined access crashed submit handler before clearing items. |
| **ISSUE-02** | **P0** | Security / Auth | `src/lib/auth/session.ts:5-6`, `src/middleware.ts:5-6` | Predictable fallback `SESSION_SECRET` hardcoded in source allows forging arbitrary admin JWT tokens. |
| **ISSUE-03** | **P1** | Security / Auth | `src/app/(auth)/login/page.tsx:9-10, 107-111`, `src/services/auth.service.ts:43-55` | Hardcoded demo credentials pre-filled in production login form and auto-seeded in database. |
| **ISSUE-04** | **P0** | Persistence | `src/lib/db/local-adapter.ts:336-350` | Silent data reset: `load()` catches parse errors and replaces database with initial empty state, wiping business data. Non-atomic file write. |
| **ISSUE-05** | **P1** | Excel / Import | `src/lib/excel/importer.ts:70-76`, `src/lib/excel/exporter.ts:24` | Header mismatch: Exporter emits `Company / Brand`, but importer misses alias, resetting brand to blank on re-import. |
| **ISSUE-06** | **P1** | Excel / Commit | `src/app/api/imports/commit/route.ts:11-17`, `src/services/import-export.service.ts:24-30` | Client-submitted preview rows trusted at commit without independent server-side validation. |
| **ISSUE-07** | **P1** | Finance / Returns | `src/services/return.service.ts:79, 195` | Returns refund undiscounted selling price instead of allocating proportional invoice discount. COGS not reversed. |
| **ISSUE-08** | **P1** | Finance / Billing | `src/services/billing.service.ts:103-104, 205-206` | Invoice discounts exceeding subtotal are accepted without rejection, distorting net totals and ledger balances. |
| **ISSUE-09** | **P1** | Database / Query | `src/lib/db/prisma-adapter.ts:198-216` | Prisma `Unbranded` filter overwrites `where.OR` created by the search query. |
| **ISSUE-10** | **P1** | Database / Query | `src/lib/db/prisma-adapter.ts:234-257` | Low-stock and in-stock conditions applied after SQL `take`/`skip` pagination; `totalCount` calculated pre-filter. |
| **ISSUE-11** | **P1** | Concurrency / DB | `src/lib/db/prisma-adapter.ts:472-484` | Unsafe read-check-write pattern allows concurrent sales to oversell the same available stock. |
| **ISSUE-12** | **P2** | Inventory Validation | `src/lib/db/local-adapter.ts:641-647` vs `src/lib/db/prisma-adapter.ts:475-479` | Local adapter allows negative stock on non-`SALE` transaction types, whereas Prisma strictly forbids negative stock. |
| **ISSUE-13** | **P2** | Profile / Persistence | `prisma/schema.prisma:216-227`, `src/services/auth.service.ts:171-183` | User model lacks `phone` column in PostgreSQL; profile updates silently drop phone number upon save. |
| **ISSUE-14** | **P2** | Scalability | `src/services/import-export.service.ts:211`, `src/services/analytics.service.ts:45, 47` | Fixed `limit: 10000` silently truncates exports and analytics for catalogues exceeding 10,000 items. |
| **ISSUE-15** | **P2** | Analytics / Profit | `src/services/analytics.service.ts:133-137, 168-170` | Returned items refund is recorded, but returned units and returned COGS are not subtracted from COGS and units sold. |
| **ISSUE-16** | **P2** | Configuration | `src/lib/storage/index.ts:157`, `.env:38` | Code checks `STORAGE_PROVIDER`, while `.env` configures `STORAGE_BACKEND`. |
| **ISSUE-17** | **P2** | Excel / Pricing | `src/lib/excel/exporter.ts:44-49` | Exporter unconditionally writes formula for Purchase Price, destroying manual purchase cost overrides on edit. |
| **ISSUE-18** | **P2** | Product Validation | `src/services/product.service.ts:74-80, 110-120` | Form accepts negative numbers or NaN for MRP/prices/stock and silently transforms them to 0. |

---

## 3. Deep Dive into Critical Vulnerabilities & Remediation Strategy

### 3.1 Mandatory Investigation: Billing & POS Error (`reading 'id'`)
- **Error:** `TypeError: Cannot read properties of undefined (reading 'id')`
- **Context:** Billing Counter with Claw Hammer (HW-0002), 3 qty, ₹1,500.00, Cash payment, Save & Print clicked.
- **Root Cause Analysis:**
  1. `/api/billing` historically returned `{ ...invoice }` at the root.
  2. Frontend code attempted to read `data.invoice.id`.
  3. When `data.invoice` was undefined, evaluating `data.invoice.id` threw `Cannot read properties of undefined (reading 'id')`.
  4. The error was caught in `handleSaveInvoice`'s `catch (err)` block, displaying the message in the red error banner.
  5. Because the error occurred before the cart-reset logic (`setItems([])`), the counter remained filled with the exact product, price, and quantities.
  6. The invoice had already been inserted in the database and stock had been deducted, leading to double-billing on retry.
- **Remediation:**
  - Standardize API contract to return both root properties and nested `{ invoice }` shape.
  - In `BillingPage`, use resilient identifier extraction: `const invoiceId = data?.id || data?.invoice?.id`.
  - Validate response payload explicitly before attempting navigation.
  - Guard `addItemToBill` against null/undefined product references.
  - Support barcode scanner input with clean keyboard Enter-key submission.

### 3.2 Security & Authentication Remediation
- **Predictable Session Secret:** Enforce fail-closed startup in production. If `NODE_ENV === 'production'`, require `SESSION_SECRET` with minimum 32 characters; throw a configuration fatal error immediately if missing.
- **Hardcoded Credentials:** Clear default credentials from state and login inputs in production; isolate demo credentials strictly to non-production development environments.
- **Spreadsheet Security:** Enforce strict file size limits (max 10MB), row count limits (max 5,000 rows per batch), workbook structure verification, and formula escaping for CSV exports (`=`, `+`, `-`, `@`).

### 3.3 Data Integrity & Local Persistence Hardening
- **Safe Persistence:** Refuse to reset in-memory data when JSON parsing fails. Move damaged files to a timestamped `.corrupt` recovery file.
- **Atomic Writes:** Write updates to a temporary `.tmp` file and perform an atomic rename to prevent half-written or locked file corruption.
- **Error Propagation:** Re-throw persistence errors so that invoices or imports cannot report success if the database write fails.

### 3.4 Excel Round-Trip & Pricing Integrity
- **Brand Header Fix:** Add `Company / Brand` to `importer.ts` header alias map so exported files can be re-imported without brand loss.
- **Commit Re-validation:** Independently validate every row at commit time for uniqueness, valid numeric ranges, and pricing invariants.
- **Formula & Override Preservation:** Write formulas for Purchase Price and Margin only when costs are formula-derived; preserve explicit manual overrides.

### 3.5 PostgreSQL / Prisma Query Optimization
- **Search & Brand Conjunction:** Combine search OR conditions with brand conditions using explicit Prisma `AND` logic.
- **Correct Pagination:** Apply stock status filters at query time; ensure `totalCount` reflects the exact filtered dataset.
- **Atomic Stock Decrements:** Use conditional database updates (`WHERE "stockQuantity" >= $qty`) to prevent overselling under concurrent requests.

---

## 4. Feature Implementation Plan (Five Required Feature Groups)

1. **Feature 1 — Combined Product Master & Inventory Filters:** Implement server-side filtering by Brand, Stock Status (In Stock, Low Stock, Out of Stock), Size, and Unit with a dedicated Filter modal and dynamic dropdown options.
2. **Feature 2 — Formula-Based Excel Pricing:** Output authentic Excel formulas for Purchase Price (`ROUND(H{r}*(1-I{r}/100),2)`) and Selling Price (`ROUND(J{r}/(1-K{r}/100),2)`), preserving manual overrides.
3. **Feature 3 — Comprehensive Shop Analytics:** Expand date presets (Today, Yesterday, 7 Days, 30 Days, This Week, This Month, Last Month, This Year, Last Year, Specific Date, Custom Range), accurate Gross Profit (`Net Sales − Adjusted COGS`), brand drilldowns, and Cash vs UPI splits.
4. **Feature 4 — Dashboard Navigation:** Make Low Stock and Out of Stock cards clickable links leading to `/products?status=lowStock` and `/products?status=outOfStock` with strict threshold synchronization.
5. **Feature 5 — Brand-Filtered Downloads:** Add "Download by Filter" to Excel & CSV export cards with dynamic brand selection modal and sanitized filenames.

---

## 5. Test & Verification Plan

- Run automated integrity suite covering all 20 business sections.
- Verify real website execution via development server.
- Exercise end-to-end Billing & POS counter workflow with Claw Hammer scenario.
- Test export-edit-import cycle for brand preservation and formula calculations.
- Reconcile shop-wide analytics with brand-wise and product-wise breakdowns.
