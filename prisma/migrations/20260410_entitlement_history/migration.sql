-- CreateEnum
CREATE TYPE "CustomerPackageTransactionType" AS ENUM ('OPENING_SNAPSHOT', 'PACKAGE_SALE', 'IMPORTED_BALANCE', 'USAGE', 'RESTORE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CustomerTrialPackageItemTransactionType" AS ENUM ('OPENING_SNAPSHOT', 'TRIAL_SALE', 'USAGE', 'RESTORE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "CustomerPackageTransaction" (
    "id" TEXT NOT NULL,
    "customerPackageId" TEXT NOT NULL,
    "bookingId" TEXT,
    "sessionId" TEXT,
    "packageAdjustmentId" TEXT,
    "createdByUserId" TEXT,
    "eventType" "CustomerPackageTransactionType" NOT NULL,
    "deltaCredits" INTEGER NOT NULL,
    "resultingCredits" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPackageTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerTrialPackageItemTransaction" (
    "id" TEXT NOT NULL,
    "customerTrialPackageItemId" TEXT NOT NULL,
    "bookingId" TEXT,
    "sessionId" TEXT,
    "createdByUserId" TEXT,
    "eventType" "CustomerTrialPackageItemTransactionType" NOT NULL,
    "deltaQuantity" INTEGER NOT NULL,
    "resultingQuantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerTrialPackageItemTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPackageTransaction_packageAdjustmentId_key" ON "CustomerPackageTransaction"("packageAdjustmentId");

-- CreateIndex
CREATE INDEX "CustomerPackageTransaction_customerPackageId_createdAt_idx" ON "CustomerPackageTransaction"("customerPackageId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerPackageTransaction_bookingId_idx" ON "CustomerPackageTransaction"("bookingId");

-- CreateIndex
CREATE INDEX "CustomerPackageTransaction_sessionId_idx" ON "CustomerPackageTransaction"("sessionId");

-- CreateIndex
CREATE INDEX "CustomerPackageTransaction_createdByUserId_createdAt_idx" ON "CustomerPackageTransaction"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerTrialPackageItemTransaction_customerTrialPackageItemId_created_idx" ON "CustomerTrialPackageItemTransaction"("customerTrialPackageItemId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerTrialPackageItemTransaction_bookingId_idx" ON "CustomerTrialPackageItemTransaction"("bookingId");

-- CreateIndex
CREATE INDEX "CustomerTrialPackageItemTransaction_sessionId_idx" ON "CustomerTrialPackageItemTransaction"("sessionId");

-- CreateIndex
CREATE INDEX "CustomerTrialPackageItemTransaction_createdByUserId_createdAt_idx" ON "CustomerTrialPackageItemTransaction"("createdByUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerPackageTransaction" ADD CONSTRAINT "CustomerPackageTransaction_customerPackageId_fkey" FOREIGN KEY ("customerPackageId") REFERENCES "CustomerPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPackageTransaction" ADD CONSTRAINT "CustomerPackageTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPackageTransaction" ADD CONSTRAINT "CustomerPackageTransaction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPackageTransaction" ADD CONSTRAINT "CustomerPackageTransaction_packageAdjustmentId_fkey" FOREIGN KEY ("packageAdjustmentId") REFERENCES "PackageAdjustment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPackageTransaction" ADD CONSTRAINT "CustomerPackageTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTrialPackageItemTransaction" ADD CONSTRAINT "CustomerTrialPackageItemTransaction_customerTrialPackageItemId_fkey" FOREIGN KEY ("customerTrialPackageItemId") REFERENCES "CustomerTrialPackageItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTrialPackageItemTransaction" ADD CONSTRAINT "CustomerTrialPackageItemTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTrialPackageItemTransaction" ADD CONSTRAINT "CustomerTrialPackageItemTransaction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTrialPackageItemTransaction" ADD CONSTRAINT "CustomerTrialPackageItemTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraints
ALTER TABLE "CustomerPackage"
    ADD CONSTRAINT "CustomerPackage_originalCredits_nonnegative" CHECK ("originalCredits" >= 0),
    ADD CONSTRAINT "CustomerPackage_remainingCredits_nonnegative" CHECK ("remainingCredits" >= 0);

ALTER TABLE "CustomerTrialPackageItem"
    ADD CONSTRAINT "CustomerTrialPackageItem_originalQuantity_nonnegative" CHECK ("originalQuantity" >= 0),
    ADD CONSTRAINT "CustomerTrialPackageItem_remainingQuantity_nonnegative" CHECK ("remainingQuantity" >= 0);

ALTER TABLE "PackageAdjustment"
    ADD CONSTRAINT "PackageAdjustment_deltaCredits_nonzero" CHECK ("deltaCredits" <> 0);

-- BackfillOpeningSnapshots
INSERT INTO "CustomerPackageTransaction" (
    "id",
    "customerPackageId",
    "eventType",
    "deltaCredits",
    "resultingCredits",
    "reason",
    "notes",
    "createdAt"
)
SELECT
    'pkgsnap_' || "id",
    "id",
    'OPENING_SNAPSHOT'::"CustomerPackageTransactionType",
    0,
    "remainingCredits",
    'Opening snapshot',
    'Backfilled when entitlement history was introduced',
    "createdAt"
FROM "CustomerPackage"
WHERE NOT EXISTS (
    SELECT 1
    FROM "CustomerPackageTransaction"
    WHERE "CustomerPackageTransaction"."customerPackageId" = "CustomerPackage"."id"
);

INSERT INTO "CustomerTrialPackageItemTransaction" (
    "id",
    "customerTrialPackageItemId",
    "eventType",
    "deltaQuantity",
    "resultingQuantity",
    "reason",
    "notes",
    "createdAt"
)
SELECT
    'trialsnap_' || "id",
    "id",
    'OPENING_SNAPSHOT'::"CustomerTrialPackageItemTransactionType",
    0,
    "remainingQuantity",
    'Opening snapshot',
    'Backfilled when entitlement history was introduced',
    "createdAt"
FROM "CustomerTrialPackageItem"
WHERE NOT EXISTS (
    SELECT 1
    FROM "CustomerTrialPackageItemTransaction"
    WHERE "CustomerTrialPackageItemTransaction"."customerTrialPackageItemId" = "CustomerTrialPackageItem"."id"
);
