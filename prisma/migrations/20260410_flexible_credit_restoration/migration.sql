-- AlterTable
ALTER TABLE "Booking"
ADD COLUMN "restoredAt" TIMESTAMP(3),
ADD COLUMN "reversedByUserId" TEXT;

-- AlterTable
ALTER TABLE "PackageAdjustment"
ADD COLUMN "notes" TEXT;

-- CreateIndex
CREATE INDEX "Booking_reversedByUserId_restoredAt_idx" ON "Booking"("reversedByUserId", "restoredAt");

-- AddForeignKey
ALTER TABLE "Booking"
ADD CONSTRAINT "Booking_reversedByUserId_fkey"
FOREIGN KEY ("reversedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
