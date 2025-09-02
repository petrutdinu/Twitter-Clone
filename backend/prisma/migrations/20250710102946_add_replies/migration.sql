-- AlterTable
ALTER TABLE "tweets" ADD COLUMN     "parent_id" TEXT;

-- AddForeignKey
ALTER TABLE "tweets" ADD CONSTRAINT "tweets_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "tweets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
