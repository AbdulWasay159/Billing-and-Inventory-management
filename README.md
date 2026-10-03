# 🏪 TradeStock Pro

> Responsive Web-Based Inventory Management & Counter POS Billing System designed specifically for trading shops (Hardware, Sanitary, Electrical, Plumbing, and Building Materials).

---

## 🌟 Key Features

- **Responsive Web Design**: Seamlessly adapts from mobile phones (360px) to wide 4K desktop displays.
- **5-Tier Pricing Matrix**:
  $$\text{MRP} \longrightarrow \text{Trade Discount \%} \longrightarrow \text{Auto Purchase Cost} \longrightarrow \text{Previous Selling Rate} \longrightarrow \text{Current Selling Rate}$$
- **Permanent Product ID (`HW-XXXX`)**: Guaranteed unique primary key. Duplicate product names are permitted, but product IDs are strictly unique.
- **Counter POS Billing**: Ultra-fast autocomplete search, dynamic line items (up to 200 items), instant subtotal/grand total calculations, Cash & UPI support (strictly no credit ledgers).
- **Strict A4 Invoice Printing**:
  - Maximum **20 item rows per printed A4 page**.
  - Multi-page continuation headers ("Page X of Y").
  - Intermediate page subtotals and final-page grand total.
  - Pixel-perfect browser printing (`@media print`) and one-click PDF generation (`jspdf`).
- **Bill Editing & Returns**:
  - Bill corrections calculate item quantity deltas and update stock accordingly.
  - Partial or full customer returns automatically restore inventory with audit logging.
- **Dynamic Owner Columns**: Add custom fields (e.g. *Rack/Shelf Location*, *Finish/Color*, *Warranty*) without database schema migrations.
- **16-Step Bulk Excel/CSV Import & Export**:
  - Pre-import validation preview with color-coded diff badges.
  - **Absolute Target Stock Rule**: Sheet stock overwrites database stock to match the sheet exactly, logging `IMPORT_SET` entries.
  - Updates existing products by Product ID without inserting duplicates.
- **Modular Multi-Tenant Architecture**: Single shop operational today, ready for Google Cloud SQL (independent database per shop) + Google Cloud Storage for production multi-shop scale.

---

## 🚀 Quick Start

### 1. Requirements
- Node.js 18.18+ or Node.js 20+
- npm 9+

### 2. Run Locally
```bash
# In D:\Shop Website
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Owner Credentials
- **Email**: `owner@tradestock.com`
- **Password**: `password123`

*(Pre-filled on the login screen for quick access)*

---

## 🛠️ Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js Turbopack development server on `http://localhost:3000` |
| `npm run build` | Compiles optimized Next.js production build (27 App Router routes) |
| `npm run start` | Starts production Next.js server |
| `npm run lint` | Runs ESLint checks |
| `npm test` | Runs the 31-step automated business logic and integrity test suite |

---

## 📁 Project Structure

```text
D:\Shop Website\
├── .tradestock-data\        # Persistent atomic JSON storage with hardware catalog
├── prisma\
│   ├── schema.prisma        # Tenant PostgreSQL schema (Cloud SQL ready)
│   └── platform.prisma      # Multi-tenant platform router schema
├── public\                  # Static assets & icons
├── scripts\
│   ├── test-suite.ts        # 31 unit & integration integrity tests
│   ├── verify-migration.ts  # Schema validation & integrity scripts
│   └── verify-local-running.ps1 # Live server verification script
├── src\
│   ├── app\                 # Next.js App Router (27 pages & API endpoints)
│   │   ├── (auth)\login     # Owner login screen
│   │   ├── (dashboard)\     # Protected dashboard, products, billing, inventory, analytics
│   │   └── api\             # REST endpoints (auth, products, billing, returns, analytics)
│   ├── components\          # Reusable UI modals, responsive tables, sidebars, headers
│   ├── lib\
│   │   ├── auth\            # JWT session cookies & bearer token verification
│   │   ├── db\              # Repository interfaces & connection router
│   │   ├── excel\           # 16-step Excel/CSV importer and canonical exporter
│   │   ├── pdf\             # 20-item/page A4 vector invoice generator
│   │   └── storage\         # Storage abstraction (Local & Google Cloud Storage)
│   ├── services\            # Business logic (billing, products, inventory, returns, analytics)
│   └── types\               # TypeScript domain interfaces
├── .env.example             # Example environment configuration
├── .env.local               # Local environment settings
├── package.json
└── tsconfig.json
```

---

## 🚢 Production Deployment

### Vercel + Supabase / Google Cloud SQL
1. Configure environment variables in Vercel project settings:
   - `SESSION_SECRET`: Long random secret string.
   - `DATABASE_URL`: PostgreSQL connection string.
   - `STORAGE_BACKEND`: `local` or `gcs`.
2. Push repository to GitHub/GitLab and link to Vercel.
3. Deploy! Next.js App Router and Prisma will build and deploy seamlessly.
