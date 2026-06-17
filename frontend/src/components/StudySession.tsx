import { useState, useEffect } from "react";
import { 
  X, 
  HelpCircle, 
  CheckCircle, 
  ChevronRight, 
  Flame, 
  Award, 
  CornerDownRight, 
  Activity,
  Heart,
  Share2,
  Bookmark,
  Sparkles,
  Plus,
  ArrowLeft,
  Loader2,
  RefreshCw
} from "lucide-react";
import { Flashcard } from "../types";
import { FeedCard } from "./cards/FeedCard";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { getDueCards, gradeCard, mapDueCardToFlashcard, SrsGrade } from "../api/studyApi";

interface StudySessionProps {
  deckTitle: string;
  deckId?: string | null;   // Real UUID from backend — required for SRS grading
  cards: Flashcard[];
  onClose: () => void;
  onCardResult: (success: boolean) => void;
  isDarkMode?: boolean;
  isPublic?: boolean;
  decks?: any[];
  onImportDeck?: (deck: any) => void;
  onSaveCardToDeck?: (question: string, answer: string, deckId: string, details?: string) => void;
  onRemoveCardFromDeck?: (question: string, answer: string, deckId: string) => void;
}

export default function StudySession({ 
  deckTitle, 
  deckId = null,
  cards: propCards, 
  onClose, 
  onCardResult, 
  isDarkMode = true, 
  isPublic = false,
  decks,
  onImportDeck
}: StudySessionProps) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [apiCards, setApiCards] = useState<Flashcard[]>([]);
  const [cardsLoading, setCardsLoading] = useState<boolean>(!isPublic && !!deckId);
  const [cardsError, setCardsError] = useState<string | null>(null);

  // For private (non-public) mode, fetch real due cards from the backend
  useEffect(() => {
    if (isPublic || !deckId) return;
    setCardsLoading(true);
    setCardsError(null);
    getDueCards(deckId)
      .then(dueCards => {
        setApiCards(dueCards.map(mapDueCardToFlashcard));
      })
      .catch(() => {
        setCardsError("Failed to load cards. Check your connection.");
      })
      .finally(() => setCardsLoading(false));
  }, [deckId, isPublic]);
  // Determine which cards to show:
  // - Private mode with deckId: use apiCards (from backend SRS queue)
  // - Otherwise: use propCards (passed in) or fallback demo cards
  const fallbackCards: Flashcard[] = [
    {
      id: "card-1",
      question: "Describe the primary difference between gRPC and REST regarding network payloads.",
      answer: "gRPC utilizes Protocol Buffers (Protobuf) for binary serialization, resulting in highly compacted payloads. REST primarily relies on JSON strings, introducing higher parsing cycles and increased package overhead.",
      details: "Protobuf contracts (proto files) skip structural field transmissions on the wire by mapping indexes directly."
    },
    {
      id: "card-2",
      question: "Explain the concept of 'Backpressure' in asynchronous messaging pipelines.",
      answer: "A flow-control mechanism where a slow downstream reader signals an upstream writer to buffer, delay, or throttle transfers. This prevents consumer memory saturation.",
      details: "Implemented natively in systems via TCP window adjustments, reactive streams, or token buckets."
    }
  ];

  const [extraCards, setExtraCards] = useState<Flashcard[]>([]);

  const baseFlashcards: Flashcard[] = !isPublic && deckId
    ? (apiCards.length > 0 ? apiCards : [])
    : (propCards && propCards.length > 0 ? propCards : fallbackCards);

  const flashcards: Flashcard[] = [...baseFlashcards, ...extraCards];

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [sessionScore, setSessionScore] = useState<number>(0);
  const [complete, setComplete] = useState<boolean>(false);
  const [grading, setGrading] = useState<boolean>(false);

  const activeCard = flashcards[currentIndex];

  // Public-mode social interaction states
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [shared, setShared] = useState<boolean>(false);
  const [localLikes, setLocalLikes] = useState<number>(() => Math.floor(Math.random() * 24) + 12);

  const handleNextPublicCard = () => {
    // Reset states for the next card
    setIsLiked(false);
    setIsSaved(false);
    setShared(false);
    setLocalLikes(Math.floor(Math.random() * 24) + 12);

    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
    } else {
      setComplete(true);
    }
  };

  // 4-button SRS grading: sends grade to backend and advances card
  const handleRate = async (grade: SrsGrade) => {
    const success = grade === "Good" || grade === "Easy";
    onCardResult(success);
    if (success) setSessionScore(prev => prev + 1);

    // Submit grade to backend if we have a real card ID and deck
    if (!isPublic && activeCard?.id && deckId) {
      setGrading(true);
      try {
        await gradeCard(activeCard.id, grade);
      } catch {
        // Grade submission failed silently — card advances anyway
      } finally {
        setGrading(false);
      }
    }

    const isAddingAgain = grade === "Again";

    if (isAddingAgain) {
      setExtraCards(prev => [...prev, activeCard]);
    }

    const newTotalLength = flashcards.length + (isAddingAgain ? 1 : 0);

    if (currentIndex < newTotalLength - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
    } else {
      setComplete(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSessionScore(0);
    setShowAnswer(false);
    setComplete(false);
    setExtraCards([]);
  };

  // Publisher lookup map
  const cleanTitle = deckTitle?.toLowerCase() || "";
  let matchedPublisher = {
    creator: "@dev_kaufman",
    name: "Alex Kaufman",
    avatar: "AK",
    likes: 247,
    isFollowed: false,
    description: "Deep dive into memoization, tabulation, and complexity analysis for string manipulation problems.",
    tags: ["Algorithms", "DP", "Recursive"]
  };

  if (cleanTitle.includes("haskell") || cleanTitle.includes("monad")) {
    matchedPublisher = {
      creator: "@λ_stack",
      name: "Lambda Stack",
      avatar: "Λ",
      likes: 184,
      isFollowed: true,
      description: "Pragmatic structures, functors, applicability, and computational sequencing in pure functional paradigms.",
      tags: ["Haskell", "Monads", "FP"]
    };
  } else if (cleanTitle.includes("cognitive") || cleanTitle.includes("science") || cleanTitle.includes("synaptic")) {
    matchedPublisher = {
      creator: "@neuro_explorer",
      name: "Synapse Plasticity",
      avatar: "NP",
      likes: 512,
      isFollowed: false,
      description: "Understanding the intersection of synaptic plasticity and information theory in biological neural systems.",
      tags: ["Biology", "Cognitive", "AI"]
    };
  } else if (cleanTitle.includes("quantum") || cleanTitle.includes("electrodynamics")) {
    matchedPublisher = {
      creator: "@qed_physicist",
      name: "Feynman G",
      avatar: "QP",
      likes: 319,
      isFollowed: false,
      description: "Basic formulas, QED Feynman diagrams, photon behaviors, and perturbation methods.",
      tags: ["Physics", "Feynman", "QED"]
    };
  } else if (cleanTitle.includes("wittgenstein") || cleanTitle.includes("tractatus")) {
    matchedPublisher = {
      creator: "@philosophia",
      name: "Wittgenstein fan",
      avatar: "WP",
      likes: 92,
      isFollowed: false,
      description: "Exploring the logic-philosophical treaties, logical atoms, and representation frameworks.",
      tags: ["Philosophy", "Wittgenstein", "Logic"]
    };
  } else if (cleanTitle.includes("typography") || cleanTitle.includes("grid")) {
    matchedPublisher = {
      creator: "@grid_master",
      name: "Swiss Gridder",
      avatar: "GM",
      likes: 412,
      isFollowed: true,
      description: "The Swiss design manual for digital interfaces. Focus on 8px grid and modular layout scaling principles.",
      tags: ["Design", "Grid", "Typography"]
    };
  } else if (cleanTitle.includes("refactoring") || cleanTitle.includes("comedy") || cleanTitle.includes("laugh") || cleanTitle.includes("joke") || cleanTitle.includes("humor")) {
    matchedPublisher = {
      creator: "@dev_laugh",
      name: "Comedy Central",
      avatar: "CC",
      likes: 153,
      isFollowed: false,
      description: "A developer writes perfect, clean code. All unit tests pass locally. However, right before the CEO's demonstration, it mysteriously crashes.",
      tags: ["Humor", "Refactoring", "Code"]
    };
  } else if (cleanTitle.includes("cryptic") || cleanTitle.includes("cipher") || cleanTitle.includes("riddle")) {
    matchedPublisher = {
      creator: "@logic_matrix",
      name: "Cipher Core",
      avatar: "CC",
      likes: 201,
      isFollowed: false,
      description: "I am a logical mechanism. The more libraries and components you import, the larger I grow. Yet, the fewer syntax lines you write, the cleaner I compile. What am I?",
      tags: ["Riddles", "Logic", "Ciphers"]
    };
  } else if (cleanTitle.includes("ecmascript") || cleanTitle.includes("internals") || cleanTitle.includes("v8")) {
    matchedPublisher = {
      creator: "@js_runtime",
      name: "Chrome V8 Team",
      avatar: "JS",
      likes: 340,
      isFollowed: true,
      description: "V8 engine internals, memory models, garbage collection generations, and event loop microtask semantics.",
      tags: ["JS", "V8", "Engine"]
    };
  }

  const [followed, setFollowed] = useState<boolean>(() => matchedPublisher.isFollowed);
  const [likedDeck, setLikedDeck] = useState<boolean>(false);
  const [deckLikes, setDeckLikes] = useState<number>(() => matchedPublisher.likes);

  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [cardLikes, setCardLikes] = useState<Record<string, { count: number, active: boolean }>>(() => {
    const initial: Record<string, { count: number, active: boolean }> = {};
    flashcards.forEach(card => {
      initial[card.id] = {
        count: Math.floor(Math.random() * 24) + 12,
        active: false
      };
    });
    return initial;
  });
  const [cardSaved, setCardSaved] = useState<Record<string, boolean>>({});
  const [activeSaveDeckCardId, setActiveSaveDeckCardId] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<Record<string, string>>({});
  const [cardShared, setCardShared] = useState<Record<string, boolean>>({});  if (isPublic) {
    const isAlreadyImported = decks?.some(d => d.title.toLowerCase() === deckTitle.toLowerCase()) || false;

    const handleImportDeckClick = () => {
      if (onImportDeck) {
        const newDeck = {
          id: `deck-imported-${Date.now()}`,
          category: matchedPublisher.tags[0]?.toUpperCase() || "EXPLORE",
          title: deckTitle,
          description: matchedPublisher.description,
          progress: 0,
          cardCount: flashcards.length,
          iconType: "terminal",
          cards: flashcards
        };
        onImportDeck(newDeck);
      }
    };

    return (
      <div className={`w-full font-sans transition-colors ${
        isDarkMode ? "text-white" : "text-[#22223b]"
      }`}>
        {/* Top sticky/fixed header for premium app feeling */}
        <div className={`sticky top-0 z-30 backdrop-blur-md border-b px-6 py-4 transition-colors ${
          isDarkMode ? "bg-[#0a0a0a]/85 border-[#1A1A1A]" : "bg-[#fdfbfb]/85 border-[#ebdcd7]/80"
        }`}>
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                onClick={onClose}
                variant="ghost"
                isDarkMode={isDarkMode}
                className="flex items-center gap-2 px-3 py-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-xs font-mono font-bold tracking-widest uppercase">Back</span>
              </Button>
            </div>
            
            <span className={`text-[10px] font-mono tracking-widest uppercase font-bold py-0.5 px-2 rounded-xs ${
              isDarkMode ? "bg-white/10 text-[#d3d0cf]" : "bg-[#22223b]/10 text-[#4a4e69]"
            }`}>
              PUBLIC DECK INDEX
            </span>
          </div>
        </div>

        {/* Scrollable Content Container */}
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8 pb-32">
          
          {/* 2. Deck Title & Description Area */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <h1 className={`text-2xl md:text-3xl font-extrabold tracking-tight font-sans ${
                isDarkMode ? "text-white" : "text-[#22223b]"
              }`}>
                {deckTitle}
              </h1>
              <p className={`text-xs md:text-sm font-light leading-relaxed ${
                isDarkMode ? "text-zinc-400" : "text-[#4a4e69]/90"
              }`}>
                {matchedPublisher.description}
              </p>
            </div>
            
            {/* Tags and Import Action Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t border-dotted border-zinc-500/25 mt-2">
              <div className="flex flex-wrap gap-2 py-1">
                {(matchedPublisher.tags || []).map(tag => (
                  <span 
                    key={tag}
                    className={`text-[9.5px] font-mono font-medium px-2.5 py-0.5 rounded-xs uppercase tracking-wider ${
                      isDarkMode 
                        ? "bg-zinc-900 text-zinc-400 border border-zinc-800" 
                        : "bg-[#eed9d2]/40 text-[#22223b] border border-[#ebdcd7]"
                    }`}
                  >
                    #{tag.toLowerCase()}
                  </span>
                ))}
                <span className={`text-[9.5px] font-mono px-2.5 py-0.5 rounded-xs border border-dashed uppercase tracking-wider ${
                  isDarkMode 
                    ? "border-zinc-800 text-zinc-400" 
                    : "border-[#c9ada7] text-[#4a4e69]/70"
                }`}>
                  {flashcards.length} cards
                </span>
                <button
                  onClick={() => {
                    const nextLiked = !likedDeck;
                    setLikedDeck(nextLiked);
                    setDeckLikes(curr => nextLiked ? curr + 1 : curr - 1);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-xs text-[9.5px] font-mono tracking-wider transition-colors cursor-pointer border ${
                    likedDeck
                      ? "bg-red-500/10 border-red-500/45 text-red-500"
                      : isDarkMode
                        ? "bg-transparent border-zinc-800 text-zinc-400 hover:text-white"
                        : "bg-transparent border-[#c9ada7] text-[#4a4e69] hover:text-[#22223b]"
                  }`}
                >
                  <Heart className={`w-3 h-3 ${likedDeck ? "fill-red-500 text-red-500" : ""}`} />
                  <span>{deckLikes} likes</span>
                </button>
              </div>

              <div>
                {isAlreadyImported ? (
                  <div className={`flex items-center gap-1.5 px-3.5 py-1.5 text-[10px] font-mono tracking-wider font-semibold uppercase rounded-xs border ${
                    isDarkMode 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                      : "bg-emerald-50 border-emerald-200 text-emerald-800"
                  }`}>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>In Your Studies</span>
                  </div>
                ) : (
                  <Button
                    onClick={handleImportDeckClick}
                    variant="primary"
                    className="flex items-center gap-1.5 uppercase font-bold"
                    isDarkMode={isDarkMode}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to My Studies</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* New Author Section (No background/border) */}
          <div className="flex items-center justify-between pt-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono ${isDarkMode ? "text-zinc-400" : "text-[#4a4e69]"}`}>by</span>
                <span className={`text-sm font-bold font-sans ${isDarkMode ? "text-white" : "text-[#22223b]"}`}>
                  {matchedPublisher.name}
                </span>
                <span className={`text-xs font-mono ml-1 ${isDarkMode ? "text-zinc-500" : "text-[#4a4e69]/60"}`}>
                  {matchedPublisher.creator}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => setFollowed(!followed)}
              className={`text-xs font-mono uppercase font-bold tracking-wider transition-colors flex items-center gap-1 cursor-pointer ${
                followed
                  ? isDarkMode 
                    ? "text-zinc-500 hover:text-zinc-400" 
                    : "text-[#4a4e69]/70 hover:text-[#4a4e69]"
                  : isDarkMode
                    ? "text-white hover:text-zinc-300" 
                    : "text-[#22223b] hover:text-[#4a4e69]"
              }`}
            >
              {followed ? "Following" : "Follow"}
            </button>
          </div>

          <div className={`border-b ${isDarkMode ? "border-[#1A1A1A]" : "border-[#ebdcd7]"}`}></div>

          {/* 3. Scrolling Feed of Cards (matching Feed view aesthetics exactly) */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-mono tracking-widest uppercase font-bold ${
                isDarkMode ? "text-zinc-400" : "text-[#4a4e69]/70"
              }`}>
                CONCEPTS IN THIS DECK
              </span>
              <span className={`text-[9px] font-mono uppercase ${
                isDarkMode ? "text-zinc-400/80" : "text-[#4a4e69]/50"
              }`}>
                TAP A CARD TO REVEAL
              </span>
            </div>

            {flashcards.map((card, idx) => {
              const isExpanded = expandedCards[card.id] || false;
              const likesData = cardLikes[card.id] || { count: 18, active: false };
              const isSaved = cardSaved[card.id] || false;
              const isShared = cardShared[card.id] || false;

              const isJoke = cleanTitle.includes("refactoring") || cleanTitle.includes("comedy") || cleanTitle.includes("laugh") || cleanTitle.includes("joke") || cleanTitle.includes("humor");
              const emoji = isJoke ? "🎭" : "💡";
              const buttonText = isExpanded 
                ? `${emoji} CONCEAL SOLUTION` 
                : isJoke 
                  ? "🎭 REVEAL PUNCHLINE" 
                  : "💡 REVEAL ANSWER";

              const solvedIndicator = isJoke ? "PUNCHLINE" : "ANSWER";

              return (
                <article key={card.id} className="space-y-3">
                  {/* 1. Main outer card box container */}
                  <FeedCard
                    isDarkMode={isDarkMode}
                    viewMode="study"
                    flashcard={card}
                    deckTitle={deckTitle}
                    deckTags={matchedPublisher.tags}
                    isExpanded={isExpanded}
                    onToggleReveal={() => {
                      setExpandedCards(prev => ({
                        ...prev,
                        [card.id]: !isExpanded
                      }));
                    }}
                  />
                  {/* 2. Outer Social Toolbar (matching underneath margins exactly) */}
                  <div className={`flex items-center justify-between px-2 text-[11px] font-mono transition-colors pb-6 ${
                    isDarkMode ? "text-zinc-400" : "text-[#4a4e69]"
                  }`} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-5">
                      {/* Likes status button */}
                      <button
                        onClick={() => {
                          const loved = !likesData.active;
                          setCardLikes(prev => ({
                            ...prev,
                            [card.id]: {
                              count: loved ? likesData.count + 1 : likesData.count - 1,
                              active: loved
                            }
                          }));
                        }}
                        className={`flex items-center gap-1.5 transition-colors group/btn cursor-pointer ${
                          likesData.active 
                            ? "text-red-500 font-semibold" 
                            : isDarkMode 
                              ? "text-zinc-400 hover:text-white" 
                              : "text-[#4a4e69]/75 hover:text-[#22223b]"
                        }`}
                      >
                        <Heart
                          className={`w-3.5 h-3.5 transition-transform group-hover/btn:scale-110 ${
                            likesData.active ? "text-red-500 fill-red-500" : ""
                          }`}
                        />
                        <span>{likesData.count}</span>
                      </button>

                      {/* Copy Shareable Link button */}
                      <button
                        onClick={() => {
                          setCardShared(prev => ({ ...prev, [card.id]: true }));
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(`${window.location.origin}/post/${card.id}\n\nConcept: ${card.question}\nReference Outcome: ${card.answer}`);
                          }
                          setTimeout(() => {
                            setCardShared(prev => ({ ...prev, [card.id]: false }));
                          }, 2000);
                        }}
                        className={`flex items-center gap-1.5 transition-colors group/btn cursor-pointer ${
                          isDarkMode 
                            ? "text-zinc-400 hover:text-white" 
                            : "text-[#4a4e69]/75 hover:text-[#22223b]"
                        }`}
                        title="Copy shareable link"
                      >
                        <Share2 className="w-3.5 h-3.5 transition-transform group-hover/btn:scale-110" />
                        <span>{isShared ? "Copied!" : "Share"}</span>
                      </button>
                    </div>

                    {/* Right info (timestamp & Bookmark save button) */}
                    <div className="flex items-center gap-4">
                      <span className={`text-[10px] font-mono tracking-wide ${
                        isDarkMode ? "text-zinc-400/80" : "text-[#4a4e69]/55"
                      }`}>
                        JUST NOW
                      </span>
                      
                      <button
                        onClick={() => {
                          setCardSaved(prev => ({ ...prev, [card.id]: !isSaved }));
                        }}
                        className={`flex items-center gap-1.5 transition-colors group/btn cursor-pointer ${
                          isSaved 
                            ? isDarkMode ? "text-white font-semibold" : "text-[#22223b] font-semibold"
                            : isDarkMode ? "text-zinc-400 hover:text-white" : "text-[#4a4e69]/75 hover:text-[#22223b]"
                        }`}
                        title={isSaved ? "Saved to Personal Decks" : "Save to Decks"}
                      >
                        <Bookmark
                          className={`w-3.5 h-3.5 transition-transform group-hover/btn:scale-110 ${
                            isSaved ? "fill-current" : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex flex-col justify-between p-6 overflow-y-auto font-sans select-none transition-colors ${
      isDarkMode ? "bg-black text-white" : "bg-[#f2e9e4] text-[#22223b]"
    }`}>
      
      {/* Session Top Bar */}
      <header className={`flex items-center justify-between py-4 border-b max-w-2xl w-full mx-auto ${
        isDarkMode ? "border-[#1A1A1A]" : "border-[#c9ada7]/60"
      }`}>
        <div className="flex items-center gap-3">
          <Activity className={`w-4 h-4 animate-pulse ${isDarkMode ? "text-white" : "text-[#22223b]"}`} />
          <div className="space-y-0.5">
            <span className={`text-[10px] font-mono tracking-widest uppercase ${
              isDarkMode ? "text-on-surface-variant/40" : "text-[#4a4e69]/70"
            }`}>Active Session</span>
            <h2 className={`text-xs font-bold tracking-wide uppercase ${
              isDarkMode ? "text-white" : "text-[#22223b]"
            }`}>{deckTitle}</h2>
          </div>
        </div>

        <Button 
          onClick={onClose}
          variant="ghost"
          size="icon"
          isDarkMode={isDarkMode}
          className="p-1.5"
        >
          <X className="w-4 h-4" />
        </Button>
      </header>

      {/* Main Focus Content Arena */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-2xl w-full mx-auto my-8">

        {/* Loading state while fetching due cards */}
        {cardsLoading ? (
          <div className="text-center space-y-4">
            <Loader2 className={`w-8 h-8 mx-auto animate-spin ${isDarkMode ? "text-white" : "text-[#22223b]"}`} />
            <p className={`text-xs font-mono uppercase tracking-widest ${isDarkMode ? "text-on-surface-variant/40" : "text-[#4a4e69]/60"}`}>
              Loading due cards...
            </p>
          </div>
        ) : cardsError ? (
          /* Error state */
          <div className="text-center space-y-4">
            <p className={`text-sm font-mono ${isDarkMode ? "text-red-400" : "text-red-600"}`}>{cardsError}</p>
            <Button onClick={onClose} variant="outline" isDarkMode={isDarkMode}>Go Back</Button>
          </div>
        ) : !cardsLoading && !isPublic && deckId && flashcards.length === 0 ? (
          /* No cards due today */
          <div className="text-center space-y-6 animated fadeIn">
            <Award className={`w-12 h-12 mx-auto ${isDarkMode ? "text-white" : "text-[#22223b]"}`} />
            <div className="space-y-2">
              <h1 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-[#22223b]"}`}>
                All Caught Up!
              </h1>
              <p className={`text-xs font-mono ${isDarkMode ? "text-on-surface-variant/80" : "text-[#4a4e69]/80"}`}>
                No cards are due in <span className="font-bold">{deckTitle}</span> right now. Come back tomorrow!
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button onClick={onClose} variant="primary" isDarkMode={isDarkMode}>Back to Decks</Button>
            </div>
          </div>
        ) : complete ? (
          /* Finished block screen overlay */
          <div className="text-center space-y-6 animated fadeIn py-8">
            <Award className={`w-12 h-12 mx-auto animate-bounce ${isDarkMode ? "text-white" : "text-[#22223b]"}`} />
            <div className="space-y-2">
              <h1 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-[#22223b]"}`}>Focus Track Concluded</h1>
              <p className={`text-xs ${isDarkMode ? "text-on-surface-variant/80" : "text-[#4a4e69]/80"}`}>
                You successfully evaluated <span className={`font-mono font-bold ${
                  isDarkMode ? "text-white" : "text-[#22223b]"
                }`}>{sessionScore} / {flashcards.length}</span> key structures.
              </p>
            </div>

            <div className={`flex items-center justify-center gap-2 p-4 rounded-xs text-[11px] max-w-xs mx-auto border ${
              isDarkMode 
                ? "bg-[#111111] border-[#222222] text-white" 
                : "bg-[#fdfbfb] border-[#c9ada7] text-[#22223b]"
            }`}>
              <Flame className={`w-4 h-4 ${isDarkMode ? "text-white" : "text-[#22223b]"}`} />
              <span className={`font-mono uppercase tracking-wider ${
                isDarkMode ? "text-on-surface-variant" : "text-[#4a4e69]"
              }`}>
                DAILY STREAK VERIFIED +1 EXP
              </span>
            </div>

            <div className="flex justify-center gap-3 pt-4 text-xs font-mono">
              <Button
                onClick={handleRestart}
                variant="outline"
                className="px-5 py-2"
                isDarkMode={isDarkMode}
              >
                Study Again
              </Button>
              <Button
                onClick={onClose}
                variant="primary"
                className="px-5 py-2"
                isDarkMode={isDarkMode}
              >
                Conclude Logs
              </Button>
            </div>
          </div>
        ) : (
          /* Active studying view block card */
          <div className="w-full space-y-6">
            
            {/* Progression indicator */}
            <div className={`flex items-center justify-between text-[11px] font-mono ${
              isDarkMode ? "text-on-surface-variant/40" : "text-[#4a4e69]/70"
            }`}>
              <span>CARD MODULE INDEX: {currentIndex + 1} OF {flashcards.length}</span>
              <span>SCORE: {sessionScore} ACCUMULATED</span>
            </div>

            {/* Flashcard container block */}
            <div 
              onClick={() => setShowAnswer(!showAnswer)}
              className={`w-full p-5 md:p-10 lg:p-12 border rounded-xs transition-all duration-300 min-h-[180px] md:min-h-[260px] flex flex-col justify-between cursor-pointer relative active:scale-[0.99] select-none ${
                showAnswer 
                  ? isDarkMode 
                    ? "border-white/40 bg-zinc-900/40 shadow-none" 
                    : "border-[#c9ada7] bg-[#ebdcd7]/60 shadow-inner"
                  : isDarkMode
                    ? "border-[#1A1A1A] bg-black hover:border-white/20 hover:bg-[#070707]"
                    : "border-[#c9ada7] bg-[#fdfbfb] hover:border-[#22223b] hover:bg-[#ffffff] hover:translate-y-[-2px] shadow-[0_4px_24px_rgba(34,34,59,0.06)] hover:shadow-[0_8px_32px_rgba(34,34,59,0.1)]"
              }`}
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className={`text-[10px] font-mono uppercase tracking-[0.2em] flex items-center gap-1.5 ${
                    isDarkMode ? "text-white" : "text-[#22223b] font-semibold"
                  }`}>
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Question Query</span>
                  </span>
                  <span className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 border rounded ${
                    isDarkMode 
                      ? "text-on-surface-variant/40 bg-[#111] border-[#1a1a1a]" 
                      : "text-[#4a4e69]/80 bg-[#ebdcd7]/40 border-[#c9ada7]"
                  }`}>
                    TAP TO {showAnswer ? "HIDE" : "REVEAL"}
                  </span>
                </div>
                <p className={`text-sm md:text-base font-light leading-normal tracking-wide ${
                  isDarkMode ? "text-white" : "text-[#22223b] font-medium"
                }`}>
                  {activeCard.question}
                </p>
              </div>

              {showAnswer ? (
                /* Revealed state answer view */
                <div className={`space-y-4 pt-6 border-t animated fadeIn ${
                  isDarkMode ? "border-[#1A1A1A]/70" : "border-[#c9ada7]"
                }`}>
                  <span className={`text-[10px] font-mono uppercase tracking-[0.2em] flex items-center gap-1.5 ${
                    isDarkMode ? "text-green-400" : "text-emerald-700 font-semibold"
                  }`}>
                    <CheckCircle className={`w-3.5 h-3.5 ${isDarkMode ? "text-green-400" : "text-emerald-700"}`} />
                    <span>Reference Outcome</span>
                  </span>
                  <p className={`text-xs md:text-sm font-mono leading-relaxed ${
                    isDarkMode ? "text-white" : "text-[#22223b]"
                  }`}>
                    {activeCard.answer}
                  </p>
                  {activeCard.details && (
                    <div className={`flex gap-1.5 items-start p-3 border rounded-xs ${
                      isDarkMode 
                        ? "bg-black/40 border-[#1a1a1a]" 
                        : "bg-[#ebdcd7]/30 border-[#c9ada7]"
                    }`}>
                      <CornerDownRight className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                        isDarkMode ? "text-on-surface-variant/40" : "text-[#4a4e69]/50"
                      }`} />
                      <p className={`text-[10px] font-light italic leading-relaxed ${
                        isDarkMode ? "text-on-surface-variant" : "text-[#4a4e69]"
                      }`}>
                        {activeCard.details}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Unrevealed tip indicator bar */
                <div className="pt-6 border-t border-transparent text-center">
                  <span className={`text-[11px] font-mono uppercase tracking-widest animate-pulse ${
                    isDarkMode ? "text-white" : "text-[#22223b]/80"
                  }`}>
                    Tap to reveal answer
                  </span>
                </div>
              )}
            </div>

            {/* Studying feedback handles */}
            {isPublic ? (
              <div className="space-y-4 pt-4">
                {/* Social Interaction Toolbar */}
                <div className={`flex items-center justify-between px-4 py-3.5 border rounded-xs transition-colors ${
                  isDarkMode 
                    ? "bg-[#0b0b0b] border-[#1c1c1c]" 
                    : "bg-[#fcf8f6] border-[#ebdcd7]"
                }`}>
                  <div className="flex items-center gap-6">
                    {/* Likes button */}
                    <button
                      onClick={() => {
                        setIsLiked(!isLiked);
                        setLocalLikes(curr => isLiked ? curr - 1 : curr + 1);
                      }}
                      className={`flex items-center gap-2 transition-colors group/btn cursor-pointer ${
                        isLiked 
                          ? "text-red-500 font-semibold" 
                          : isDarkMode 
                            ? "text-[#a3a3a3] hover:text-white" 
                            : "text-[#4a4e69] hover:text-[#22223b]"
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 transition-transform group-hover/btn:scale-110 ${
                          isLiked ? "text-red-500 fill-red-500" : ""
                        }`}
                      />
                      <span className="text-[11px] font-mono">
                        {localLikes}
                      </span>
                    </button>

                    {/* Share button */}
                    <button
                      onClick={() => {
                        setShared(true);
                        if (navigator.clipboard) {
                          navigator.clipboard.writeText(`${window.location.origin}/post/${activeCard.id || 'public'}\n\nConcept: ${activeCard.question}\nReference Outcome: ${activeCard.answer}`);
                        }
                        setTimeout(() => setShared(false), 2000);
                      }}
                      className={`flex items-center gap-2 transition-colors group/btn cursor-pointer ${
                        isDarkMode 
                          ? "text-[#a3a3a3] hover:text-white" 
                          : "text-[#4a4e69] hover:text-[#22223b]"
                      }`}
                      title="Share this concept"
                    >
                      <Share2 className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
                      <span className="text-[11px] font-mono">
                        {shared ? "Copied!" : "Share"}
                      </span>
                    </button>
                  </div>

                  {/* Bookmark Save button */}
                  <button
                    onClick={() => setIsSaved(!isSaved)}
                    className={`flex items-center gap-2 transition-colors group/btn cursor-pointer ${
                      isSaved 
                        ? isDarkMode ? "text-white" : "text-[#22223b]"
                        : isDarkMode ? "text-[#a3a3a3] hover:text-white" : "text-[#4a4e69] hover:text-[#22223b]"
                    }`}
                    title="Save to Personal Decks"
                  >
                    <Bookmark
                      className={`w-4 h-4 transition-transform group-hover/btn:scale-110 ${
                        isSaved ? "fill-current" : ""
                      }`}
                    />
                    <span className="text-[11px] font-mono">
                      {isSaved ? "Saved" : "Save"}
                    </span>
                  </button>
                </div>

                {/* Primary navigation button (Next or Tap to Reveal) */}
                {showAnswer ? (
                  <Button
                    onClick={handleNextPublicCard}
                    variant="primary"
                    className="w-full py-3 tracking-wider uppercase flex gap-2"
                    isDarkMode={isDarkMode}
                  >
                    <span>Next Card</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => setShowAnswer(true)}
                    variant="primary"
                    className="w-full py-3 tracking-wider uppercase"
                    isDarkMode={isDarkMode}
                  >
                    Tap to Reveal Answer
                  </Button>
                )}
              </div>
            ) : (
              /* Private study session — 4-button SRS grading after reveal */
              showAnswer ? (
                <div className="space-y-3 pt-4">
                  <p className={`text-center text-[10px] font-mono uppercase tracking-widest ${
                    isDarkMode ? "text-on-surface-variant/40" : "text-[#4a4e69]/60"
                  }`}>How well did you know this?</p>
                  <div className="grid grid-cols-4 gap-2 text-[11px] font-mono">
                    {(["Again", "Hard", "Good", "Easy"] as SrsGrade[]).map((grade) => {
                      const styles: Record<SrsGrade, string> = {
                        Again: "border-red-900/60 text-red-400 hover:bg-red-950/30 hover:border-red-500",
                        Hard:  "border-orange-900/60 text-orange-400 hover:bg-orange-950/30 hover:border-orange-500",
                        Good:  "border-emerald-900/60 text-emerald-400 hover:bg-emerald-950/30 hover:border-emerald-500",
                        Easy:  "border-blue-900/60 text-blue-400 hover:bg-blue-950/30 hover:border-blue-500",
                      };
                      return (
                        <button
                          key={grade}
                          onClick={() => handleRate(grade)}
                          disabled={grading}
                          className={`py-3 px-2 border rounded-xs uppercase tracking-wider font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5 ${
                            isDarkMode
                              ? `bg-transparent ${styles[grade]}`
                              : "bg-[#fdfbfb] border-[#c9ada7] text-[#22223b] hover:bg-[#f2e9e4]"
                          }`}
                        >
                          {grading ? <Loader2 className="w-3 h-3 animate-spin" /> : grade}
                        </button>
                      );
                    })}
                  </div>
                  <p className={`text-center text-[9px] font-mono uppercase tracking-widest ${
                    isDarkMode ? "text-on-surface-variant/25" : "text-[#4a4e69]/40"
                  }`}>
                    Again = retry soon · Hard = needs work · Good = on track · Easy = fast-forward
                  </p>
                </div>
              ) : (
                <Button
                  onClick={() => setShowAnswer(true)}
                  variant="primary"
                  className="w-full py-3 tracking-wider uppercase"
                  isDarkMode={isDarkMode}
                >
                  Tap to Reveal Answer
                </Button>
              )
            )}

          </div>
        )}
      </main>

      {/* Dynamic hotkey instructions bar */}
      <footer className={`py-4 border-t max-w-2xl w-full mx-auto text-center text-[10px] font-mono tracking-wider ${
        isDarkMode 
          ? "border-[#1A1A1A] text-on-surface-variant/20" 
          : "border-[#c9ada7]/30 text-[#4a4e69]/50"
      }`}>
        KEYBOARD CONSTRAINTS: [ SPACEBAR ] TO REVEAL • [ ← ] PREV / REVIEW • [ → ] KNOWN
      </footer>

    </div>
  );
}
