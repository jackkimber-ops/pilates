CREATE TYPE "CreditHistoryType" AS ENUM ('PACKAGE_PURCHASE', 'ATTENDED', 'CANCELLED', 'MANUAL_ADJUSTMENT');

CREATE TABLE "CustomerCreditHistory" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "classTypeId" TEXT NOT NULL,
    "change" INTEGER NOT NULL,
    "type" "CreditHistoryType" NOT NULL,
    "note" TEXT,
    "relatedSessionId" TEXT,
    "relatedBookingId" TEXT,
    "customerPackageTransactionId" TEXT,
    "customerTrialPackageItemTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerCreditHistory_pkey" PRIMARY KEY ("id")
);

INSERT INTO "CustomerCreditHistory" (
    "id",
    "customerId",
    "classTypeId",
    "change",
    "type",
    "note",
    "relatedSessionId",
    "relatedBookingId",
    "customerPackageTransactionId",
    "createdAt"
)
SELECT
    CONCAT('cch_pkg_', package_event."id"),
    customer_package."customerId",
    customer_package."classTypeId",
    package_event."deltaCredits",
    CASE package_event."eventType"::TEXT
        WHEN 'PACKAGE_SALE' THEN 'PACKAGE_PURCHASE'
        WHEN 'USAGE' THEN 'ATTENDED'
        WHEN 'RESTORE' THEN 'CANCELLED'
        ELSE 'MANUAL_ADJUSTMENT'
    END::"CreditHistoryType",
    COALESCE(
        package_event."notes",
        CASE package_event."eventType"::TEXT
            WHEN 'PACKAGE_SALE' THEN 'Package purchased'
            WHEN 'IMPORTED_BALANCE' THEN 'Imported balance'
            WHEN 'USAGE' THEN 'Attended'
            WHEN 'RESTORE' THEN 'Session cancelled'
            ELSE package_event."reason"
        END
    ),
    package_event."sessionId",
    package_event."bookingId",
    package_event."id",
    package_event."createdAt"
FROM "CustomerPackageTransaction" package_event
JOIN "CustomerPackage" customer_package ON customer_package."id" = package_event."customerPackageId"
WHERE package_event."deltaCredits" <> 0;

INSERT INTO "CustomerCreditHistory" (
    "id",
    "customerId",
    "classTypeId",
    "change",
    "type",
    "note",
    "relatedSessionId",
    "relatedBookingId",
    "customerTrialPackageItemTransactionId",
    "createdAt"
)
SELECT
    CONCAT('cch_trial_', trial_event."id"),
    trial_package."customerId",
    trial_item."classTypeId",
    trial_event."deltaQuantity",
    CASE trial_event."eventType"::TEXT
        WHEN 'TRIAL_SALE' THEN 'PACKAGE_PURCHASE'
        WHEN 'USAGE' THEN 'ATTENDED'
        WHEN 'RESTORE' THEN 'CANCELLED'
        ELSE 'MANUAL_ADJUSTMENT'
    END::"CreditHistoryType",
    COALESCE(
        trial_event."notes",
        CASE trial_event."eventType"::TEXT
            WHEN 'TRIAL_SALE' THEN 'Trial package purchased'
            WHEN 'USAGE' THEN 'Attended'
            WHEN 'RESTORE' THEN 'Session cancelled'
            ELSE trial_event."reason"
        END
    ),
    trial_event."sessionId",
    trial_event."bookingId",
    trial_event."id",
    trial_event."createdAt"
FROM "CustomerTrialPackageItemTransaction" trial_event
JOIN "CustomerTrialPackageItem" trial_item ON trial_item."id" = trial_event."customerTrialPackageItemId"
JOIN "CustomerTrialPackage" trial_package ON trial_package."id" = trial_item."customerTrialPackageId"
WHERE trial_event."deltaQuantity" <> 0;

CREATE UNIQUE INDEX "CustomerCreditHistory_customerPackageTransactionId_key" ON "CustomerCreditHistory"("customerPackageTransactionId");
CREATE UNIQUE INDEX "CustomerCreditHistory_customerTrialPackageItemTransactionId_key" ON "CustomerCreditHistory"("customerTrialPackageItemTransactionId");
CREATE INDEX "CustomerCreditHistory_customerId_createdAt_idx" ON "CustomerCreditHistory"("customerId", "createdAt");
CREATE INDEX "CustomerCreditHistory_customerId_classTypeId_createdAt_idx" ON "CustomerCreditHistory"("customerId", "classTypeId", "createdAt");
CREATE INDEX "CustomerCreditHistory_relatedSessionId_idx" ON "CustomerCreditHistory"("relatedSessionId");
CREATE INDEX "CustomerCreditHistory_relatedBookingId_idx" ON "CustomerCreditHistory"("relatedBookingId");
CREATE INDEX "CustomerCreditHistory_type_createdAt_idx" ON "CustomerCreditHistory"("type", "createdAt");

ALTER TABLE "CustomerCreditHistory" ADD CONSTRAINT "CustomerCreditHistory_change_nonzero" CHECK ("change" <> 0);
ALTER TABLE "CustomerCreditHistory" ADD CONSTRAINT "CustomerCreditHistory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerCreditHistory" ADD CONSTRAINT "CustomerCreditHistory_classTypeId_fkey" FOREIGN KEY ("classTypeId") REFERENCES "ClassType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerCreditHistory" ADD CONSTRAINT "CustomerCreditHistory_relatedSessionId_fkey" FOREIGN KEY ("relatedSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerCreditHistory" ADD CONSTRAINT "CustomerCreditHistory_relatedBookingId_fkey" FOREIGN KEY ("relatedBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerCreditHistory" ADD CONSTRAINT "CustomerCreditHistory_customerPackageTransactionId_fkey" FOREIGN KEY ("customerPackageTransactionId") REFERENCES "CustomerPackageTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerCreditHistory" ADD CONSTRAINT "CustomerCreditHistory_customerTrialPackageItemTransactionId_fkey" FOREIGN KEY ("customerTrialPackageItemTransactionId") REFERENCES "CustomerTrialPackageItemTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
