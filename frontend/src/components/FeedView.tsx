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
  onSaveCardToDeck: (question: string, answer: string, deckId: string, details?: string) => void;
  onSaveToNewDeck: (feedItemId: string, newDeckTitle: string) => void;
  onRemoveCardFromDeck: (feedItemId: string, deckId: string) => void;
  onToggleFollow: (authorUsername: string) => void;
  onViewProfile?: (username: string) => void;
  onSearchChange?: (query: string) => void;
  onStudyDeck?: (deckName: string) => void;
  feedSubTab: "ONLY_FOR_YOU" | "FOLLOWING";
  setFeedSubTab: (tab: "ONLY_FOR_YOU" | "FOLLOWING") => void;
  isDarkMode?: boolean;
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
  isDarkMode = true
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
          <p className="text-xs text-on-surface-variant tracking-wider uppercase font-mono">No entries found matching filters</p>
          <button
            onClick={onAddNewClick}
            className="mt-4 px-4 py-1.5 bg-white text-black text-xs font-mono rounded-xs hover:bg-neutral-200 transition-all cursor-pointer border border-white"
          >
            Create First Concept Card
          </button>
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
              footerAction={
                <>
                  {savedFeedback[item.id] ? (
                     <span className="text-[9px] font-mono text-green-400 bg-green-950/10 px-2 py-1 rounded border border-green-900/30 flex items-center gap-1.5 animated pulse">
                      <Check className="w-3 h-3 text-green-400" />
                      <span>{savedFeedback[item.id]}</span>
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSaveDeckItemId(activeSaveDeckItemId === item.id ? null : item.id);
                      }}
                      className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors group/btn cursor-pointer"
                      title="Save to Personal Decks"
                    >
                      <Bookmark
                        className={`w-4 h-4 transition-transform group-hover/btn:scale-110 ${
                          isSavedInAnyDeck ? "text-white fill-white" : "text-on-surface-variant"
                        }`}
                      />
                    </button>
                  )}

                  {/* Popover action list of decks overlay */}
                  {activeSaveDeckItemId === item.id && (
                    <>
                      {/* Global click-outside overlay */}
                      <div
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSaveDeckItemId(null);
                        }}
                      />

                      <div className="absolute right-0 bottom-8 bg-surface-container-lowest border border-outline-variant/30 rounded-md p-3.5 z-40 shadow-2xl min-w-[220px] text-left animated fadeInUp">
                        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-outline-variant/20">
                          <p className="text-[10px] font-sans text-on-surface uppercase tracking-wider font-semibold">
                            SAVE TO PERSONAL DECK
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSaveDeckItemId(null);
                            }}
                            className="text-on-surface-variant hover:text-on-surface transition-colors p-0.5 rounded cursor-pointer animate-none"
                            title="Close"
                          >
                            <X className="w-3.5 h-3.5 animate-none" />
                          </button>
                        </div>
                        
                        <div className="space-y-1 max-h-[160px] overflow-y-auto scrollbar-none">
                          {decks.map(deck => {
                            const isSavedInThisDeck = deck.cards?.some((c: any) => c.answer === item.content);
                            return (
                              <button
                                key={deck.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isSavedInThisDeck) {
                                    onRemoveCardFromDeck(item.title || item.category, item.content, deck.id);
                                    setSavedFeedback({ ...savedFeedback, [item.id]: `Removed` });
                                  } else {
                                    onSaveCardToDeck(
                                      item.title || `Discuss the core concept of ${item.category}`, 
                                      item.content, 
                                      deck.id,
                                      item.codeSnippet ? `Source code context:\n${item.codeSnippet}` : undefined
                                    );
                                    setSavedFeedback({ ...savedFeedback, [item.id]: `Saved` });
                                  }
                                  
                                  setTimeout(() => {
                                    setSavedFeedback(prev => {
                                      const next = { ...prev };
                                      delete next[item.id];
                                      return next;
                                    });
                                  }, 2000);
                                  
                                  setActiveSaveDeckItemId(null);
                                }}
                                className={`w-full text-left px-3 py-2.5 rounded-sm text-xs font-mono transition-colors flex items-center justify-between group/deckbtn ${
                                  isSavedInThisDeck 
                                    ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" 
                                    : "text-on-surface-variant hover:bg-white/5 hover:text-white"
                                }`}
                              >
                                <span className="truncate max-w-[140px] block">{deck.title}</span>
                                {isSavedInThisDeck ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Plus className="w-3 h-3 opacity-0 group-hover/deckbtn:opacity-100 transition-opacity" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </>
              }
            />
          );
        })
      )}

      {/* Spacing bottom element */}
      <div className="text-center pt-8">
        <p className="text-[10px] font-mono text-on-surface-variant/20 tracking-wider">
          --- END OF ACTIVE STACK EXPLORE ---
        </p>
      </div>
    </div>
  );
}
