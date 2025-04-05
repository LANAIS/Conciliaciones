/*
  Warnings:

  - You are about to drop the column `frase` on the `PaymentButton` table. All the data in the column will be lost.
  - You are about to drop the column `guid` on the `PaymentButton` table. All the data in the column will be lost.
  - Added the required column `apiKey` to the `PaymentButton` table without a default value. This is not possible if the table is not empty.
  - Added the required column `secretKey` to the `PaymentButton` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Role` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PaymentButton" DROP COLUMN "frase",
DROP COLUMN "guid",
ADD COLUMN     "apiKey" TEXT NOT NULL,
ADD COLUMN     "secretKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationHistory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentButtonId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "recordsAffected" INTEGER NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,

    CONSTRAINT "ReconciliationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledReconciliation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentButtonId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "hour" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL,
    "daysToInclude" INTEGER NOT NULL DEFAULT 7,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmails" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRun" TIMESTAMP(3),
    "nextRun" TIMESTAMP(3),
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "lastExecutionStatus" TEXT,
    "lastErrorMessage" TEXT,

    CONSTRAINT "ScheduledReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualReconciliation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,
    "paymentButtonId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "recordsAffected" INTEGER,
    "totalAmount" DECIMAL(18,2),
    "errorMessage" TEXT,

    CONSTRAINT "ManualReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PermissionToRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "ReconciliationHistory_userId_idx" ON "ReconciliationHistory"("userId");

-- CreateIndex
CREATE INDEX "ReconciliationHistory_organizationId_idx" ON "ReconciliationHistory"("organizationId");

-- CreateIndex
CREATE INDEX "ReconciliationHistory_paymentButtonId_idx" ON "ReconciliationHistory"("paymentButtonId");

-- CreateIndex
CREATE INDEX "ReconciliationHistory_createdAt_idx" ON "ReconciliationHistory"("createdAt");

-- CreateIndex
CREATE INDEX "ScheduledReconciliation_organizationId_idx" ON "ScheduledReconciliation"("organizationId");

-- CreateIndex
CREATE INDEX "ScheduledReconciliation_paymentButtonId_idx" ON "ScheduledReconciliation"("paymentButtonId");

-- CreateIndex
CREATE INDEX "ScheduledReconciliation_createdById_idx" ON "ScheduledReconciliation"("createdById");

-- CreateIndex
CREATE INDEX "ScheduledReconciliation_frequency_idx" ON "ScheduledReconciliation"("frequency");

-- CreateIndex
CREATE INDEX "ScheduledReconciliation_isActive_idx" ON "ScheduledReconciliation"("isActive");

-- CreateIndex
CREATE INDEX "ScheduledReconciliation_nextRun_idx" ON "ScheduledReconciliation"("nextRun");

-- CreateIndex
CREATE INDEX "ManualReconciliation_organizationId_idx" ON "ManualReconciliation"("organizationId");

-- CreateIndex
CREATE INDEX "ManualReconciliation_paymentButtonId_idx" ON "ManualReconciliation"("paymentButtonId");

-- CreateIndex
CREATE INDEX "ManualReconciliation_requestedById_idx" ON "ManualReconciliation"("requestedById");

-- CreateIndex
CREATE INDEX "ManualReconciliation_status_idx" ON "ManualReconciliation"("status");

-- CreateIndex
CREATE INDEX "ManualReconciliation_createdAt_idx" ON "ManualReconciliation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_PermissionToRole_AB_unique" ON "_PermissionToRole"("A", "B");

-- CreateIndex
CREATE INDEX "_PermissionToRole_B_index" ON "_PermissionToRole"("B");

-- AddForeignKey
ALTER TABLE "ReconciliationHistory" ADD CONSTRAINT "ReconciliationHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationHistory" ADD CONSTRAINT "ReconciliationHistory_paymentButtonId_fkey" FOREIGN KEY ("paymentButtonId") REFERENCES "PaymentButton"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationHistory" ADD CONSTRAINT "ReconciliationHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledReconciliation" ADD CONSTRAINT "ScheduledReconciliation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledReconciliation" ADD CONSTRAINT "ScheduledReconciliation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledReconciliation" ADD CONSTRAINT "ScheduledReconciliation_paymentButtonId_fkey" FOREIGN KEY ("paymentButtonId") REFERENCES "PaymentButton"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualReconciliation" ADD CONSTRAINT "ManualReconciliation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualReconciliation" ADD CONSTRAINT "ManualReconciliation_paymentButtonId_fkey" FOREIGN KEY ("paymentButtonId") REFERENCES "PaymentButton"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualReconciliation" ADD CONSTRAINT "ManualReconciliation_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
