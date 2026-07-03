export interface FeedItem {
  id: string;
  category: string;
  title: string;
  content: string;
  codeSnippet?: string;
  quoteAuthor?: string;
  imageUrl?: string;
  isPrivate?: boolean;
  likes: number;
  likedByUser?: boolean;
  bookmarkedByUser?: boolean;
  timeLabel: string;
  isQuoteStyle?: boolean;
  authorName?: string;
  authorUsername?: string;
  authorId?: string;
  authorAvatar?: string;
  authorAvatarUrl?: string;
  isFollowed?: boolean;
  tags?: string[];
  commentsCount?: number;
}

export interface StudyDeck {
  id: string;
  category: string;
  title: string;
  description: string;
  progress: number; // percentage
  cardCount: number;
  iconType: "terminal" | "javascript" | "database" | "security" | "science" | "brain";
  active?: boolean;
  isPrivate?: boolean;
  isPublic?: boolean;
  tags?: string[];
  originalDeckId?: string;
  hasChanges?: boolean;
  cards: Flashcard[];
  prCount?: number;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  details?: string;
}

export interface SystemLog {
  id: string;
  message: string;
  highlightText?: string;
  logId: string;
  type: "REQUEST_INCOMING" | "SYSTEM_ALERT" | "SYNC_SUCCESS" | "SOCIAL_INTERACTION" | "SYSTEM_GLOBAL";
  timeLabel: string;
  read: boolean;
  unreadState?: boolean;
}

export interface StudyStats {
  totalRetention: number;
  dailyStreak: number;
  studyTime: number; // in hours
  globalRank: string;
}
