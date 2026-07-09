-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MANAGER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ChecklistItemTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BOOLEAN',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChecklistItemTemplate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "fileUrl" TEXT,
    "fileName" TEXT,
    "submittedBy" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "reviewNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LogEntry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LogEntry_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChecklistItemResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "logEntryId" TEXT NOT NULL,
    "templateItemId" TEXT NOT NULL,
    "valueBoolean" BOOLEAN,
    "valueNumber" REAL,
    "valueText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "note" TEXT,
    CONSTRAINT "ChecklistItemResponse_logEntryId_fkey" FOREIGN KEY ("logEntryId") REFERENCES "LogEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistItemResponse_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "ChecklistItemTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Property_slug_key" ON "Property"("slug");

-- CreateIndex
CREATE INDEX "LogEntry_date_idx" ON "LogEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "LogEntry_propertyId_date_key" ON "LogEntry"("propertyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItemResponse_logEntryId_templateItemId_key" ON "ChecklistItemResponse"("logEntryId", "templateItemId");
