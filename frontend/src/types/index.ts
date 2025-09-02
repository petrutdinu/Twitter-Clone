export interface User {
  id: string;
  username: string;
  displayName?: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  pinnedTweetId?: string;
  createdAt: string;
  _count?: {
    followers: number;
    following: number;
    tweets: number;
  };
  isFollowing?: boolean;
  pinnedTweet?: Tweet;
}

export interface Tweet {
  id: string;
  text: string;
  createdAt: string;
  parentId?: string;
  type?: 'tweet' | 'retweet';
  deleted?: boolean;
  isPinned?: boolean;
  retweetedBy?: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  parent?: {
    id: string;
    text: string;
    author: {
      id: string;
      username: string;
      displayName?: string;
      avatarUrl?: string;
    };
  };
  author: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  media?: Media[];
  poll?: Poll;
  hashtags?: { hashtag: { tag: string } }[];
  _count: {
    likes: number;
    retweets: number;
    bookmarks?: number;
  };
  isLiked: boolean;
  isRetweeted: boolean;
  isBookmarked: boolean;
}

export interface Media {
  id: string;
  url: string;
  type: 'IMAGE' | 'VIDEO' | 'GIF';
  order: number;
}

export interface GifObject {
  id: string;
  title: string;
  url: string;
  width?: string;
  height?: string;
  images: {
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    fixed_height_small: {
      url: string;
      width: string;
      height: string;
    };
    original: {
      url: string;
      width: string;
      height: string;
    };
  };
}

export interface Poll {
  id: string;
  expiresAt: string;
  options: PollOption[];
}

export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
  _count?: {
    votes: number;
  };
  votes?: Array<{ id: string }>;
}

export interface Notification {
  id: string;
  type: 'LIKE' | 'RETWEET' | 'FOLLOW' | 'MENTION' | 'REPLY' | 'POLL_VOTE';
  isRead: boolean;
  createdAt: string;
  sourceUser?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  sourceTweet?: {
    id: string;
    text: string;
  };
}

export interface DirectMessage {
  id: string;
  text: string;
  createdAt: string;
  status?: 'SENT' | 'DELIVERED' | 'READ';
  readAt?: string;
  gifUrl?: string;
  imageUrl?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  sender: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  receiver: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export interface AuthResponse {
  success: boolean;
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  nextCursor?: string;
}
