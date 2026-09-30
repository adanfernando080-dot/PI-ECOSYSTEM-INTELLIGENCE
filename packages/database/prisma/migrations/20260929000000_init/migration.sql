-- Pi Ecosystem Intelligence — initial schema (V1)

-- CreateEnum
CREATE TYPE "Provenance" AS ENUM ('OBSERVABLE', 'DEVELOPER_REPORTED', 'ESTIMATED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('BLOCKCHAIN', 'PI_API', 'DEVELOPER', 'COMMUNITY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('TRANSACTION_COUNT', 'TRANSACTION_VOLUME_PI', 'ACTIVE_ADDRESSES', 'ACTIVE_USERS', 'STAKED_PI');

-- CreateEnum
CREATE TYPE "AppStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeveloperVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "AnomalyStatus" AS ENUM ('NEW', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AnomalyType" AS ENUM ('ACTIVITY_SPIKE', 'VOLUME_SPIKE', 'CONCENTRATION_SIGNAL', 'REPEATED_TRANSACTION_PATTERN', 'UNUSUAL_REVIEW_ACTIVITY');

-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('CONFIRMED', 'PENDING', 'FAILED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'DEVELOPER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MetricPeriod" AS ENUM ('24h', '7d', '30d', '90d');

-- CreateEnum
CREATE TYPE "RankingType" AS ENUM ('ACTIVITY', 'GROWTH', 'ECONOMIC', 'COMMUNITY', 'TRANSPARENCY', 'TRENDING', 'RISING', 'NEW');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('HIGH', 'GOOD', 'PARTIAL', 'LIMITED', 'VERY_LOW');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "piUsername" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developers" (
    "id" UUID NOT NULL,
    "piUsername" TEXT NOT NULL,
    "displayName" TEXT,
    "verificationStatus" "DeveloperVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "userId" UUID,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apps" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" UUID,
    "url" TEXT,
    "logoUrl" TEXT,
    "status" "AppStatus" NOT NULL DEFAULT 'PENDING',
    "developerId" UUID,
    "methodologyNote" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_sources" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DataSourceType" NOT NULL,
    "trustLevel" INTEGER NOT NULL,
    "description" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_metrics" (
    "id" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "metricType" "MetricType" NOT NULL,
    "value" DECIMAL(24,6),
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "provenance" "Provenance" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_metrics" (
    "id" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "period" "MetricPeriod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "activityScore" DOUBLE PRECISION,
    "growthScore" DOUBLE PRECISION,
    "economicScore" DOUBLE PRECISION,
    "communityScore" DOUBLE PRECISION,
    "transparencyScore" DOUBLE PRECISION,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "confidenceLevel" "ConfidenceLevel" NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "stakedPi" DECIMAL(24,6),
    "details" JSONB NOT NULL DEFAULT '{}',
    "scoringVersion" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "txHash" TEXT NOT NULL,
    "appId" UUID,
    "sender" TEXT NOT NULL,
    "receiver" TEXT NOT NULL,
    "amount" DECIMAL(24,7) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sourceId" UUID NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'CONFIRMED',
    "attributionConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "attributionMethod" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "signals" JSONB NOT NULL DEFAULT '{}',
    "moderationNote" TEXT,
    "moderatedById" UUID,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ranking_snapshots" (
    "id" UUID NOT NULL,
    "rankingType" "RankingType" NOT NULL,
    "appId" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "period" "MetricPeriod" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ranking_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomalies" (
    "id" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "type" "AnomalyType" NOT NULL,
    "severity" "AnomalySeverity" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AnomalyStatus" NOT NULL DEFAULT 'NEW',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "fingerprint" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "userId" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("userId","appId")
);

-- CreateTable
CREATE TABLE "app_claims" (
    "id" UUID NOT NULL,
    "appId" UUID NOT NULL,
    "developerId" UUID NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "evidence" TEXT,
    "reviewedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_piUsername_key" ON "users"("piUsername");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "developers_piUsername_key" ON "developers"("piUsername");

-- CreateIndex
CREATE UNIQUE INDEX "developers_userId_key" ON "developers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "apps_slug_key" ON "apps"("slug");

-- CreateIndex
CREATE INDEX "apps_status_idx" ON "apps"("status");

-- CreateIndex
CREATE INDEX "apps_categoryId_idx" ON "apps"("categoryId");

-- CreateIndex
CREATE INDEX "apps_developerId_idx" ON "apps"("developerId");

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_name_key" ON "data_sources"("name");

-- CreateIndex
CREATE INDEX "raw_metrics_appId_metricType_periodStart_idx" ON "raw_metrics"("appId", "metricType", "periodStart");

-- CreateIndex
CREATE INDEX "raw_metrics_sourceId_idx" ON "raw_metrics"("sourceId");

-- CreateIndex
CREATE INDEX "app_metrics_appId_period_periodEnd_idx" ON "app_metrics"("appId", "period", "periodEnd");

-- CreateIndex
CREATE INDEX "app_metrics_period_periodEnd_idx" ON "app_metrics"("period", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_txHash_key" ON "transactions"("txHash");

-- CreateIndex
CREATE INDEX "transactions_appId_timestamp_idx" ON "transactions"("appId", "timestamp");

-- CreateIndex
CREATE INDEX "transactions_sender_idx" ON "transactions"("sender");

-- CreateIndex
CREATE INDEX "transactions_receiver_idx" ON "transactions"("receiver");

-- CreateIndex
CREATE INDEX "reviews_appId_status_createdAt_idx" ON "reviews"("appId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_appId_userId_key" ON "reviews"("appId", "userId");

-- CreateIndex
CREATE INDEX "ranking_snapshots_rankingType_period_computedAt_idx" ON "ranking_snapshots"("rankingType", "period", "computedAt");

-- CreateIndex
CREATE INDEX "ranking_snapshots_appId_idx" ON "ranking_snapshots"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "anomalies_fingerprint_key" ON "anomalies"("fingerprint");

-- CreateIndex
CREATE INDEX "anomalies_appId_status_idx" ON "anomalies"("appId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "app_claims_appId_developerId_key" ON "app_claims"("appId", "developerId");

-- AddForeignKey
ALTER TABLE "developers" ADD CONSTRAINT "developers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apps" ADD CONSTRAINT "apps_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apps" ADD CONSTRAINT "apps_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "developers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_metrics" ADD CONSTRAINT "raw_metrics_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_metrics" ADD CONSTRAINT "raw_metrics_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_metrics" ADD CONSTRAINT "app_metrics_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_claims" ADD CONSTRAINT "app_claims_appId_fkey" FOREIGN KEY ("appId") REFERENCES "apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_claims" ADD CONSTRAINT "app_claims_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "developers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Data-integrity rules that Prisma cannot express (see ADR-0004).
-- ---------------------------------------------------------------------------

-- A review rating is always 1..5.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

-- Source trust level is 0..100.
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_trust_range" CHECK ("trustLevel" BETWEEN 0 AND 100);

-- Attribution confidence is a probability.
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_attribution_range" CHECK ("attributionConfidence" >= 0 AND "attributionConfidence" <= 1);

-- A missing value is UNAVAILABLE, and UNAVAILABLE never carries a value.
ALTER TABLE "raw_metrics" ADD CONSTRAINT "raw_metrics_provenance_value" CHECK (
    ("provenance" = 'UNAVAILABLE' AND "value" IS NULL)
    OR ("provenance" <> 'UNAVAILABLE' AND "value" IS NOT NULL)
);

-- A metric period is a non-empty interval.
ALTER TABLE "raw_metrics" ADD CONSTRAINT "raw_metrics_period_order" CHECK ("periodEnd" > "periodStart");

-- Score columns are bounded to 0..100 when present.
ALTER TABLE "app_metrics" ADD CONSTRAINT "app_metrics_score_range" CHECK (
    ("activityScore" IS NULL OR "activityScore" BETWEEN 0 AND 100)
    AND ("growthScore" IS NULL OR "growthScore" BETWEEN 0 AND 100)
    AND ("economicScore" IS NULL OR "economicScore" BETWEEN 0 AND 100)
    AND ("communityScore" IS NULL OR "communityScore" BETWEEN 0 AND 100)
    AND ("transparencyScore" IS NULL OR "transparencyScore" BETWEEN 0 AND 100)
    AND ("overallScore" IS NULL OR "overallScore" BETWEEN 0 AND 100)
    AND "confidenceScore" BETWEEN 0 AND 100
);

-- History is never overwritten: app_metrics and ranking_snapshots are append-only.
CREATE OR REPLACE FUNCTION "reject_history_update"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Table % is append-only: historical rows cannot be updated', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "app_metrics_append_only"
    BEFORE UPDATE ON "app_metrics"
    FOR EACH ROW EXECUTE FUNCTION "reject_history_update"();

CREATE TRIGGER "ranking_snapshots_append_only"
    BEFORE UPDATE ON "ranking_snapshots"
    FOR EACH ROW EXECUTE FUNCTION "reject_history_update"();
