import { useState } from "react";
import { Heart, Bookmark, MoreVertical, Plus, Terminal, Code, Sparkles, MessageSquare, FolderPlus, Check, X, Share2, UserPlus, UserCheck } from "lucide-react";
import { FeedCard } from "./cards/FeedCard";
import { FeedItem } from "../types";

interface FeedViewProps {
  items: FeedItem[];
  onToggleLike: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  onAddNewClick: () => void;
  searchQuery: string;
  decks: any[];
  onSaveCardToDeck: (feedItemId: string, deckId: string) => void;
  onSaveToNewDeck: (feedItemId: string, newDeckTitle: string) => void;
  onRemoveCardFromDeck: (feedItemId: string, deckId: string) => void;
  onToggleFollow: (authorUsername: string) => void;
  onViewProfile?: (username: string) => void;
  onSearchChange?: (query: string) => void;
  onStudyDeck?: (deckName: string, deckId?: string) => void;
  feedSubTab: "ONLY_FOR_YOU" | "FOLLOWING";
  setFeedSubTab: (tab: "ONLY_FOR_YOU" | "FOLLOWING") => void;
  isDarkMode?: boolean;
  currentUserId?: string;
  currentUsername?: string;
  onDeletePost?: (id: string) => void;
}

export default function FeedView({
  items,
  onToggleLike,
  onToggleBookmark,
  onAddNewClick,
  searchQuery,
  decks,
  onSaveCardToDeck,
  onSaveToNewDeck,
  onRemoveCardFromDeck,
  onToggleFollow,
  onViewProfile,
  onSearchChange,
  onStudyDeck,
  feedSubTab: activeTab,
  setFeedSubTab: setActiveTab,
  isDarkMode = true,
  currentUserId,
  currentUsername,
  onDeletePost
}: FeedViewProps) {
  const [revealedItems, setRevealedItems] = useState<Record<string, boolean>>({});
  const [revealSteps, setRevealSteps] = useState<Record<string, number>>({});
  const [activeSaveDeckItemId, setActiveSaveDeckItemId] = useState<string | null>(null);

  const getCardMaxSteps = (item: FeedItem): number => {
    if (item.category === "JOKES") return 1;
    if (item.category === "RIDDLES") return 1;
    if (item.codeSnippet && item.title && item.content) return 2;
    if (item.title && item.content) return 1;
    return 0; // single field of data
  };

  const handleNextStep = (id: string, maxSteps: number) => {
    setRevealSteps(prev => {
      const step = prev[id] || 0;
      if (step >= maxSteps) {
        return { ...prev, [id]: 0 };
      }
      return { ...prev, [id]: step + 1 };
    });
  };
  const [savedFeedback, setSavedFeedback] = useState<Record<string, string>>({});
  const [newDeckTitle, setNewDeckTitle] = useState<string>("");
  const [sharedFeedback, setSharedFeedback] = useState<Record<string, boolean>>({});

  const filteredItems = items.filter((item) => {
    const matchesTab = !item.isPrivate;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.codeSnippet && item.codeSnippet.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesTab && matchesSearch;
  });

  const handleToggleReveal = (id: string) => {
    setRevealedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const renderTags = (item: FeedItem, centered = false) => {
    if (!item.tags || item.tags.length === 0) return null;
    return (
      <div
        className={`flex flex-wrap gap-x-2 gap-y-1 pt-2.5 ${centered ? "justify-center" : "justify-start"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {item.tags.map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => {
              if (onSearchChange) {
                onSearchChange(tag);
              }
            }}
            className="text-[10px] font-mono lowercase text-zinc-500/60 hover:text-zinc-200 transition-colors bg-transparent border-0 p-0 m-0 outline-none cursor-pointer"
            title={`Filter by tag #${tag}`}
          >
            #{tag}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full max-w-[640px] mx-auto py-8 px-4 md:px-0 space-y-8 pb-32">
      {filteredItems.length === 0 ? (
        <div className="border border-[#1A1A1A] rounded-xs p-12 text-center bg-surface-container-lowest/45">
          <Terminal className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-4" />
          <p className="text-xs text-on-surface-variant tracking-wider uppercase font-mono">
            {activeTab === "FOLLOWING" ? "No public decks available" : "No entries found matching filters"}
          </p>
          {activeTab === "ONLY_FOR_YOU" ? (
            <button
              onClick={onAddNewClick}
              className="mt-4 px-4 py-1.5 bg-white text-black text-xs font-mono rounded-xs hover:bg-neutral-200 transition-all cursor-pointer border border-white"
            >
              Create First Concept Card
            </button>
          ) : (
            <p className="mt-4 text-[11px] font-sans text-on-surface-variant">
              Publish a deck from your Study Decks to see it here.
            </p>
          )}
        </div>
      ) : (
        filteredItems.map((item) => {
          const isSavedInAnyDeck = decks.some(deck => deck.cards?.some((c: any) => c.answer === item.content));
          const maxSteps = getCardMaxSteps(item);
          const currentStep = revealSteps[item.id] || 0;
          const isSingle = maxSteps === 0;
          const isFullyRevealed = isSingle || currentStep === maxSteps;
          return (
            <FeedCard
              key={item.id}
              isDarkMode={isDarkMode}
              viewMode="feed"
              feedItem={item}
              isSingle={isSingle}
              currentStep={currentStep}
              maxSteps={maxSteps}
              activeTab={activeTab}
              savedFeedback={savedFeedback}
              sharedFeedback={sharedFeedback}
              onToggleReveal={() => !isSingle && handleNextStep(item.id, maxSteps)}
              onViewProfile={onViewProfile}
              onToggleFollow={onToggleFollow}
              onToggleLike={onToggleLike}
              onStudyDeck={onStudyDeck}
              currentUserId={currentUserId}
              currentUsername={currentUsername}
              onDeletePost={onDeletePost}
              onToggleBookmark={onToggleBookmark}
              userDecks={decks}
              onSaveCardToDeck={onSaveCardToDeck}
              onRemoveCardFromDeck={onRemoveCardFromDeck}
            />
          );
        })
      )}

      <div className="text-center pt-8">
        <p className="text-[10px] font-mono text-on-surface-variant/20 tracking-wider">
          --- END OF ACTIVE FEED ---
        </p>
      </div>
    </div>
  );
}
