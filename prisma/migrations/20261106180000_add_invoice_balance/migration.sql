-- Balance / partial payment support

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "balance_due" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PAYMENT',
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_mode" TEXT NOT NULL DEFAULT 'CASH',
    "note" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_payments_invoice_id_idx" ON "invoice_payments"("invoice_id");
CREATE INDEX "invoices_balance_due_idx" ON "invoices"("balance_due");

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every invoice created before this feature was paid in full.
-- Returns were refunded in cash, so the amount kept is the total minus returns.
UPDATE "invoices" i
SET "amount_paid" = GREATEST(0, i."final_total" - COALESCE(r.returned, 0)),
    "balance_due" = 0
FROM (
    SELECT inv."id", (SELECT SUM(ret."total_returned_amount") FROM "invoice_returns" ret WHERE ret."invoice_id" = inv."id") AS returned
    FROM "invoices" inv
) r
WHERE r."id" = i."id";

INSERT INTO "invoice_payments" ("id", "invoice_id", "type", "amount", "payment_mode", "note", "paid_at")
SELECT gen_random_uuid()::text, i."id", 'PAYMENT', i."amount_paid", i."payment_mode", 'Paid in full at billing', i."bill_date"
FROM "invoices" i
WHERE i."amount_paid" > 0;
