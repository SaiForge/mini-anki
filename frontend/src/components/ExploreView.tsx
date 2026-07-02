import { useState, useEffect, useCallback } from "react";
import { FeedCard } from "./cards/FeedCard";
import { browseDecks, getTrendingDecks, searchAll, forkDeck, likeDeck, unlikeDeck, PublicDeck } from "../api/exploreApi";
import { Heart, GitFork, Layers, BookOpen, Terminal } from "lucide-react";
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
  const [activeExploreTab, setActiveExploreTab] = useState<"decks" | "cards">("decks");

  // Explore Cards state
  const [exploreCards, setExploreCards] = useState<any[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsHasMore, setCardsHasMore] = useState(true);
  const [cardsPage, setCardsPage] = useState(0);

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

  const loadExploreCards = useCallback(async (pageNum: number) => {
    if (cardsLoading || (!cardsHasMore && pageNum > 0)) return;
    setCardsLoading(true);
    try {
      const { getExploreCards } = await import("../api/exploreApi");
      const limit = 20;
      const res = await getExploreCards(pageNum * limit, limit);
      if (pageNum === 0) {
        setExploreCards(res.items);
      } else {
        setExploreCards(prev => [...prev, ...res.items]);
      }
      setCardsHasMore(res.items.length === limit);
      setCardsPage(pageNum);
    } catch (e) {
      console.error("[ExploreView] Could not load explore cards:", e);
    } finally {
      setCardsLoading(false);
    }
  }, [cardsLoading, cardsHasMore]);

  useEffect(() => {
    loadLiveDecks();
  }, [loadLiveDecks]);

  useEffect(() => {
    const handleRefresh = () => {
      loadLiveDecks();
      loadExploreCards(0);
    };
    window.addEventListener("refreshExplore", handleRefresh);
    return () => window.removeEventListener("refreshExplore", handleRefresh);
  }, [loadLiveDecks, loadExploreCards]);

  useEffect(() => {
    loadExploreCards(0);
  }, []);

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
              className={`text-[13px] font-semibold transition-all duration-300 relative outline-none cursor-pointer ${searchTab === tab
                ? (isDarkMode ? "text-white" : "text-[#22223b]")
                : (isDarkMode ? "text-zinc-500 hover:text-zinc-300" : "text-[#4a4e69] hover:text-[#22223b]")
                }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {searchTab === tab && (
                <motion.div
                  layoutId="search-tab-indicator"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  className={`absolute -bottom-[17px] left-0 right-0 h-[2px] rounded-t-full ${isDarkMode ? "bg-white" : "bg-[#22223b]"
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
                      className={`flex items-center gap-4 p-4 border rounded-lg transition-colors cursor-pointer group ${isDarkMode ? "border-[#1A1A1A] bg-black hover:border-zinc-800" : "border-[#c9ada7]/30 bg-[#fdfbfb] hover:border-[#c9ada7]"
                        }`}
                      onClick={() => onViewProfile && u.username && onViewProfile(u.username)}
                    >
                      <div className={`w-12 h-12 rounded-full overflow-hidden border flex-shrink-0 flex items-center justify-center font-mono text-xs uppercase ${isDarkMode ? "bg-zinc-900 border-zinc-800 text-zinc-500" : "bg-[#f2e9e4] border-[#c9ada7]/50 text-[#4a4e69]"
                        }`}>
                        {(u.full_name || u.username || "?").substring(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-sm font-semibold font-sans truncate transition-colors ${isDarkMode ? "text-white group-hover:text-blue-400" : "text-[#22223b] group-hover:text-rose-500"
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
                      onToggleLike={() => { }}
                      onToggleBookmark={() => { }}
                      userDecks={decks}
                      onSaveCardToDeck={(id, deckId) => onSaveCardToDeck(item.title || "", item.content, deckId)}
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
        {(!hasSearch && activeExploreTab === "decks") || (hasSearch && (searchTab === "all" || searchTab === "decks")) ? (
          <motion.div
            key={`community-decks-${hasSearch ? searchTab : 'browse'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >

            {liveError ? (
              <div className="border border-red-900/40 bg-red-950/10 rounded-lg p-4 text-[11px] font-mono text-red-400 flex items-center gap-2">
                <span>⚠</span>
                <span>Could not load community decks: {liveError}</span>
              </div>
            ) : liveLoading ? (
              <div key={`decks-skeleton-${searchTab}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`border rounded-xl p-5 animate-pulse space-y-4 ${isDarkMode ? "border-[rgba(255,255,255,0.05)] bg-[#0a0a0a]/90" : "border-[#c9ada7]/20 bg-[#fdfbfb]/90"
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
                  const isSelfOwned = (currentUserId && deck.owner_id === currentUserId) || (currentUsername && deck.owner_username === currentUsername);
                  return (
                    <div key={deck.deck_id} className="flex flex-col gap-3">
                      {/* User Info (Outside, Top) */}
                      <div 
                        className="flex items-center justify-between cursor-pointer group/user px-1"
                        onClick={() => {
                          if (onViewProfile && deck.owner_username) {
                            onViewProfile(deck.owner_username);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner flex-shrink-0 transition-transform group-hover/user:scale-105 ${
                            isDarkMode ? "bg-gradient-to-br from-zinc-800 to-zinc-900 text-zinc-300 border border-zinc-800" : "bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-700"
                          }`}>
                            {(deck.owner_full_name || deck.owner_username || "?").substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-sm font-semibold tracking-tight transition-colors ${
                              isDarkMode ? "text-zinc-100 group-hover/user:text-white" : "text-zinc-900"
                            }`}>
                              {deck.owner_full_name || deck.owner_username || "Anonymous"}
                            </span>
                            <span className={`text-[11px] font-medium transition-colors ${
                              isDarkMode ? "text-zinc-500 group-hover/user:text-zinc-400" : "text-zinc-500"
                            }`}>
                              @{deck.owner_username || "anonymous"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Main Card */}
                      <div
                        onClick={() => onStudyDeck(deck.title, deck.deck_id)}
                        className={`cursor-pointer group border rounded-xl transition-all duration-300 relative shadow-md p-6 flex flex-col gap-3 h-fit ${
                          isDarkMode 
                            ? "bg-[#0b0b0b] border-zinc-800 hover:border-zinc-700 shadow-[0_4px_20px_rgba(0,0,0,0.3)]" 
                            : "bg-[#fdfbfb] border-[#ebdcd7] hover:shadow-[0_4px_16px_rgba(34,34,59,0.08)]"
                        }`}
                      >
                        {/* Header: Category & Badge */}
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-mono text-zinc-500 font-bold tracking-[0.2em] uppercase">
                            {deck.category || "CONCEPT"}
                          </p>
                          <span className={`text-[9px] font-mono px-2 py-0.5 border rounded uppercase ${
                            isDarkMode ? "bg-zinc-900 text-zinc-400 border-zinc-800" : "bg-zinc-100 text-zinc-500 border-zinc-200"
                          }`}>
                            {deck.card_count} CARDS
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className={`text-xl font-sans font-semibold tracking-tight leading-snug ${
                          isDarkMode ? "text-white" : "text-[#22223b]"
                        }`}>
                          {deck.title}
                        </h3>

                        {/* Divider after Title */}
                        <div className={`h-px w-full ${isDarkMode ? "bg-zinc-800" : "bg-[#ebdcd7]/60"}`} />

                        {/* Description */}
                        {deck.description && (
                          <div className="mt-1">
                            <p className={`text-sm font-light leading-relaxed line-clamp-4 ${isDarkMode ? "text-zinc-300" : "text-[#4a4e69]"}`}>
                              {deck.description}
                            </p>
                          </div>
                        )}
                        
                        {/* Tags */}
                        {deck.tags && deck.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {deck.tags.map((tag: string) => (
                              <span key={tag} className={`text-[10px] font-mono lowercase transition-colors cursor-pointer ${
                                isDarkMode ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-400 hover:text-zinc-600"
                              }`}>
                                #{tag.toLowerCase()}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Footer / Study Button */}
                        <div className={`pt-4 border-t w-full mt-2 ${
                          isDarkMode ? "border-zinc-900/40" : "border-[#ebdcd7]/80"
                        }`}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStudyDeck(deck.title, deck.deck_id);
                            }}
                            className={`w-full py-2.5 rounded border transition-colors flex items-center justify-center gap-2 text-[11px] font-mono uppercase tracking-wider shadow-sm ${
                              isDarkMode ? "text-white bg-zinc-900 hover:bg-zinc-800 border-zinc-800" : "text-[#fdfbfb] bg-[#22223b] hover:bg-[#4a4e69] border-[#22223b]"
                            }`}
                          >
                            💡 STUDY DECK
                          </button>
                        </div>
                      </div>

                      {/* Actions (Outside, Bottom) */}
                      <div className="flex items-center w-full text-sm text-zinc-500 pt-1">
                        <button
                          onClick={() => handleToggleLikeDeck(deck)}
                          className={`flex-1 flex items-center justify-center gap-2 hover:text-rose-500 transition-colors ${
                            isLiked ? "text-rose-500" : ""
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                          <span>{(deck.like_count || 0) + (isLiked && !deck.is_liked ? 1 : !isLiked && deck.is_liked ? -1 : 0)}</span>
                        </button>

                        <button
                          onClick={() => handleForkDeck(deck.deck_id)}
                          disabled={forkState === "loading" || forkState === "done" || isSelfOwned}
                          className={`flex-1 flex items-center justify-center gap-2 hover:text-emerald-500 transition-colors disabled:opacity-50 ${
                            forkState === "done" ? "text-emerald-500" : ""
                          }`}
                          title={isSelfOwned ? "You own this deck" : "Fork deck"}
                        >
                          <GitFork className="w-4 h-4" />
                          <span>{forkState === "loading" ? "..." : forkState === "done" ? "Forked" : (deck.fork_count || "Fork")}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Explore Cards */}
      <AnimatePresence mode="wait">
        {!hasSearch && activeExploreTab === "cards" && (
          <motion.div
            key="explore-cards"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6 max-w-2xl mx-auto"
          >
            {exploreCards.length === 0 && !cardsLoading ? (
              <div className="border border-[#1a1a1a] rounded-lg p-10 text-center space-y-2">
                <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest">No public cards found</p>
                <p className="text-zinc-600 text-[11px]">Publish decks to see their cards here!</p>
              </div>
            ) : (
              <div className="space-y-8">
                {exploreCards.map(item => (
                  <FeedCard
                    key={item.id}
                    feedItem={item}
                    onToggleLike={(id) => {
                      // Unlike a normal post, here we like the parent deck!
                      const isLiked = likeStatus[item.deckId] ?? item.likedByUser;
                      setLikeStatus(prev => ({ ...prev, [item.deckId]: !isLiked }));
                      const action = isLiked ? unlikeDeck : likeDeck;
                      action(item.deckId).catch(() => {
                        setLikeStatus(prev => ({ ...prev, [item.deckId]: isLiked }));
                      });
                    }}
                    userDecks={decks}
                    onSaveCardToDeck={(id, deckId) => onSaveCardToDeck(item.title || "", item.content, deckId)}
                    onRemoveCardFromDeck={(id, deckId) => onRemoveCardFromDeck(item.title || "", item.content, deckId)}
                    onToggleFollow={onToggleFollow}
                    isDarkMode={isDarkMode}
                    currentUserId={currentUserId}
                    currentUsername={currentUsername}
                  />
                ))}

                {/* Lazy Loading trigger */}
                {cardsHasMore && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={() => loadExploreCards(cardsPage + 1)}
                      disabled={cardsLoading}
                      className="text-xs font-mono px-4 py-2 bg-zinc-900 text-zinc-400 hover:text-white rounded border border-zinc-800 disabled:opacity-50 transition-colors"
                    >
                      {cardsLoading ? "Loading..." : "Load More"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
