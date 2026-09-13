-- AlterTable
ALTER TABLE "Decision" ADD COLUMN     "consequences" TEXT,
ADD COLUMN     "evidence" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "relatedEventIds" JSONB NOT NULL DEFAULT '[]';
