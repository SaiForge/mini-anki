import { useState, useEffect, useCallback } from "react";
import { FeedCard } from "./cards/FeedCard";
import { browseDecks, getTrendingDecks, searchAll, forkDeck, likeDeck, unlikeDeck, PublicDeck } from "../api/exploreApi";
import { Heart, GitFork, Layers, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ExploreViewProps {
  onStudyDeck: (deckName: string, deckId?: string) => void;
  searchQuery: string;
  decks: any[];
  feedItems?: any[];
  onSaveCardToDeck: (title: string, desc: string, deckId: string) => void;
  onSaveToNewDeck: (title: string, desc: string, newDeckTitle: string) => void;
  onRemoveCardFromDeck: (title: string, desc: string, deckId: string) => void;
  onToggleFollow?: (authorUsername: string) => void;
  onViewProfile?: (username: string) => void;
  isDarkMode?: boolean;
  currentUserId?: string;
  currentUsername?: string;
}

export default function ExploreView({
  onStudyDeck,
  searchQuery,
  decks,
  feedItems = [],
  onSaveCardToDeck,
  onSaveToNewDeck,
  onRemoveCardFromDeck,
  onToggleFollow,
  onViewProfile,
  isDarkMode = true,
  currentUserId,
  currentUsername,
}: ExploreViewProps) {
  const [activeCategory, setActiveCategory] = useState<string>("Trending");
  const [liveDecks, setLiveDecks] = useState<PublicDeck[]>([]);
  const [liveUsers, setLiveUsers] = useState<any[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [forkStatus, setForkStatus] = useState<Record<string, "idle" | "loading" | "done">>({});
  const [likeStatus, setLikeStatus] = useState<Record<string, boolean>>({});
  const [searchTab, setSearchTab] = useState<"all" | "decks" | "cards" | "users">("all");

  // Fetch live public decks from backend
  const loadLiveDecks = useCallback(async () => {
    setLiveLoading(true);
    setLiveError(null);
    try {
      if (searchQuery && searchQuery.length >= 2) {
        const results = await searchAll(searchQuery, 20);
        setLiveDecks(results.decks);
        setLiveUsers(results.users || []);
      } else if (activeCategory === "Trending") {
        const trending = await getTrendingDecks(12);
        setLiveDecks(trending);
      } else {
        const res = await browseDecks({ category: activeCategory, limit: 20 });
        setLiveDecks(res.items);
      }
    } catch (e: any) {
      console.error("[ExploreView] Could not load live decks:", e);
      setLiveError(e?.response?.data?.detail || e?.message || "Failed to load decks");
    } finally {
      setLiveLoading(false);
    }
  }, [searchQuery, activeCategory]);

  useEffect(() => {
    loadLiveDecks();
  }, [loadLiveDecks]);

  const handleForkDeck = async (deckId: string) => {
    setForkStatus(prev => ({ ...prev, [deckId]: "loading" }));
    try {
      await forkDeck(deckId);
      setForkStatus(prev => ({ ...prev, [deckId]: "done" }));
    } catch (e) {
      console.error("Fork failed", e);
      setForkStatus(prev => ({ ...prev, [deckId]: "idle" }));
    }
  };

  const handleToggleLikeDeck = async (deck: PublicDeck) => {
    const isLiked = likeStatus[deck.deck_id] ?? deck.is_liked;
    setLikeStatus(prev => ({ ...prev, [deck.deck_id]: !isLiked }));
    try {
      if (isLiked) {
        await unlikeDeck(deck.deck_id);
      } else {
        await likeDeck(deck.deck_id);
      }
    } catch (e) {
      setLikeStatus(prev => ({ ...prev, [deck.deck_id]: isLiked }));
    }
  };

  const hasSearch = searchQuery.trim().length > 0;

  const filteredFeedItems = feedItems.filter(item => {
    if (!hasSearch) return false;
    const q = searchQuery.toLowerCase();
    return (
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.tags && item.tags.some((tag: string) => tag.toLowerCase().includes(q))) ||
      (item.content && item.content.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-8 space-y-12 pb-32">

      {/* Search Tabs */}
      {hasSearch && (
        <div className={`flex items-center gap-6 border-b pb-4 mb-6 ${isDarkMode ? "border-white/10" : "border-[#c9ada7]/30"}`}>
          {(["all", "decks", "cards", "users"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSearchTab(tab)}
              className={`text-[13px] font-semibold transition-all duration-300 relative outline-none cursor-pointer ${
                searchTab === tab 
                  ? (isDarkMode ? "text-white" : "text-[#22223b]") 
                  : (isDarkMode ? "text-zinc-500 hover:text-zinc-300" : "text-[#4a4e69] hover:text-[#22223b]")
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {searchTab === tab && (
                <motion.div 
                  layoutId="search-tab-indicator"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  className={`absolute -bottom-[17px] left-0 right-0 h-[2px] rounded-t-full ${
                    isDarkMode ? "bg-white" : "bg-[#22223b]"
                  }`} 
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Search results — related posts from feed */}
      {hasSearch && (
        <AnimatePresence mode="wait">
          <motion.div 
            key={`search-results-${searchTab}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {(searchTab === "all" || searchTab === "users") && (liveLoading ? (
            <div key={`users-skeleton-${searchTab}`} className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Users</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2].map(i => (
                  <div key={i} className={`flex items-center gap-4 p-4 border rounded-lg animate-pulse ${isDarkMode ? "border-[#1A1A1A] bg-black" : "border-[#c9ada7]/30 bg-[#fdfbfb]"}`}>
                    <div className={`w-12 h-12 rounded-full ${isDarkMode ? "bg-zinc-800" : "bg-[#c9ada7]/20"}`} />
                    <div className="flex-1 space-y-2">
                      <div className={`h-4 rounded w-1/2 ${isDarkMode ? "bg-zinc-800" : "bg-[#c9ada7]/20"}`} />
                      <div className={`h-3 rounded w-1/3 ${isDarkMode ? "bg-zinc-800" : "bg-[#c9ada7]/20"}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : liveUsers.length > 0 ? (
            <div key={`users-content-${searchTab}`} className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Users</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {liveUsers.map((u) => (
                  <div
                    key={u.user_id}
                    className={`flex items-center gap-4 p-4 border rounded-lg transition-colors cursor-pointer group ${
                      isDarkMode ? "border-[#1A1A1A] bg-black hover:border-zinc-800" : "border-[#c9ada7]/30 bg-[#fdfbfb] hover:border-[#c9ada7]"
                    }`}
                    onClick={() => onViewProfile && u.username && onViewProfile(u.username)}
                  >
                    <div className={`w-12 h-12 rounded-full overflow-hidden border flex-shrink-0 flex items-center justify-center font-mono text-xs uppercase ${
                      isDarkMode ? "bg-zinc-900 border-zinc-800 text-zinc-500" : "bg-[#f2e9e4] border-[#c9ada7]/50 text-[#4a4e69]"
                    }`}>
                      {u.profile_picture_url ? (
                        <img src={u.profile_picture_url} alt={u.username || "User"} className="w-full h-full object-cover" />
                      ) : (
                        (u.full_name || u.username || "?").substring(0, 2)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-semibold font-sans truncate transition-colors ${
                        isDarkMode ? "text-white group-hover:text-blue-400" : "text-[#22223b] group-hover:text-rose-500"
                      }`}>
                        {u.full_name || u.username}
                      </h3>
                      <p className={`text-xs font-mono truncate ${isDarkMode ? "text-zinc-500" : "text-[#4a4e69]"}`}>@{u.username || "anonymous"}</p>
                      {u.bio && <p className={`text-[11px] mt-1 truncate ${isDarkMode ? "text-zinc-400" : "text-[#4a4e69]/80"}`}>{u.bio}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null)}

          {(searchTab === "all" || searchTab === "cards") && filteredFeedItems.length > 0 && (
            <div key={`cards-content-${searchTab}`} className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Related Cards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredFeedItems.map(item => (
              <FeedCard
                key={item.id}
                feedItem={item}
                onToggleLike={() => {}}
                onToggleBookmark={() => {}}
                userDecks={decks}
                onSaveCardToDeck={(id, deckId) => onSaveCardToDeck(item.title || "", item.content, deckId)}
                onSaveToNewDeck={onSaveToNewDeck}
                onRemoveCardFromDeck={(id, deckId) => onRemoveCardFromDeck(item.title || "", item.content, deckId)}
                onToggleFollow={onToggleFollow}
                isDarkMode={isDarkMode}
                currentUserId={currentUserId}
                currentUsername={currentUsername}
              />
            ))}
          </div>
            </div>
          )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Community Decks */}
      <AnimatePresence mode="wait">
        {(!hasSearch || searchTab === "all" || searchTab === "decks") && (
        <motion.div 
          key={`community-decks-${hasSearch ? searchTab : 'browse'}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Community Decks
            {!liveLoading && (
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest ml-1">
                {liveDecks.length} public
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {liveLoading && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
                <div className="w-3 h-3 border border-zinc-700 border-t-white rounded-full animate-spin" />
                Loading…
              </div>
            )}
            <button
              onClick={loadLiveDecks}
              className="text-[10px] font-mono text-zinc-600 hover:text-white transition-colors px-2 py-1 border border-[#1a1a1a] rounded hover:border-zinc-700 cursor-pointer"
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {liveError ? (
          <div className="border border-red-900/40 bg-red-950/10 rounded-lg p-4 text-[11px] font-mono text-red-400 flex items-center gap-2">
            <span>⚠</span>
            <span>Could not load community decks: {liveError}</span>
          </div>
        ) : liveLoading ? (
          <div key={`decks-skeleton-${searchTab}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {[1, 2, 3].map(i => (
              <div key={i} className={`border rounded-xl p-5 animate-pulse space-y-4 ${
                isDarkMode ? "border-[rgba(255,255,255,0.05)] bg-[#0a0a0a]/90" : "border-[#c9ada7]/20 bg-[#fdfbfb]/90"
              }`}>
                <div className={`h-3 rounded w-1/3 ${isDarkMode ? "bg-zinc-800" : "bg-[#c9ada7]/30"}`} />
                <div className={`h-4 rounded w-2/3 ${isDarkMode ? "bg-zinc-800" : "bg-[#c9ada7]/30"}`} />
                <div className={`h-10 rounded w-full mt-4 ${isDarkMode ? "bg-zinc-800" : "bg-[#c9ada7]/30"}`} />
              </div>
            ))}
          </div>
        ) : liveDecks.length === 0 ? (
          <div className="border border-[#1a1a1a] rounded-lg p-10 text-center space-y-2">
            <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest">No public decks found</p>
            <p className="text-zinc-600 text-[11px]">
              {hasSearch ? `No results for "${searchQuery}"` : "Be the first to publish a deck to the community!"}
            </p>
          </div>
        ) : (
          <div key={`decks-content-${searchTab}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {liveDecks.map(deck => {
              const isLiked = likeStatus[deck.deck_id] ?? deck.is_liked;
              const forkState = forkStatus[deck.deck_id] ?? "idle";
              return (
                <div
                  key={deck.deck_id}
                  onClick={() => onStudyDeck(deck.title, deck.deck_id)}
                  className={`cursor-pointer group relative rounded-xl p-[1px] overflow-hidden transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_40px_-15px_rgba(0,0,0,0.1)] ${
                    isDarkMode 
                      ? "bg-gradient-to-b from-[#1a1a1a] to-transparent hover:shadow-[0_0_40px_-15px_rgba(255,255,255,0.1)]"
                      : "bg-gradient-to-b from-[#c9ada7]/30 to-transparent shadow-sm border border-[#c9ada7]/20"
                  }`}
                >
                  {/* Subtle animated gradient background on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl`} />
                  
                  {/* Inner Card Container */}
                  <div className={`relative h-full backdrop-blur-xl rounded-xl p-5 flex flex-col justify-between gap-5 transition-colors ${
                    isDarkMode 
                      ? "bg-[#0a0a0a]/90 border border-[rgba(255,255,255,0.05)] group-hover:border-[rgba(255,255,255,0.1)]" 
                      : "bg-[#fdfbfb]/90 border border-transparent group-hover:border-[#c9ada7]/50"
                  }`}>
                    
                    {/* Header: Category & Stats */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {deck.category && (
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-medium uppercase tracking-widest transition-colors ${
                            isDarkMode 
                              ? "bg-[rgba(255,255,255,0.05)] text-zinc-300 border border-[rgba(255,255,255,0.1)] group-hover:border-[rgba(255,255,255,0.2)]"
                              : "bg-[#22223b]/5 text-[#4a4e69] border border-[#22223b]/10 group-hover:border-[#22223b]/20"
                          }`}>
                            {deck.category}
                          </span>
                        )}
                      </div>
                      <div className={`flex items-center gap-1.5 ${isDarkMode ? "text-zinc-500" : "text-[#4a4e69]"}`}>
                        <Layers className="w-3 h-3" />
                        <span className="text-[10px] font-mono font-medium">{deck.card_count} cards</span>
                      </div>
                    </div>

                    {/* Body: Title & Description */}
                    <div className="space-y-2 flex-1 pt-2">
                      <h3 className={`text-base font-semibold font-sans tracking-tight transition-colors leading-snug ${
                        isDarkMode ? "text-zinc-100 group-hover:text-white" : "text-[#22223b] group-hover:text-black"
                      }`}>
                        {deck.title}
                      </h3>
                      {deck.description && (
                        <p className={`text-xs font-light leading-relaxed line-clamp-2 transition-colors ${
                          isDarkMode ? "text-zinc-400 group-hover:text-zinc-300" : "text-[#4a4e69]"
                        }`}>
                          {deck.description}
                        </p>
                      )}
                    </div>

                    {/* Author Info */}
                    <div 
                      className="flex items-center gap-2.5 pt-2 cursor-pointer group/author"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewProfile && deck.owner_username) {
                          onViewProfile(deck.owner_username);
                        }
                      }}
                    >
                      <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[9px] font-bold font-sans shadow-inner flex-shrink-0 transition-colors ${
                        isDarkMode 
                          ? "bg-gradient-to-br from-zinc-700 to-zinc-900 border-zinc-700 text-white group-hover/author:border-zinc-500" 
                          : "bg-gradient-to-br from-zinc-100 to-zinc-200 border-zinc-200 text-zinc-700 group-hover/author:border-zinc-400"
                      }`}>
                        {(deck.owner_full_name || deck.owner_username || "?").substring(0, 2).toUpperCase()}
                      </div>
                      <span className={`text-[11px] font-medium transition-colors ${
                        isDarkMode ? "text-zinc-500 group-hover/author:text-zinc-300" : "text-[#4a4e69] group-hover/author:text-[#22223b]"
                      }`}>
                        @{deck.owner_username || "anonymous"}
                      </span>
                    </div>

                    {/* Footer: Actions & Stats */}
                    <div className={`flex items-center justify-between pt-4 mt-2 border-t transition-colors ${
                      isDarkMode ? "border-[rgba(255,255,255,0.05)] group-hover:border-[rgba(255,255,255,0.1)]" : "border-[#c9ada7]/30 group-hover:border-[#c9ada7]/60"
                    }`}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleLikeDeck(deck);
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all duration-300 cursor-pointer ${
                            isLiked
                              ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 shadow-[0_0_10px_-3px_rgba(244,63,94,0.3)]"
                              : isDarkMode 
                                ? "bg-[rgba(255,255,255,0.05)] text-zinc-400 hover:bg-[rgba(255,255,255,0.1)] hover:text-rose-400"
                                : "bg-[#22223b]/5 text-[#4a4e69] hover:bg-[#22223b]/10 hover:text-rose-500"
                          }`}
                          title={isLiked ? "Unlike" : "Like"}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                          <span>{(deck.like_count || 0) + (isLiked && !deck.is_liked ? 1 : !isLiked && deck.is_liked ? -1 : 0)}</span>
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleForkDeck(deck.deck_id);
                          }}
                          disabled={forkState === "loading" || forkState === "done"}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium uppercase tracking-wider transition-all duration-300 cursor-pointer disabled:opacity-50 ${
                            forkState === "done"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : isDarkMode
                                ? "bg-[rgba(255,255,255,0.05)] text-zinc-300 hover:bg-[rgba(255,255,255,0.1)] border border-transparent hover:border-[rgba(255,255,255,0.1)]"
                                : "bg-[#22223b]/5 text-[#4a4e69] hover:bg-[#22223b]/10 border border-transparent hover:border-[#22223b]/10"
                          }`}
                        >
                          <GitFork className="w-3.5 h-3.5" />
                          <span>{forkState === "loading" ? "..." : forkState === "done" ? "Forked" : (deck.fork_count || "Fork")}</span>
                        </button>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStudyDeck(deck.title, deck.deck_id);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-300 cursor-pointer flex-shrink-0 ${
                          isDarkMode
                            ? "bg-white text-black hover:bg-zinc-200 shadow-[0_0_15px_-3px_rgba(255,255,255,0.3)] hover:shadow-[0_0_20px_-3px_rgba(255,255,255,0.5)]"
                            : "bg-[#22223b] text-[#f2e9e4] hover:bg-[#1a1a2e] shadow-[0_0_15px_-3px_rgba(34,34,59,0.3)] hover:shadow-[0_0_20px_-3px_rgba(34,34,59,0.5)]"
                        }`}
                      >
                        <BookOpen className="w-3 h-3" />
                        Study
                      </button>
                    </div>
                  </div>
                </div>

              );
            })}
          </div>
        )}
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
