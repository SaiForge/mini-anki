import React, { useState, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getPost, PostResponse } from "../api/feedApi";
import { FeedItem } from "../types";
import { FeedCard } from "./cards/FeedCard";

interface SinglePostViewProps {
  postId: string;
  autoOpenComments?: boolean;
  onClose: () => void;
  currentUserId?: string;
  currentUsername?: string;
  isDarkMode?: boolean;
  onToggleLike?: (id: string) => void;
  onToggleBookmark?: (id: string) => void;
  decks?: any[];
  onSaveCardToDeck?: (id: string, deckId: string) => void;
  onSaveToNewDeck?: (title: string, desc: string, newDeckTitle: string) => void;
  onRemoveCardFromDeck?: (id: string, deckId: string) => void;
  onDeletePost?: (id: string) => void;
  onOpenUserProfile?: (username: string) => void;
  onToggleFollow?: (username: string, itemContext?: FeedItem) => void;
}

export default function SinglePostView({
  postId,
  autoOpenComments,
  onClose,
  currentUserId,
  currentUsername,
  isDarkMode = true,
  onToggleLike,
  onToggleBookmark,
  decks = [],
  onSaveCardToDeck,
  onSaveToNewDeck,
  onRemoveCardFromDeck,
  onDeletePost,
  onOpenUserProfile,
  onToggleFollow
}: SinglePostViewProps) {
  const [post, setPost] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const getCardMaxSteps = (item: FeedItem): number => {
    if (item.category === "JOKES") return 1;
    if (item.category === "RIDDLES") return 1;
    if (item.codeSnippet && item.title && item.content) return 2;
    if (item.title && item.content) return 1;
    return 0;
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPost(postId)
      .then((p: PostResponse) => {
        if (!active) return;
        const item: FeedItem = {
          id: p.post_id,
          category: p.category || p.content_type || "CONCEPT",
          title: p.title || "",
          content: p.body,
          codeSnippet: p.code_snippet || undefined,
          imageUrl: p.image_url || undefined,
          likes: p.likes_count,
          likedByUser: p.is_liked,
          bookmarkedByUser: p.is_bookmarked,
          timeLabel: new Date(p.created_at).toLocaleDateString(),
          isPrivate: p.is_private,
          authorName: p.author_full_name || p.author_username || "Unknown",
          authorUsername: p.author_username ? `@${p.author_username}` : "@unknown",
          authorId: p.author_id,
          authorAvatar: p.author_username ? p.author_username.substring(0, 1).toUpperCase() : "U",
          commentsCount: p.comments_count,
          isFollowed: p.is_followed,
        };
        setPost(item);
      })
      .catch(err => {
        if (!active) return;
        console.error(err);
        setError("Failed to load post");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [postId]);

  return (
    <div className="max-w-[860px] mx-auto px-4 lg:px-8 py-8 pb-32">
      <div className="mb-6 flex items-center">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 hover:text-white transition-colors uppercase tracking-wider cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-600 gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-[10px] font-mono uppercase tracking-widest">Loading Post...</span>
        </div>
      ) : error || !post ? (
        <div className="py-20 text-center text-[10px] font-mono uppercase tracking-widest text-red-500">
          {error || "Post not found"}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <FeedCard
            feedItem={post}
            isDarkMode={isDarkMode}
            currentUserId={currentUserId}
            currentUsername={currentUsername}
            isSingle={getCardMaxSteps(post) === 0}
            currentStep={currentStep}
            maxSteps={getCardMaxSteps(post)}
            onToggleReveal={() => {
              const max = getCardMaxSteps(post);
              setCurrentStep(prev => (prev >= max ? 0 : prev + 1));
            }}
            onToggleLike={(id) => {
              setPost(prev => prev ? { ...prev, likedByUser: !prev.likedByUser, likes: prev.likedByUser ? prev.likes - 1 : prev.likes + 1 } : prev);
              if (onToggleLike) onToggleLike(id, post || undefined);
            }}
            onToggleBookmark={(id) => {
              setPost(prev => prev ? { ...prev, bookmarkedByUser: !prev.bookmarkedByUser } : prev);
              if (onToggleBookmark) onToggleBookmark(id, post || undefined);
            }}
            onToggleFollow={(username) => {
              setPost(prev => prev ? { ...prev, isFollowed: !prev.isFollowed } : prev);
              if (onToggleFollow) onToggleFollow(username, post || undefined);
            }}
            userDecks={decks}
            onSaveCardToDeck={(id, deckId) => {
              if (onSaveCardToDeck) onSaveCardToDeck(id, deckId, post || undefined);
            }}
            onSaveToNewDeck={(id, newDeckTitle) => {
              if (onSaveToNewDeck) onSaveToNewDeck(id, newDeckTitle, post || undefined);
            }}
            onRemoveCardFromDeck={(id, deckId) => {
              if (onRemoveCardFromDeck) onRemoveCardFromDeck(id, deckId, post || undefined);
            }}
            onDeletePost={onDeletePost}
            onViewProfile={onOpenUserProfile}
            autoOpenComments={autoOpenComments}
          />
        </div>
      )}
    </div>
  );
}
