-- Add indexes for better performance

-- Tweets: Most common queries are by author and by creation date
CREATE INDEX IF NOT EXISTS "tweets_author_id_created_at_idx" ON "tweets" ("author_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "tweets_created_at_idx" ON "tweets" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "tweets_parent_id_idx" ON "tweets" ("parent_id");

-- Likes: Speed up like/unlike operations and counting
CREATE INDEX IF NOT EXISTS "likes_tweet_id_idx" ON "likes" ("tweet_id");
CREATE INDEX IF NOT EXISTS "likes_user_id_idx" ON "likes" ("user_id");

-- Retweets: Speed up retweet operations and counting
CREATE INDEX IF NOT EXISTS "retweets_tweet_id_idx" ON "retweets" ("tweet_id");
CREATE INDEX IF NOT EXISTS "retweets_user_id_idx" ON "retweets" ("user_id");

-- Bookmarks: Speed up bookmark operations
CREATE INDEX IF NOT EXISTS "bookmarks_user_id_created_at_idx" ON "bookmarks" ("user_id", "created_at" DESC);

-- Follows: Speed up follower/following queries
CREATE INDEX IF NOT EXISTS "follows_follower_id_idx" ON "follows" ("follower_id");
CREATE INDEX IF NOT EXISTS "follows_followee_id_idx" ON "follows" ("followee_id");

-- Notifications: Speed up notification queries
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_idx" ON "notifications" ("user_id", "is_read");

-- Direct Messages: Speed up message queries
CREATE INDEX IF NOT EXISTS "direct_messages_sender_receiver_created_at_idx" ON "direct_messages" ("sender_id", "receiver_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "direct_messages_receiver_read_at_idx" ON "direct_messages" ("receiver_id", "read_at");

-- Media: Speed up media queries
CREATE INDEX IF NOT EXISTS "media_tweet_id_order_idx" ON "media" ("tweet_id", "order");

-- Hashtags: Speed up hashtag queries
CREATE INDEX IF NOT EXISTS "tweet_tags_hashtag_id_created_at_idx" ON "tweet_tags" ("hashtag_id", "created_at" DESC);
