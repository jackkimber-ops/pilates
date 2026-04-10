-- CreateEnum
CREATE TYPE "CustomerPackageSourceType" AS ENUM ('PACKAGE_SALE', 'IMPORTED');

-- AlterTable
ALTER TABLE "CustomerPackage" ADD COLUMN     "classTypeId" TEXT,
ADD COLUMN     "sourceType" "CustomerPackageSourceType" NOT NULL DEFAULT 'PACKAGE_SALE',
ALTER COLUMN "packageTemplateId" DROP NOT NULL,
ALTER COLUMN "expiryDate" DROP NOT NULL,
ALTER COLUMN "amountPaid" SET DEFAULT 0,
ALTER COLUMN "paymentMethod" DROP NOT NULL;

-- Backfill class type from the linked package template before enforcing NOT NULL.
UPDATE "CustomerPackage" AS "customerPackage"
SET "classTypeId" = "packageTemplate"."classTypeId"
FROM "PackageTemplate" AS "packageTemplate"
WHERE "customerPackage"."packageTemplateId" = "packageTemplate"."id";

-- Finalize required class type column after backfill.
ALTER TABLE "CustomerPackage" ALTER COLUMN "classTypeId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "CustomerPackage_customerId_classTypeId_active_expiryDate_idx" ON "CustomerPackage"("customerId", "classTypeId", "active", "expiryDate");

-- CreateIndex
CREATE INDEX "CustomerPackage_sourceType_createdAt_idx" ON "CustomerPackage"("sourceType", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerPackage" ADD CONSTRAINT "CustomerPackage_classTypeId_fkey" FOREIGN KEY ("classTypeId") REFERENCES "ClassType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

