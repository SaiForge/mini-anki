import React from 'react';
import { FeedItem, Flashcard } from "../../types";
import { Sparkles, Terminal, Code, Heart, Share2, CornerDownRight, CheckCircle, UserPlus, UserCheck, Check, Plus, Bookmark } from "lucide-react";

export interface FeedCardProps {
  hideHeader?: boolean;
  isDarkMode: boolean;
  viewMode?: "feed" | "study";
  
  // Data sources
  feedItem?: FeedItem;
  flashcard?: Flashcard;
  
  // Study specific
  deckTitle?: string;
  deckTags?: string[];
  isExpanded?: boolean;
  
  // Feed specific
  isSingle?: boolean;
  currentStep?: number;
  maxSteps?: number;
  activeTab?: string;
  savedFeedback?: Record<string, string>;
  sharedFeedback?: Record<string, boolean>;
  userDecks?: any[];
  
  // Custom slots
  footerAction?: React.ReactNode;
  
  // Actions
  onToggleReveal?: () => void;
  onViewProfile?: (username: string) => void;
  onToggleFollow?: (username: string) => void;
  onToggleLike?: (id: string) => void;
  setShowSaveDialog?: (id: string) => void;
  onSaveCardToDeck?: (title: string, desc: string, deckId: string) => void;
  onRemoveCardFromDeck?: (title: string, desc: string, deckId: string) => void;
  onStudyDeck?: (deckName: string) => void;
}

