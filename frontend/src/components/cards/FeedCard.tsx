import React from 'react';
import { FeedItem, Flashcard } from "../../types";
import { Sparkles, Terminal, Code, Heart, Share2, CornerDownRight, CheckCircle, UserPlus, UserCheck, Check, Plus, Bookmark, X, Loader2, GitFork } from "lucide-react";
import CommentThread from "../CommentThread";
import { listConversations, sendMessage, DmConversation } from "../../api/dmApi";

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
  onSaveCardToDeck?: (id: string, deckId: string) => void;
  onRemoveCardFromDeck?: (id: string, deckId: string) => void;
  onStudyDeck?: (deckName: string, deckId?: string) => void;
  // Phase 2 additions
  commentsCount?: number;
  currentUserId?: string;
  currentUsername?: string;
  onDeletePost?: (id: string) => void;
  autoOpenComments?: boolean;
  onToggleBookmark?: (id: string) => void;
  onForkDeck?: (id: string) => void;
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
  onStudyDeck,
  commentsCount = 0,
  currentUserId,
  currentUsername,
  onDeletePost,
  autoOpenComments = false,
  onToggleBookmark,
  onForkDeck,
}: FeedCardProps) {
  const [showSavePopover, setShowSavePopover] = React.useState(false);
  const [saveFeedback, setSaveFeedback] = React.useState<string | null>(null);

  const [showSharePopover, setShowSharePopover] = React.useState(false);
  const [shareFeedbackMsg, setShareFeedbackMsg] = React.useState<string | null>(null);
  const [recentChats, setRecentChats] = React.useState<DmConversation[]>([]);
  const [selectedShareUsers, setSelectedShareUsers] = React.useState<string[]>([]);
  const [isSharing, setIsSharing] = React.useState(false);

  React.useEffect(() => {
    if (showSharePopover) {
      listConversations().then(setRecentChats).catch(console.error);
    } else {
      setSelectedShareUsers([]);
    }
  }, [showSharePopover]);

  // --- STUDY MODE RENDER ---
  if (viewMode === "study" && flashcard) {
    const isJoke = flashcard.question.toLowerCase().includes("joke") ||
      flashcard.question.toLowerCase().includes("comedy") ||
      flashcard.question.toLowerCase().includes("refactoring");
    const solvedIndicator = isJoke ? "PUNCHLINE" : "ANSWER";

    return (
      <div
        className={`group border rounded-lg transition-all duration-300 cursor-pointer relative shadow-md p-6 md:p-8 flex flex-col space-y-4 ${isDarkMode
          ? "bg-[#0b0b0b] border-zinc-800 hover:border-zinc-700"
          : "bg-[#fdfbfb] border-[#ebdcd7] hover:shadow-[0_4px_16px_rgba(34,34,59,0.08)]"
          }`}
        onClick={onToggleReveal}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-mono text-zinc-500 font-bold tracking-[0.2em] uppercase">
            {deckTags.length > 0 ? deckTags[0] : "CONCEPT"}
          </p>
          <span className={`text-[9px] font-mono px-2 py-0.5 border rounded uppercase ${isDarkMode
            ? isExpanded ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-zinc-900 text-zinc-400 border-zinc-800"
            : isExpanded ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-[#eed9d2]/15 text-zinc-500 border-[#c9ada7]"
            }`}>
            {isExpanded ? "DECRYPTED" : "SECURED"}
          </span>
        </div>

        <h3 className={`text-sm md:text-base font-sans font-semibold tracking-tight leading-snug ${isDarkMode ? "text-white" : "text-[#22223b]"
          }`}>
          {flashcard.question}
        </h3>

        <div className="grid w-full">
          <div className={`col-start-1 row-start-1 transition-opacity duration-300 ${isExpanded ? "opacity-100 relative z-10" : "opacity-0 pointer-events-none"}`}>
            <p className={`text-xs font-light leading-relaxed block select-text ${isDarkMode ? "text-zinc-300" : "text-[#4a4e69]"
              }`}>
              {flashcard.answer}
            </p>
          </div>
          <div className={`col-start-1 row-start-1 z-20 flex flex-col justify-center transition-opacity duration-300 ${isExpanded ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
            <div className={`py-4 border border-dashed rounded text-center flex flex-col items-center justify-center space-y-1 h-full w-full ${isDarkMode ? "bg-zinc-950/20 border-zinc-900" : "bg-[#eed9d2]/10 border-[#c9ada7]"
              }`}>
              <Terminal className={`w-4 h-4 animate-pulse ${isDarkMode ? "text-zinc-600" : "text-[#c2ab9a]"}`} />
              <span className={`text-[9px] font-mono uppercase tracking-widest font-semibold block ${isDarkMode ? "text-zinc-500" : "text-[#4a4e69]/75"
                }`}>
                [ {isJoke ? "PUNCHLINE LOCKED" : "SYSTEM ANSWER LOCKED"} ]
              </span>
            </div>
          </div>
        </div>

        {flashcard.details && (
          <div className="grid w-full mt-2">
            <div className={`col-start-1 row-start-1 transition-opacity duration-300 ${isExpanded ? "opacity-100 relative z-10" : "opacity-0 pointer-events-none"}`}>
              <div className={`p-4 border rounded font-mono text-[11px] overflow-x-auto select-text block ${isDarkMode ? "bg-[#050505] border-zinc-900 text-white" : "bg-[#f4ebe8] border-[#ebdcd7] text-[#22223b]"
                }`}>
                <code>{flashcard.details}</code>
              </div>
            </div>
            <div className={`col-start-1 row-start-1 z-20 flex flex-col justify-center transition-opacity duration-300 ${isExpanded ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
              <div className={`py-4 border border-dashed rounded text-center flex flex-col items-center justify-center space-y-1 h-full w-full ${isDarkMode ? "bg-zinc-950/20 border-zinc-900" : "bg-[#eed9d2]/10 border-[#c9ada7]"
                }`}>
                <Code className={`w-4 h-4 animate-pulse ${isDarkMode ? "text-zinc-650" : "text-[#c2ab9a]"}`} />
                <span className={`text-[9px] font-mono uppercase tracking-widest font-semibold block ${isDarkMode ? "text-zinc-500" : "text-[#4a4e69]/75"
                  }`}>
                  [ TECHNICAL DETAILS SECURED ]
                </span>
              </div>
            </div>
          </div>
        )}

        <div className={`pt-3 border-t flex justify-between items-center text-[10px] font-mono uppercase tracking-wider ${isDarkMode ? "border-zinc-900/40 text-zinc-500" : "border-[#ebdcd7]/80 text-[#4a4e69]/70"
          }`}>
          <span>Progress: {isExpanded ? "1/1" : "0/1"}</span>
          <span className={`px-2.5 py-1 rounded border transition-colors ${isExpanded
            ? isDarkMode ? "text-zinc-400 bg-zinc-950 border-zinc-900" : "text-[#4a4e69] bg-[#fdfbfb] border-[#c9ada7]"
            : isDarkMode ? "text-white bg-zinc-900 hover:bg-zinc-800 border-zinc-800" : "text-[#fdfbfb] bg-[#22223b] hover:bg-[#4a4e69] border-[#22223b]"
            }`}>
            {isExpanded ? "↩ TAP TO RE-ENCRYPT" : (isJoke ? "🎭 DECRYPT PUNCHLINE" : "💡 DECRYPT EXPLANATION")}
          </span>
        </div>
      </div>
    );
  }

  // --- FEED MODE RENDER ---
  if (!feedItem) return null;
  const item = feedItem;
  const isFullyRevealed = isSingle || currentStep === maxSteps;

  const isSavedInAnyDeck = userDecks?.some(deck => deck.cards?.some((c: any) => c.answer === item.content));
  const isFilled = item.bookmarkedByUser || item.isPrivate || isSavedInAnyDeck;
  const isSelfOwned = (currentUserId && item.authorId === currentUserId) || (currentUsername && (item.authorUsername === currentUsername || item.authorUsername === `@${currentUsername}`));

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
              {item.authorAvatar ? (
                item.authorAvatar.startsWith('http') ? (
                  <img src={item.authorAvatar} alt="avatar" className="w-full h-full rounded-full object-cover" />
                ) : item.authorAvatar
              ) : (
                (item.authorName || item.authorUsername || "U").charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-sans text-on-surface font-medium tracking-wide group-hover/author:text-white transition-colors">
                {item.authorName || "Anonymous User"}
              </span>
              <span className="text-[10px] font-mono text-on-surface-variant/50 group-hover/author:text-zinc-300 transition-colors">
                {item.authorUsername ? (item.authorUsername.startsWith('@') ? item.authorUsername : `@${item.authorUsername}`) : "@anonymous"}
              </span>
            </div>
          </div>

          {activeTab !== "FOLLOWING" && (
            <div className="flex items-center gap-2">
              {currentUsername && (item.authorUsername === `@${currentUsername}` || item.authorUsername === currentUsername) ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Are you sure you want to delete this concept?")) {
                      onDeletePost && onDeletePost(item.id);
                    }
                  }}
                  title="Delete Concept"
                  className={`p-1.5 rounded transition-colors ${isDarkMode ? "text-zinc-500 hover:text-red-400 hover:bg-red-400/10" : "text-zinc-400 hover:text-red-500 hover:bg-red-50"
                    }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                </button>
              ) : !item.isFollowed ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFollow && onToggleFollow(item.authorUsername || "");
                  }}
                  className={`text-[10px] font-mono uppercase px-3 py-1 rounded-xs font-bold tracking-wider transition-all flex items-center gap-1 cursor-pointer animate-fade-in ${isDarkMode
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
                  className={`text-[10px] font-mono uppercase border px-3 py-1 rounded-xs tracking-wider transition-all flex items-center gap-1 cursor-pointer ${isDarkMode
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
        onClick={(e) => {
          if (item.category === "DECK" && onStudyDeck) {
             onStudyDeck(item.title || "", item.deckId || item.id);
          } else {
             onToggleReveal?.();
          }
        }}
        className={`hairline-border bg-black transition-all duration-300 relative overflow-hidden rounded-lg shadow-md select-none ${isSingle
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
              <p className="text-[10px] font-mono text-zinc-500 font-bold tracking-[0.2em] uppercase">
                {item.category}
              </p>
              {!isSingle && item.category !== "DECK" && (
                <span className="text-[9px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 border border-zinc-800 rounded uppercase">
                  {currentStep === 0 ? "SECURED" : currentStep < maxSteps ? "DECRYPTING" : "DECRYPTED"}
                </span>
              )}
            </div>

            {item.title && (
              <h3 className={`font-sans font-semibold tracking-tight text-white leading-snug ${item.category === "DECK" ? "text-xl md:text-2xl" : "text-sm md:text-base"}`}>
                {item.title}
              </h3>
            )}

            <div className={`grid w-full ${item.category === "DECK" ? "!-mt-1" : ""}`}>
              <div className={`col-start-1 row-start-1 transition-opacity duration-300 ${isFullyRevealed || currentStep >= 1 || item.category === "DECK" ? "opacity-100 relative z-10" : "opacity-0 pointer-events-none"}`}>
                {item.category === "DECK" ? (
                  item.content ? (
                    <p className={`text-xs font-light leading-relaxed block select-text py-3 border-t mt-1 ${isDarkMode ? "text-zinc-300 border-white/10" : "text-[#4a4e69] border-[#ebdcd7]/80"}`}>
                      {item.content}
                    </p>
                  ) : null
                ) : (
                  <p className="text-xs font-light text-zinc-300 leading-relaxed block select-text">
                    {item.content}
                  </p>
                )}
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

            {item.category !== "DECK" && renderTags(item, false)}

            {(!isSingle || item.category === "DECK") && (
              <div className={`pt-3 flex justify-between items-center text-zinc-500 text-[10px] font-mono uppercase tracking-wider ${item.category === "DECK" ? "" : `border-t ${isDarkMode ? "border-white/10" : "border-[#ebdcd7]/80"}`}`}>
                {item.category === "DECK" && renderTags(item, true)}
                {item.category !== "DECK" && <span>Progress: {currentStep}/{maxSteps}</span>}
                {currentStep === 0 && item.category !== "DECK" && (
                  <span className={`px-2.5 py-1 rounded border transition-colors ${isDarkMode
                    ? "text-white bg-zinc-900 hover:bg-zinc-800 border-zinc-800"
                    : "text-[#fdfbfb] bg-[#22223b] hover:bg-[#4a4e69] border-[#22223b]"
                    }`}>
                    💡 DECRYPT EXPLANATION
                  </span>
                )}
                {currentStep === 1 && maxSteps === 2 && item.category !== "DECK" && (
                  <span className={`px-2.5 py-1 rounded border transition-colors ${isDarkMode
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
                      onStudyDeck && onStudyDeck(item.title || item.category, item.id);
                    }}
                    className={`font-bold tracking-widest flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 px-6 py-2 rounded-sm text-xs border ${isDarkMode
                      ? "text-white bg-zinc-900 hover:bg-zinc-800 border-zinc-800"
                      : "text-[#fdfbfb] bg-[#22223b] hover:bg-[#4a4e69] border-[#22223b] shadow-sm"
                      }`}
                  >
                    ▶ STUDY NOW
                  </button>
                ) : currentStep === maxSteps && (
                  <span className={`px-2.5 py-1 rounded border transition-colors ${isDarkMode
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
              className={`w-4 h-4 transition-transform group-hover/btn:scale-110 ${item.likedByUser ? "text-red-500 fill-red-500" : "text-on-surface-variant"
                }`}
            />
            <span className="text-[11px] font-mono">
              {item.likes + (item.likedByUser ? 0 : 0)}
            </span>
          </button>

          {/* Comments */}
          <CommentThread
            postId={item.isDeckCard ? item.deckId : item.id}
            targetType={item.isDeckCard ? "deck" : "post"}
            initialCount={item.commentsCount ?? commentsCount}
            currentUserId={currentUserId}
            isDarkMode={isDarkMode}
            autoOpen={autoOpenComments}
          />

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSharePopover(!showSharePopover);
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(`${window.location.origin}/post/${item.id}\n\nCategory: ${item.category}\nConcept: ${item.content}`);
                }
              }}
              className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors group/btn cursor-pointer"
              title="Share this concept"
            >
              <Share2 className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
              <span className="text-[11px] font-mono">
                {shareFeedbackMsg || (sharedFeedback[item.id] ? "Copied!" : "Share")}
              </span>
            </button>

            {showSharePopover && (
              <>
                <div
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSharePopover(false);
                  }}
                />
                <div 
                  className={`absolute left-0 bottom-8 border rounded-md p-3.5 z-40 shadow-2xl min-w-[240px] text-left animated fadeInUp ${isDarkMode ? "bg-[#111] border-zinc-800" : "bg-[#fdfbfb] border-[#ebdcd7]"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={`flex items-center justify-between mb-2 pb-1.5 border-b ${isDarkMode ? "border-zinc-800" : "border-[#ebdcd7]"}`}>
                    <p className={`text-[10px] font-sans uppercase tracking-wider font-semibold ${isDarkMode ? "text-zinc-300" : "text-[#4a4e69]"}`}>
                      Share to Chat
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSharePopover(false);
                      }}
                      className={`transition-colors p-0.5 rounded cursor-pointer ${isDarkMode ? "text-zinc-500 hover:text-zinc-300" : "text-[#4a4e69] hover:text-[#22223b]"}`}
                      title="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1 max-h-[160px] overflow-y-auto scrollbar-none mb-3">
                    {recentChats.length === 0 ? (
                      <p className={`text-[10px] font-mono py-2 text-center ${isDarkMode ? "text-zinc-500" : "text-[#4a4e69]"}`}>No recent chats</p>
                    ) : (
                      recentChats.map(chat => (
                        <button
                          key={chat.partner_id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedShareUsers(prev => 
                              prev.includes(chat.partner_id) 
                                ? prev.filter(id => id !== chat.partner_id)
                                : [...prev, chat.partner_id]
                            )
                          }}
                          className={`w-full text-left px-2.5 py-2 rounded-sm text-xs transition-colors flex items-center justify-between ${
                            selectedShareUsers.includes(chat.partner_id)
                              ? isDarkMode ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-50 text-indigo-700"
                              : isDarkMode ? "text-zinc-400 hover:bg-white/5" : "text-[#4a4e69] hover:bg-[#22223b]/5"
                          }`}
                        >
                          <span className="truncate max-w-[140px] block">{chat.partner_full_name || chat.partner_username}</span>
                          {selectedShareUsers.includes(chat.partner_id) && (
                            <Check className="w-3 h-3 flex-shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  <button
                    disabled={selectedShareUsers.length === 0 || isSharing}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setIsSharing(true);
                      try {
                        const link = `${window.location.origin}/post/${item.id}`;
                        const messageText = `Check out this concept: [${item.category}] ${item.content}\n${link}`;
                        await Promise.all(selectedShareUsers.map(userId => sendMessage(userId, messageText)));
                        setShareFeedbackMsg("Sent!");
                        setShowSharePopover(false);
                        setTimeout(() => setShareFeedbackMsg(null), 2000);
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsSharing(false);
                      }
                    }}
                    className={`w-full py-2 rounded-sm text-[10px] font-mono uppercase tracking-wider font-bold transition-all disabled:opacity-50 cursor-pointer ${
                      isDarkMode 
                        ? "bg-white text-black hover:bg-zinc-200" 
                        : "bg-[#22223b] text-[#fdfbfb] hover:bg-[#1a1a2e]"
                    }`}
                  >
                    {isSharing ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : `Send to ${selectedShareUsers.length} chats`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-on-surface-variant/40 uppercase tracking-widest">
            {item.timeLabel}
          </span>

          <div className="flex items-center gap-3 relative">
            {saveFeedback ? (
              <span className="text-[9px] font-mono text-green-400 bg-green-950/10 px-2 py-1 rounded border border-green-900/30 flex items-center gap-1.5 animated pulse">
                <Check className="w-3 h-3 text-green-400" />
                <span>{saveFeedback}</span>
              </span>
            ) : (
              (!isSelfOwned || item.category !== "DECK") && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.category === "DECK") {
                      onForkDeck && onForkDeck(item.deckId || item.id);
                    } else if (item.isDeckCard) {
                      onToggleBookmark && onToggleBookmark(item.id);
                    } else {
                      setShowSavePopover(true);
                    }
                  }}
                  className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors group/btn cursor-pointer"
                >
                  {item.category === "DECK" ? (
                    <GitFork className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
                  ) : (
                    <Bookmark
                      className={`w-4 h-4 transition-transform group-hover/btn:scale-110 ${isFilled ? "text-white fill-white" : "text-on-surface-variant"
                        }`}
                    />
                  )}
                </button>
              )
            )}

            {showSavePopover && (
              <>
                <div
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSavePopover(false);
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
                        setShowSavePopover(false);
                      }}
                      className="text-on-surface-variant hover:text-on-surface transition-colors p-0.5 rounded cursor-pointer animate-none"
                      title="Close"
                    >
                      <X className="w-3.5 h-3.5 animate-none" />
                    </button>
                  </div>

                  <div className="space-y-1 max-h-[160px] overflow-y-auto scrollbar-none">
                    {userDecks && userDecks.map(deck => {
                      const isSavedInThisDeck = deck.cards?.some((c: any) => c.answer === item.content);
                      return (
                        <button
                          key={deck.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSavedInThisDeck) {
                              onRemoveCardFromDeck && onRemoveCardFromDeck(item.id, deck.id);
                              setSaveFeedback(`Removed`);
                            } else {
                              onSaveCardToDeck && onSaveCardToDeck(item.id, deck.id);
                              setSaveFeedback(`Saved`);
                            }

                            setTimeout(() => {
                              setSaveFeedback(null);
                            }, 2000);

                            setShowSavePopover(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-sm text-xs font-mono transition-colors flex items-center justify-between group/deckbtn ${isSavedInThisDeck
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

            <div className="relative">
              {footerAction}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
