ALTER TABLE "User"
ADD COLUMN "instructorId" TEXT;

CREATE UNIQUE INDEX "User_instructorId_key" ON "User"("instructorId");

ALTER TABLE "User"
ADD CONSTRAINT "User_instructorId_fkey"
FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
