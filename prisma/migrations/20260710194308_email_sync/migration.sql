-- AlterEnum
ALTER TYPE "SourceType" ADD VALUE 'EMAIL';

-- CreateTable
CREATE TABLE "ProcessedEmail" (
    "id" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "logEntryId" TEXT,
    "emailSubject" TEXT,
    "emailFrom" TEXT,
    "emailDate" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEmail_gmailMessageId_key" ON "ProcessedEmail"("gmailMessageId");

-- AddForeignKey
ALTER TABLE "ProcessedEmail" ADD CONSTRAINT "ProcessedEmail_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

