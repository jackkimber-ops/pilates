CREATE INDEX "CustomerPackage_sourceType_purchaseDate_idx" ON "CustomerPackage"("sourceType", "purchaseDate");
CREATE INDEX "CustomerTrialPackage_purchaseDate_idx" ON "CustomerTrialPackage"("purchaseDate");
CREATE INDEX "PackageAdjustment_createdAt_idx" ON "PackageAdjustment"("createdAt");
CREATE INDEX "SingleClassPurchase_purchaseDate_idx" ON "SingleClassPurchase"("purchaseDate");
CREATE INDEX "Session_startsAt_endsAt_idx" ON "Session"("startsAt", "endsAt");
CREATE INDEX "Booking_customerId_createdAt_idx" ON "Booking"("customerId", "createdAt");
CREATE INDEX "Booking_status_createdAt_idx" ON "Booking"("status", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