export function FeedCard({
  isDarkMode = true,
  viewMode = "feed",
  feedItem,
  flashcard,
  deckTitle,
  deckTags = [],
  isExpanded = false,
  isSingle = false,
  hideHeader = false,
  currentStep = 0,
  maxSteps = 1,
  activeTab = "EXPLORE",
  savedFeedback = {},
  sharedFeedback = {},
  userDecks = [],
  footerAction,
  onToggleReveal,
  onViewProfile,
  onToggleFollow,
  onToggleLike,
  setShowSaveDialog,
  onSaveCardToDeck,
  onRemoveCardFromDeck,
  onStudyDeck
}: FeedCardProps) {
  
  // --- STUDY MODE RENDER ---
  if (viewMode === "study" && flashcard) {
    const isJoke = flashcard.question.toLowerCase().includes("joke") || 
                   flashcard.question.toLowerCase().includes("comedy") || 
                   flashcard.question.toLowerCase().includes("refactoring");
    const solvedIndicator = isJoke ? "PUNCHLINE" : "ANSWER";

    return (
        <div 
          className={`group border rounded-xs transition-all duration-300 p-5 md:p-6 cursor-pointer relative ${
            isDarkMode 
              ? "bg-[#0b0b0b] border-zinc-800 hover:border-zinc-700 shadow-md"
              : "bg-[#fdfbfb] border-[#ebdcd7] shadow-[0_2px_8px_rgba(34,34,59,0.04)] hover:shadow-[0_4px_16px_rgba(34,34,59,0.08)]"
          }`}
          onClick={onToggleReveal}
        >
          <div className="flex items-center justify-between pb-3">
            <span className={`font-mono text-[10px] font-bold tracking-widest uppercase ${
              isDarkMode ? "text-zinc-400" : "text-[#22223b]"
            }`}>
              {deckTitle || "CONCEPTS"}
            </span>
            <span className={`text-[10px] font-mono px-2.5 py-0.5 border rounded-xs uppercase tracking-wider ${
              isDarkMode 
                ? isExpanded 
                  ? "bg-green-500/10 text-green-400 border-green-500/20" 
                  : "bg-zinc-900/60 text-zinc-400 border-zinc-800"
                : isExpanded 
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold" 
                  : "bg-[#eed9d2]/15 text-zinc-500 border-[#c9ada7]"
            }`}>
              {isExpanded ? "DECRYPTED" : "SECURED"}
            </span>
          </div>

          <div className={`border-b mb-6 ${isDarkMode ? "border-zinc-900" : "border-[#ebdcd7]"}`}></div>

          <div className="flex flex-col items-center justify-center text-center space-y-6 py-2">
            <h3 className={`text-sm md:text-base font-bold font-sans tracking-wide leading-relaxed max-w-lg ${
              isDarkMode ? "text-white" : "text-[#22223b]"
            }`}>
              {flashcard.question}
            </h3>

            <div className="grid w-full">
              <div className={`col-start-1 row-start-1 w-full mx-auto max-w-lg transition-opacity duration-300 ${isExpanded ? "opacity-100 relative z-10" : "opacity-0 pointer-events-none"}`}>
                <div className={`w-full p-5 border rounded-xs text-left ${
                  isDarkMode 
                    ? "bg-[#030303] border-zinc-850" 
                    : "bg-[#eed9d2]/15 border-[#ebdcd7]"
                }`} onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-3">
                    <div className={`flex items-center gap-1.5 text-[9px] font-bold font-mono uppercase tracking-[0.15em] ${
                      isDarkMode ? "text-green-400" : "text-emerald-700"
                    }`}>
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{isJoke ? "LAUGH PUNCHLINE" : "REFERENCE OUTCOME"}</span>
                    </div>
                    <p className={`text-xs md:text-sm font-mono leading-relaxed p-3 border rounded-xs ${
                      isDarkMode 
                        ? "bg-[#080808] border-zinc-900 text-zinc-200" 
                        : "bg-[#ffffff] border-[#ebdcd7] text-[#22223b]"
                    }`}>
                      {flashcard.answer}
                    </p>
                    {flashcard.details && (
                      <div className={`flex gap-1.5 items-start p-3 border rounded-xs ${
                        isDarkMode 
                          ? "bg-black/60 border-zinc-900/60" 
                          : "bg-[#ffffff] border-[#ebdcd7]/60"
                      }`}>
                        <CornerDownRight className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                          isDarkMode ? "text-zinc-500" : "text-[#4a4e69]/55"
                        }`} />
                        <div className="space-y-0.5">
                          <span className={`text-[8px] font-mono uppercase block tracking-wider ${
                            isDarkMode ? "text-zinc-400" : "text-[#4a4e69]/70"
                          }`}>SYSTEM COMMENTARY</span>
                          <p className={`text-[10px] font-light italic leading-relaxed text-left ${
                            isDarkMode ? "text-zinc-400" : "text-[#4a4e69]"
                          }`}>
                            {flashcard.details}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={`col-start-1 row-start-1 z-20 flex flex-col justify-center transition-opacity duration-300 w-full mx-auto max-w-lg ${isExpanded ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                <div className={`w-full border border-dashed rounded-xs py-7 px-4 text-center space-y-1.5 select-none transition-colors h-full flex flex-col items-center justify-center ${
                  isDarkMode 
                    ? "border-zinc-800 bg-[#060606]/40 hover:bg-[#060606]/80" 
                    : "border-[#c9ada7] bg-[#eed9d2]/10 hover:bg-[#eed9d2]/20"
                }`}>
                  <Sparkles className={`w-4 h-4 mx-auto animate-pulse mb-1.5 ${
                    isDarkMode ? "text-zinc-500" : "text-[#c2ab9a]"
                  }`} />
                  <span className={`text-[10px] font-mono uppercase tracking-widest block ${
                    isDarkMode ? "text-zinc-400" : "text-[#4a4e69]/75"
                  }`}>
                    [ {solvedIndicator} SECURED ]
                  </span>
                </div>
              </div>
            </div>

            <div className={`flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono lowercase ${
              isDarkMode ? "text-zinc-400" : "text-[#4a4e69]/70"
            }`}>
              {deckTags.map(tag => (
                <span key={tag}>#{tag.toLowerCase()}</span>
              ))}
              <span>#study</span>
            </div>
          </div>

          <div className={`border-b mt-6 mb-4 ${isDarkMode ? "border-zinc-900" : "border-[#ebdcd7]"}`}></div>

          <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
            <span className={`text-[10px] font-mono uppercase tracking-wider ${
              isDarkMode ? "text-zinc-400" : "text-[#4a4e69]/70"
            }`}>
              PROGRESS: {isExpanded ? "1/1" : "0/1"}
            </span>

            <button
              onClick={onToggleReveal}
              className={`text-[10px] font-mono uppercase px-4 py-2 border rounded-xs font-bold tracking-widest flex items-center gap-2 transition-colors ${
                isDarkMode 
                  ? isExpanded 
                    ? "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-white"
                    : "bg-white text-black border-white hover:bg-zinc-200"
                  : isExpanded
                    ? "bg-[#fdfbfb] text-[#4a4e69] border-[#c9ada7] hover:bg-[#eed9d2]/20"
                    : "bg-[#22223b] text-[#fdfbfb] border-[#22223b] hover:bg-[#4a4e69]"
              }`}
            >
              {isExpanded ? (
                <>
                  <Sparkles className="w-3 h-3" />
                  <span>CONCEAL SOLUTION</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  <span>{isJoke ? "REVEAL PUNCHLINE" : "REVEAL ANSWER"}</span>
                </>
              )}
            </button>
          </div>
        </div>
    );
  }

  // --- FEED MODE RENDER ---
  if (!feedItem) return null;
  const item = feedItem;
  const isFullyRevealed = isSingle || currentStep === maxSteps;

  const renderTags = (item: FeedItem, centered: boolean = false) => {
    if (!item.tags || item.tags.length === 0) return null;
    return (
      <div className={`flex flex-wrap gap-2 ${centered ? "justify-center" : "justify-start"} pt-2`}>
        {item.tags.map((tag) => (
          <span key={tag} className="text-[10px] font-mono text-zinc-500 lowercase hover:text-zinc-300 transition-colors cursor-pointer">
            #{tag.toLowerCase()}
          </span>
        ))}
      </div>
    );
  };

  return (
    <article className="group transition-all duration-300 space-y-3">
      {/* Post Author / Follow Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-2 pt-1">
          <div 
            className="flex items-center gap-3 cursor-pointer group/author select-none"
            onClick={() => onViewProfile && onViewProfile(item.authorUsername || "@anonymous")}
            title={`View ${item.authorName || "User"}'s profile`}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-900 border border-zinc-800 text-white font-mono text-xs uppercase font-medium group-hover/author:border-white/50 transition-all">
              {item.authorAvatar || "U"}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-sans text-on-surface font-medium tracking-wide group-hover/author:text-white transition-colors">
                {item.authorName || "Anonymous User"}
              </span>
              <span className="text-[10px] font-mono text-on-surface-variant/50 group-hover/author:text-zinc-300 transition-colors">
                {item.authorUsername || "@anonymous"}
              </span>
            </div>
          </div>

          {item.authorUsername !== "@kolarsaibag" && activeTab !== "FOLLOWING" && (
            <div>
              {!item.isFollowed ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFollow && onToggleFollow(item.authorUsername || "");
                  }}
                  className={`text-[10px] font-mono uppercase px-3 py-1 rounded-xs font-bold tracking-wider transition-all flex items-center gap-1 cursor-pointer animate-fade-in ${
                    isDarkMode 
                      ? "bg-white text-[#050b19] border border-white hover:bg-neutral-200" 
                      : "bg-[#22223b] text-[#fdfbfb] border border-[#22223b] hover:bg-[#22223b]/90"
                  }`}
                >
                  <UserPlus className="w-3 h-3" />
                  <span>Follow</span>
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFollow && onToggleFollow(item.authorUsername || "");
                  }}
                  className={`text-[10px] font-mono uppercase border px-3 py-1 rounded-xs tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                    isDarkMode
                      ? "bg-zinc-950/80 text-zinc-400 border-zinc-800 hover:bg-zinc-900"
                      : "bg-[#fdfbfb] text-[#4a4e69] border-[#c9ada7] hover:bg-[#22223b]/5"
                  }`}
                >
                  <UserCheck className={`w-3 h-3 ${isDarkMode ? "text-green-400" : "text-green-600"}`} />
                  <span>Following</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div 
        onClick={onToggleReveal}
        className={`hairline-border bg-black transition-all duration-300 relative overflow-hidden rounded-xs select-none ${
          isSingle 
            ? "border-[#1C1C1C] bg-zinc-950/20" 
            : isFullyRevealed
              ? "border-zinc-500 bg-[#0c0c0c] cursor-pointer hover:border-zinc-400 active:scale-[0.995]" 
              : currentStep > 0
                ? "border-zinc-500 bg-[#060606] cursor-pointer hover:border-zinc-400 active:scale-[0.995]"
                : "border-zinc-800 hover:border-zinc-700 bg-[#030303] cursor-pointer hover:bg-black active:scale-[0.995]"
        }`}
      >
        {item.imageUrl ? (
          <div className="aspect-square w-full overflow-hidden relative">
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover grayscale transition-all duration-700 opacity-60 blur-none"
            />
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/60">
              <div className="bg-black/90 px-6 py-8 border border-zinc-900 max-w-[85%] rounded text-center animated fadeIn space-y-4">
                <p className="text-[10px] tracking-widest font-mono uppercase text-zinc-500 font-bold">
                  {item.category}
                </p>
                <h3 className="text-xs md:text-sm font-light text-on-surface leading-relaxed tracking-wide">
                  {item.content}
                </h3>
                {item.title && (
                  <p className="text-[10px] font-mono uppercase text-zinc-400 tracking-wider">
                    {item.title}
                  </p>
                )}
                {renderTags(item, true)}
              </div>
            </div>
          </div>
        ) : (item.isQuoteStyle || item.category === "JOKES" || item.category === "RIDDLES") ? (
          <div className="p-6 md:p-8 flex flex-col justify-center items-center text-center space-y-5 bg-zinc-950/20">
            <div className="w-full flex items-center justify-between pb-2 border-b border-zinc-900/40">
              <p className="text-[10px] font-mono text-zinc-500 font-bold tracking-[0.2em] uppercase">
                {item.category}
              </p>
              {!isSingle && (
                <span className="text-[9px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 border border-zinc-800 rounded uppercase">
                  {currentStep === 0 ? "SECURED" : "DECRYPTED"}
                </span>
              )}
            </div>

            {item.category === "JOKES" ? (
              <h3 className="text-sm md:text-base font-sans font-semibold tracking-tight text-white leading-relaxed max-w-md">
                {item.category}
              </h3>
            ) : (
              <div className="space-y-2">
                {item.title && (
                  <p className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider">
                    {item.title}
                  </p>
                )}
                <h3 className="text-sm md:text-base font-light italic leading-loose text-zinc-200 tracking-wide max-w-md">
                  {item.content}
                </h3>
              </div>
            )}

            <div className="grid w-full pt-2">
              <div className={`col-start-1 row-start-1 w-full transition-opacity duration-300 ${isFullyRevealed || currentStep >= 1 ? "opacity-100 relative z-10" : "opacity-0 pointer-events-none"}`}>
                {item.category === "JOKES" ? (
                  <p className="text-xs font-mono text-zinc-200 tracking-wide max-w-md mx-auto">
                    🎭 {item.content}
                  </p>
                ) : (
                  <div className="text-center">
                    <p className="text-xs font-mono text-white tracking-widest inline-block">
                      {item.quoteAuthor || "Silence"}
                    </p>
                  </div>
                )}
              </div>
              {!isSingle && (
                <div className={`col-start-1 row-start-1 z-20 flex flex-col justify-center transition-opacity duration-300 ${isFullyRevealed || currentStep >= 1 ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                  <div className="w-full py-4 border border-dashed border-zinc-900 rounded bg-zinc-950/20 text-center flex flex-col items-center justify-center space-y-1 h-full">
                    <Sparkles className="w-4 h-4 text-zinc-600 animate-pulse" />
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                      {item.category === "JOKES" ? "[ PUNCHLINE SECURED ]" : "[ SECRET ANSWER UNRESOLVED ]"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {renderTags(item, true)}

            {!isSingle && (
              <div className="pt-3 w-full border-t border-zinc-900/40 flex justify-between items-center text-zinc-500 text-[10px] font-mono uppercase tracking-wider">
                <span>Progress: {currentStep}/{maxSteps}</span>
                {currentStep === 0 ? (
                  <span className="text-white bg-zinc-900 hover:bg-zinc-800 px-2.5 py-1 rounded border border-zinc-800 transition-colors">
                    {item.category === "JOKES" ? "🎭 REVEAL PUNCHLINE" : "🔑 DECRYPT ANSWER"}
                  </span>
                ) : (
                  <span className="text-zinc-650 bg-zinc-950 px-2.5 py-1 rounded border border-zinc-900 transition-colors">
                    ↩ HIDE ANSWER
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 md:p-8 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              {item.category !== "DECK" && (
                <p className="text-[10px] font-mono text-zinc-500 font-bold tracking-[0.2em] uppercase">
                  {item.category}
                </p>
              )}
              {!isSingle && item.category !== "DECK" && (
                <span className="text-[9px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 border border-zinc-800 rounded uppercase">
                  {currentStep === 0 ? "SECURED" : currentStep < maxSteps ? "DECRYPTING" : "DECRYPTED"}
                </span>
              )}
            </div>

            {item.title && (
              <h3 className="text-sm md:text-base font-sans font-semibold tracking-tight text-white leading-snug">
                {item.title}
              </h3>
            )}

            <div className="grid w-full">
              <div className={`col-start-1 row-start-1 transition-opacity duration-300 ${isFullyRevealed || currentStep >= 1 || item.category === "DECK" ? "opacity-100 relative z-10" : "opacity-0 pointer-events-none"}`}>
                <p className="text-xs font-light text-zinc-300 leading-relaxed block select-text">
                  {item.content}
                </p>
              </div>
              {!isSingle && item.category !== "DECK" && (
                <div className={`col-start-1 row-start-1 z-20 flex flex-col justify-center transition-opacity duration-300 ${isFullyRevealed || currentStep >= 1 ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                  <div className="py-4 border border-dashed border-zinc-900 rounded bg-zinc-950/20 text-center flex flex-col items-center justify-center space-y-1 h-full w-full">
                    <Terminal className="w-4 h-4 text-zinc-600 animate-pulse" />
                    <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-semibold block">
                      [ SYSTEM ANSWER LOCKED ]
                    </span>
                  </div>
                </div>
              )}
            </div>

            {item.codeSnippet && (
              <div className="grid w-full mt-2">
                <div className={`col-start-1 row-start-1 transition-opacity duration-300 ${isFullyRevealed || currentStep >= 2 ? "opacity-100 relative z-10" : "opacity-0 pointer-events-none"}`}>
                  <div className="bg-[#050505] p-4 border border-zinc-900 rounded font-mono text-[11px] overflow-x-auto text-white select-text block">
                    <code>{item.codeSnippet}</code>
                  </div>
                </div>
                {!isSingle && (
                  <div className={`col-start-1 row-start-1 z-20 flex flex-col justify-center transition-opacity duration-300 ${isFullyRevealed || currentStep >= 2 ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                    <div className="py-4 border border-dashed border-zinc-900 rounded bg-zinc-950/20 text-center flex flex-col items-center justify-center space-y-1 h-full w-full">
                      <Code className="w-4 h-4 text-zinc-650 animate-pulse" />
                      <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-semibold block">
                        [ TECHNICAL CODE SECURED ]
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {renderTags(item, false)}

            {!isSingle && (
              <div className={`pt-3 border-t flex ${item.category === "DECK" ? "justify-end" : "justify-between"} items-center text-zinc-500 text-[10px] font-mono uppercase tracking-wider ${isDarkMode ? "border-zinc-900/40" : "border-[#ebdcd7]/80"}`}>
                {item.category !== "DECK" && <span>Progress: {currentStep}/{maxSteps}</span>}
                {currentStep === 0 && item.category !== "DECK" && (
                  <span className={`px-2.5 py-1 rounded border transition-colors ${
                    isDarkMode 
                      ? "text-white bg-zinc-900 hover:bg-zinc-800 border-zinc-800"
                      : "text-[#fdfbfb] bg-[#22223b] hover:bg-[#4a4e69] border-[#22223b]"
                  }`}>
                    💡 DECRYPT EXPLANATION
                  </span>
                )}
                {currentStep === 1 && maxSteps === 2 && item.category !== "DECK" && (
                  <span className={`px-2.5 py-1 rounded border transition-colors ${
                    isDarkMode 
                      ? "text-white bg-zinc-900 hover:bg-zinc-800 border-zinc-800"
                      : "text-[#fdfbfb] bg-[#22223b] hover:bg-[#4a4e69] border-[#22223b]"
                  }`}>
                    💻 DECRYPT CODE SNIPPET
                  </span>
                )}
                {item.category === "DECK" ? (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onStudyDeck && onStudyDeck(item.title || item.category);
                    }}
                    className={`font-bold tracking-widest flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 px-6 py-2 rounded-sm text-xs border ${
                      isDarkMode
                        ? "text-white bg-zinc-900 hover:bg-zinc-800 border-zinc-800"
                        : "text-[#fdfbfb] bg-[#22223b] hover:bg-[#4a4e69] border-[#22223b] shadow-sm"
                    }`}
                  >
                    ▶ STUDY NOW
                  </button>
                ) : currentStep === maxSteps && (
                  <span className={`px-2.5 py-1 rounded border transition-colors ${
                    isDarkMode
                      ? "text-zinc-400 bg-zinc-950 border-zinc-900"
                      : "text-[#4a4e69] bg-[#fdfbfb] border-[#c9ada7]"
                  }`}>
                    ↩ TAP TO RE-ENCRYPT
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Feed Meta Toolbar */}
      <div className="mt-3 flex items-center justify-between px-2 relative">
        <div className="flex items-center gap-6">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike && onToggleLike(item.id);
            }}
            className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors group/btn cursor-pointer"
          >
            <Heart
              className={`w-4 h-4 transition-transform group-hover/btn:scale-110 ${
                item.likedByUser ? "text-red-500 fill-red-500" : "text-on-surface-variant"
              }`}
            />
            <span className="text-[11px] font-mono">
              {item.likes + (item.likedByUser ? 1 : 0)}
            </span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (navigator.clipboard) {
                navigator.clipboard.writeText(`${window.location.origin}/post/${item.id}\n\nCategory: ${item.category}\nConcept: ${item.content}`);
              }
              // Ideally parent would handle shared feedback, but keeping simple here
            }}
            className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors group/btn cursor-pointer"
            title="Share this concept"
          >
            <Share2 className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
            <span className="text-[11px] font-mono">
              {sharedFeedback[item.id] ? "Copied!" : "Share"}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-widest">
            {item.timeLabel}
          </span>

          <div className="relative">
            {footerAction}
          </div>
        </div>
      </div>
    </article>
  );
}
