-- AlterTable
ALTER TABLE "Integration" ADD COLUMN     "accessTokenEnc" TEXT,
ADD COLUMN     "externalAccountId" TEXT,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "refreshTokenEnc" TEXT,
ADD COLUMN     "scope" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3);
