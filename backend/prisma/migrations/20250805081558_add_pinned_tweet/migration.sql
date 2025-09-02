-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pinned_tweet_id" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_pinned_tweet_id_fkey" FOREIGN KEY ("pinned_tweet_id") REFERENCES "tweets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
