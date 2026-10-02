-- Additive migration: app_addresses (several addresses per application, with provenance and verification).
-- Creates new types/table only; no existing table, column or row is altered or deleted.

-- CreateEnum
CREATE TYPE "AddressSource" AS ENUM ('ADMIN_IMPORT', 'DEVELOPER_DECLARED');

-- CreateEnum
CREATE TYPE "AddressVerificationStatus" AS ENUM ('DECLARED', 'VERIFIED');

-- CreateTable
CREATE TABLE "app_addresses" (
    "id" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "source" "AddressSource" NOT NULL,
    "sourceNote" TEXT NOT NULL,
    "verificationStatus" "AddressVerificationStatus" NOT NULL DEFAULT 'DECLARED',
    "verificationMethod" TEXT,
    "verificationEvidence" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_addresses_address_idx" ON "app_addresses"("address");

-- CreateIndex
CREATE UNIQUE INDEX "app_addresses_appId_address_key" ON "app_addresses"("appId", "address");

-- AddForeignKey
ALTER TABLE "app_addresses" ADD CONSTRAINT "app_addresses_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Database-level guarantees (not expressible in the Prisma schema; same approach as the init migration).
-- A VERIFIED address must carry its method, its evidence and the verification date.
ALTER TABLE "app_addresses" ADD CONSTRAINT "app_addresses_verified_requires_proof_chk"
  CHECK ("verificationStatus" <> 'VERIFIED' OR ("verificationMethod" IS NOT NULL AND "verificationEvidence" IS NOT NULL AND "verifiedAt" IS NOT NULL));

-- Provenance is mandatory and an address is a bare token (no whitespace, bounded length).
ALTER TABLE "app_addresses" ADD CONSTRAINT "app_addresses_provenance_chk"
  CHECK (char_length(btrim("sourceNote")) >= 5);
ALTER TABLE "app_addresses" ADD CONSTRAINT "app_addresses_address_format_chk"
  CHECK (char_length("address") BETWEEN 20 AND 128 AND "address" !~ '\s');
