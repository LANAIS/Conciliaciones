/*
  Warnings:

  - You are about to drop the column `apiKey` on the `PaymentButton` table. All the data in the column will be lost.
  - You are about to drop the column `secretKey` on the `PaymentButton` table. All the data in the column will be lost.
  - Added the required column `frase` to the `PaymentButton` table without a default value. This is not possible if the table is not empty.
  - Added the required column `guid` to the `PaymentButton` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PaymentButton" DROP COLUMN "apiKey",
DROP COLUMN "secretKey",
ADD COLUMN     "frase" TEXT NOT NULL,
ADD COLUMN     "guid" TEXT NOT NULL;
