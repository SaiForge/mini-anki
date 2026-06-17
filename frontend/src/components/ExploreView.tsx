import { useState } from "react";
import { 
  TrendingUp, 
  Eye, 
  Bookmark, 
  Share2, 
  HelpCircle, 
  CheckCircle, 
  Terminal, 
  Plus, 
  Unlock,
  ChevronRight,
  FolderPlus,
  Check,
  X,
  Sparkles,
  Code
} from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import { FeedCard } from "./cards/FeedCard";

interface ExploreViewProps {
  onStudyDeck: (deckName: string) => void;
  searchQuery: string;
  decks: any[];
  feedItems?: any[];
  onSaveCardToDeck: (title: string, desc: string, deckId: string) => void;
  onSaveToNewDeck: (title: string, desc: string, newDeckTitle: string) => void;
  onRemoveCardFromDeck: (title: string, desc: string, deckId: string) => void;
}

interface ExploreCard {
  id: string;
  category: string;
  title: string;
  description: string;
  cardCountLabel?: string;
  creator: string;
  imageUrl?: string;
  tags?: string[];
  isNew?: boolean;
  isPopular?: boolean;
  quizQuestion?: string;
  quizAnswerOptions?: string[];
  plainQuoteStyle?: string;
  visualMock?: "grid" | "none";
}

export default function ExploreView({ 
  onStudyDeck, 
  searchQuery,
  decks,
  feedItems = [],
  onSaveCardToDeck,
  onSaveToNewDeck,
  onRemoveCardFromDeck
}: ExploreViewProps) {
  const [activeCategory, setActiveCategory] = useState<string>("Trending");
  const [revealSteps, setRevealSteps] = useState<Record<string, number>>({});
  const [hasDecrypted, setHasDecrypted] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [userFunctorAnswer, setUserFunctorAnswer] = useState<boolean | null>(null);
  const [activeSaveDeckItemId, setActiveSaveDeckItemId] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<Record<string, string>>({});
  const [newDeckTitle, setNewDeckTitle] = useState<string>("");

  const getCardMaxSteps = (deck: ExploreCard): number => {
    if (deck.quizQuestion) return 1;
    return 0; // standard deck metadata is visible directly
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

  const renderTags = (deck: ExploreCard) => {
    if (!deck.tags || deck.tags.length === 0) return null;
    return (
      <div 
        className="flex flex-wrap gap-x-2 gap-y-1 pt-2.5 justify-start"
        onClick={(e) => e.stopPropagation()} 
      >
        {deck.tags.map(tag => (
          <span
            key={tag}
            className="text-[10px] font-mono lowercase text-zinc-500/60 hover:text-zinc-200 transition-colors bg-transparent border-0 p-0 m-0"
            title={`Tag #${tag}`}
          >
            #{tag}
          </span>
        ))}
      </div>
    );
  };

  // Initial core curated dataset matching screens
  const [exploreDecks, setExploreDecks] = useState<ExploreCard[]>([
    {
      id: "exp-1",
      category: "Advanced Algorithms",
      title: "Dynamic Programming Patterns",
      description: "Deep dive into memoization, tabulation, and complexity analysis for string manipulation problems.",
      cardCountLabel: "142 Cards",
      creator: "@dev_kaufman",
      imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDHJUW8ySE-kB-6DLQiBaVVJYeXqVSPwEUwEhEcQmMV13kQ7jsWTscwoI6mofp3oIyFE7MJjTBaaJSYNi4aTk_J_QCrESs2dxWaMvWebHDAKbBZ5SQBTSkxNB9nXIIj77OKUZUdOCYeiHdHsridAxKTxZoH7KXf6mFikkzwKIjl8pn9G91Xedm94B1SZPXlvcTUZ92WuPdg22vLRHqX-cfdRhazCEueI4CwBaB56QQdYlynnw0XZHc4V0zzxnFu6ux9SF0DRIL9UcbV",
    },
    {
      id: "exp-2",
      category: "NEW",
      title: "Haskell: Monads in Practice",
      isNew: true,
      description: "Pragmatic structures, functors, applicability, and computational sequencing in pure functional paradigms.",
      quizQuestion: "What is the core definition of a Functor?",
      quizAnswerOptions: ["A mapping between categories that preserves structure...", "A monoid inside the endofunctor class..."],
      creator: "@λ_stack",
    },
    {
      id: "exp-3",
      category: "Cognitive Science",
      title: "Cognitive Architecture",
      description: "Understanding the intersection of synaptic plasticity and information theory in biological neural systems.",
      tags: ["Biology", "AI"],
      creator: "@neuro_explorer",
      imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDF09Ngd_D9Vjc1gsAtXjMFiyuMcNd13rFXIllOYbOOf6l_lxBHyyZnmIjYGuKLAPtBJ7r_lr9TbbmqFBRc0CRCl-hObx4GcLcgE3k1eZKSrVC4dGzT7X-QhAy5hn5NS43ZAPTZowvOyZtrBHqveeT987FoDvvN0ywCOcsXSKENu1ziICXG6b4M0TqTQeAzxpno9H9v9ZbmnIjunFp6Ux8ZJdN78BDHSAd65IMjWgFsfiWNRoAqTJgEyb4hUick8K478Ofiy4tlCmqg",
    },
    {
      id: "exp-4",
      category: "Popular this week",
      title: "Quantum Electrodynamics: The Basics",
      description: "Basic formulas, QED Feynman diagrams, photon behaviors, and perturbation methods.",
      isPopular: true,
      creator: "@qed_physicist",
    },
    {
      id: "exp-5",
      category: "Philosophy of Language",
      title: "Wittgenstein's Tractatus",
      creator: "@philosophia",
      plainQuoteStyle: '"The limit of my language means the limit of my world."',
      description: "Exploring the logic-philosophical treaties, logical atoms, and representation frameworks.",
    },
    {
      id: "exp-6",
      category: "Computer Science",
      title: "Typography & Grid Systems",
      description: "The Swiss design manual for digital interfaces. Focus on 8px grid and modular layout scaling principles.",
      creator: "@grid_master",
      visualMock: "grid",
    },
    {
      id: "exp-joke-1",
      category: "Jokes",
      title: "The Refactoring Paradox",
      description: "A developer writes perfect, clean code. All unit tests pass locally. However, right before the CEO's demonstration, it mysteriously crashes.",
      creator: "@dev_laugh",
      isNew: true,
      tags: ["Humor", "Refactoring"],
      quizQuestion: "What is the primary cause of refactoring bugs showing up during a live demo?",
      quizAnswerOptions: ["Demo Effect: minor environmental differences combined with Murphy's law", "V8 engine compiler garbage sweeps", "Continuous Integration lock timers"]
    },
    {
      id: "exp-riddle-1",
      category: "Riddles",
      title: "The Cryptic Cipher",
      description: "I am a logical mechanism. The more libraries and components you import, the larger I grow. Yet, the fewer syntax lines you write, the cleaner I compile. What am I?",
      creator: "@logic_matrix",
      isPopular: true,
      tags: ["Riddles", "Logic"],
      quizQuestion: "What is the answer to this riddle?",
      quizAnswerOptions: ["The codebase / bundle size", "A memory heap leak", "A binary search tree"]
    }
  ]);

  const categories = [
    "Trending", 
    "Computer Science", 
    "Neuroscience", 
    "Linguistics", 
    "Discrete Math", 
    "Philosophy",
    "Jokes",
    "Riddles"
  ];

  // Simulated decryption function for load-more button
  const handleDecryptMore = () => {
    setIsDecrypting(true);
    setTimeout(() => {
      setExploreDecks(prev => [
        ...prev,
        {
          id: "exp-7",
          category: "Advanced Math",
          title: "Category Theory Fields",
          description: "Morphisms, functors, natural transformations, and universal properties in computer science abstracts.",
          creator: "@morphism_co",
          tags: ["Topology", "Haskell"]
        },
        {
          id: "exp-8",
          category: "NEW",
          title: "Transformer Syntaxes",
          description: "Deep dive into self-attention, scale dot-product multipliers, and multi-head visual embeddings.",
          creator: "@attention_net",
          tags: ["LLM", "Deep Learning"]
        }
      ]);
      setHasDecrypted(true);
      setIsDecrypting(false);
    }, 1200);
  };

  const filteredDecks = exploreDecks.filter((deck) => {
    const matchesCategory = 
      activeCategory === "Trending" || 
      deck.category.toLowerCase().includes(activeCategory.toLowerCase()) ||
      (deck.tags && deck.tags.some(t => t.toLowerCase() === activeCategory.toLowerCase()));

    const matchesSearch = 
      deck.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deck.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deck.creator.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const hasSearch = searchQuery.trim().length > 0;

  const filteredCards = feedItems.filter(item => {
    if (!hasSearch) return false;
    return (
      (item.title && item.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.content && item.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  return (
    <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-8 space-y-12 pb-32">
      
      {!hasSearch && (
        <>
          {/* Horizontal Category Chips */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none border-b border-[#1A1A1A]">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 text-[12px] font-sans tracking-wide rounded-xs transition-all whitespace-nowrap cursor-pointer ${
                  activeCategory === cat
                    ? "bg-white text-black font-semibold border border-white"
                    : "bg-surface-container border border-[#1A1A1A] text-on-surface-variant/80 hover:text-white hover:border-[#333]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Explore Heading Left-Border Accent */}
          <div className="border-l-2 border-white pl-6 py-1">
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-white font-sans">
              Search Decks
            </h1>
            <p className="text-on-surface-variant/75 text-xs mt-1">
              Curated intelligence from the global network of researchers and developers.
            </p>
          </div>
        </>
      )}

      {hasSearch && (
        <div className="border-l-2 border-white pl-6 py-1">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-white font-sans">
            Search Results for "{searchQuery}"
          </h1>
        </div>
      )}

      {hasSearch && filteredCards.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-white tracking-tight border-b border-[#1A1A1A] pb-2">Related Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
            {filteredCards.map((item, index) => (
              <FeedCard
                key={`search-card-${item.id || index}`}
                item={item}
                decks={decks}
                savedFeedback={savedFeedback}
                activeSaveDeckItemId={activeSaveDeckItemId}
                setActiveSaveDeckItemId={setActiveSaveDeckItemId}
                newDeckTitle={newDeckTitle}
                setNewDeckTitle={setNewDeckTitle}
                onSaveToNewDeck={onSaveToNewDeck}
                onSaveCardToDeck={onSaveCardToDeck}
                onRemoveCardFromDeck={onRemoveCardFromDeck}
                isDarkMode={true}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {hasSearch && (
          <h2 className="text-lg font-bold text-white tracking-tight border-b border-[#1A1A1A] pb-2">
            {filteredDecks.length > 0 ? "Related Decks" : "No related decks found"}
          </h2>
        )}
        
        {/* Responsive Masonry / Flow Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {filteredDecks.map((deck) => {
          const maxSteps = getCardMaxSteps(deck);
          const currentStep = revealSteps[deck.id] || 0;
          const isSingle = maxSteps === 0;
          const isFullyRevealed = isSingle || currentStep === maxSteps;
          return (
            <div
              key={deck.id}
              onClick={() => {
                if (!isSingle) {
                  handleNextStep(deck.id, maxSteps);
                } else {
                  onStudyDeck(deck.title);
                }
              }}
              className={`group border rounded-xs transition-all duration-300 overflow-hidden flex flex-col justify-between ${
                isSingle 
                  ? "border-[#1A1A1A] bg-black hover:bg-[#111111] hover:border-white/30 cursor-pointer" 
                  : isFullyRevealed
                    ? "border-zinc-500 bg-[#0c0c0c] cursor-pointer hover:border-zinc-400 active:scale-[0.995]" 
                    : "border-zinc-800 bg-[#030303] cursor-pointer hover:border-zinc-700 hover:bg-[#050505] active:scale-[0.995]"
              }`}
            >
              {/* Image Graphic segment */}
              {deck.imageUrl && (
                <div className="h-56 md:h-64 overflow-hidden relative">
                  <img
                    src={deck.imageUrl}
                    alt={deck.title}
                    className="w-full h-full object-cover grayscale opacity-50 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-60"></div>
                </div>
              )}

              {/* Special Quiz Card for Haskell Functor / Jokes / Riddles logic */}
              {deck.quizQuestion && (
                <div className="p-8 flex-1 flex flex-col justify-between" onClick={(e) => e.stopPropagation()}>
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-5">
                      <Badge variant="default" className="text-[10px]">
                        {deck.category}
                      </Badge>
                      {!isSingle && (
                        <Badge variant="outline" className="text-[10px]">
                          {currentStep === 0 ? "SECURED" : "DECRYPTED"}
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-base md:text-lg font-bold text-white mb-2.5 tracking-tight">{deck.title}</h3>
                    {deck.description && (
                      <p className="text-[13px] text-zinc-300 leading-relaxed mb-5">
                        {deck.description}
                      </p>
                    )}
                    
                    {/* Interactive Quiz element */}
                    <div className="grid w-full mb-6">
                      <div className={`col-start-1 row-start-1 transition-opacity duration-300 ${isFullyRevealed ? "opacity-100 relative z-10" : "opacity-0 pointer-events-none"}`}>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 bg-[#0c0c0c] p-4 border border-[#1A1A1A] rounded-xs">
                            <HelpCircle className="w-4 h-4 text-white flex-shrink-0" />
                            <p className="text-xs italic text-zinc-300">{deck.quizQuestion}</p>
                          </div>

                          {deck.quizAnswerOptions && deck.quizAnswerOptions.map((opt, idx) => {
                            const isFirstOption = idx === 0;
                            const isSelected = userFunctorAnswer === isFirstOption;
                            return (
                              <button
                                key={idx}
                                onClick={() => setUserFunctorAnswer(isFirstOption)}
                                className={`w-full flex items-center justify-between text-left p-3.5 border rounded-xs transition-all text-xs cursor-pointer ${
                                  isSelected
                                    ? isFirstOption
                                      ? "bg-white text-black border-white font-bold"
                                      : "bg-[#111111] border-white text-white font-bold"
                                    : "bg-[#0e0e0e] border-[#1a1a1a] text-on-surface-variant hover:border-white/25"
                                }`}
                              >
                                <span>{opt}</span>
                                {isSelected && isFirstOption && <CheckCircle className="w-3.5 h-3.5 text-black" />}
                              </button>
                            );
                          })}
                          
                          {userFunctorAnswer !== null && (
                            <p className="text-[10px] font-mono text-white text-center mt-1 font-bold">
                              {userFunctorAnswer ? "✓ Correct decryption" : "✗ Incorrect payload"}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className={`col-start-1 row-start-1 z-20 flex flex-col justify-center transition-opacity duration-300 ${isFullyRevealed ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                        <div className="py-12 border border-dashed border-zinc-800 rounded bg-zinc-950/20 text-center flex flex-col items-center justify-center space-y-3 h-full w-full">
                          <HelpCircle className="w-5 h-5 text-zinc-650 animate-pulse" />
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-semibold block">
                            [ SECURED CHALLENGE INTEL ]
                          </span>
                          <p className="text-[9px] font-mono text-zinc-600 uppercase">Click card to decrypt challenge details</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {renderTags(deck)}

                  <div className="pt-4 border-t border-zinc-900/40 flex flex-col sm:flex-row gap-4 justify-between items-center text-zinc-500 text-[10px] font-mono uppercase tracking-wider mt-5">
                    <span>Progress: {currentStep}/{maxSteps}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStudyDeck(deck.title);
                        }}
                        variant="primary"
                        size="sm"
                        className="text-[9px] tracking-widest flex gap-1"
                      >
                        <Terminal className="w-3 h-3" /> STUDY CONCEPT
                      </Button>
                      {currentStep === 0 ? (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNextStep(deck.id, maxSteps);
                          }}
                          variant="secondary"
                          size="sm"
                          className="bg-zinc-900 hover:bg-zinc-800 border-zinc-800"
                        >
                          💡 CHALLENGE
                        </Button>
                      ) : (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNextStep(deck.id, maxSteps);
                          }}
                          variant="secondary"
                          size="sm"
                          className="bg-zinc-950 hover:bg-zinc-900 border-zinc-900 text-zinc-600"
                        >
                          ↩ HIDE
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Plain text quote format from Screens */}
              {deck.plainQuoteStyle && (
                <div className="p-8 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="aspect-[4/3] bg-[#0e0e0e] border border-[#1A1A1A]/50 mb-5 flex flex-col justify-center items-center p-8 text-center rounded-xs">
                      <p className="text-sm md:text-base italic font-light leading-relaxed text-zinc-200">
                        {deck.plainQuoteStyle}
                      </p>
                      <span className="text-[11px] font-mono text-white opacity-50 uppercase tracking-widest mt-4 block">
                        Wittgenstein
                      </span>
                    </div>
                    <h3 className="text-base md:text-lg font-bold text-white mb-1">{deck.title}</h3>
                    <p className="text-xs font-mono text-zinc-400">Philosophy of Language</p>
                  </div>
                  {renderTags(deck)}
                  <div className="pt-4 border-t border-[#1A1A1A]/50 flex justify-between items-center mt-5">
                    <span className="text-[10px] font-mono text-zinc-500">{deck.creator}</span>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStudyDeck(deck.title);
                      }}
                      variant="primary"
                      size="sm"
                      className="text-[9px] tracking-widest flex gap-1"
                    >
                      <Terminal className="w-3 h-3" /> STUDY CONCEPT
                    </Button>
                  </div>
                </div>
              )}

              {/* Graphic baseline swiss design block layout */}
              {deck.visualMock === "grid" && (
                <div className="p-8 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div className="h-24 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xs flex items-center justify-center">
                        <span className="font-mono text-[11px] text-[#adc6ff]/40">8px GRID</span>
                      </div>
                      <div className="h-24 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xs flex items-center justify-center">
                        <span className="font-mono text-[11px] text-[#adc6ff]/40">MODULAR</span>
                      </div>
                    </div>
                    <h3 className="text-base md:text-lg font-bold text-white mb-2">{deck.title}</h3>
                    <p className="text-[13px] text-zinc-300 mb-5">{deck.description}</p>
                  </div>
                  
                  {renderTags(deck)}

                  <div className="flex justify-between items-center pt-4 border-t border-[#1A1A1A]/50 mt-5">
                    <span className="text-[10px] font-mono text-zinc-500">{deck.creator}</span>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStudyDeck(deck.title);
                      }}
                      variant="primary"
                      size="sm"
                      className="text-[9px] tracking-widest flex gap-1"
                    >
                      <Terminal className="w-3 h-3" /> STUDY CONCEPT
                    </Button>
                  </div>
                </div>
              )}

              {/* Standard card rendering details details */}
              {!deck.quizQuestion && !deck.plainQuoteStyle && deck.visualMock !== "grid" && (
                <div className="p-8 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="default" className="text-[10px] px-2 py-0.5 bg-white/5 border-white/20">
                        {deck.category}
                      </Badge>
                      {deck.cardCountLabel && (
                        <span className="text-xs font-mono text-zinc-400">
                          {deck.cardCountLabel}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base md:text-xl font-extrabold text-white mb-3 tracking-tight">{deck.title}</h3>
                    <p className="text-[13px] md:text-sm text-zinc-300 leading-relaxed mb-6 font-light">
                      {deck.description}
                    </p>

                    {deck.isPopular && (
                      <div className="bg-[#111111] p-4 border border-[#1A1A1A] rounded-xs mb-3">
                        <div className="flex justify-between text-[11px] font-mono text-zinc-400 mb-1.5">
                          <span>Progress Mastery</span>
                          <span className="text-white">68%</span>
                        </div>
                        <div className="w-full h-1 bg-[#1c1b1b] rounded-xs overflow-hidden">
                          <div className="bg-white h-full" style={{ width: "68%" }}></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {renderTags(deck)}

                  <div className="flex items-center justify-between pt-5 mt-8 border-t border-[#1A1A1A]/40 relative" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10.5px] font-mono text-zinc-400 font-medium">{deck.creator}</span>
                    <div className="flex items-center gap-2.5 relative">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStudyDeck(deck.title);
                        }}
                        variant="primary"
                        size="sm"
                        className="animate-pulse flex gap-1.5"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        STUDY NOW
                      </Button>

                      {savedFeedback[deck.id] ? (
                        <Badge variant="success" className="animated pulse flex gap-1.5">
                          <Check className="w-3 h-3 text-green-400" />
                          <span>Added to {savedFeedback[deck.id]}</span>
                        </Badge>
                      ) : (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSaveDeckItemId(activeSaveDeckItemId === deck.id ? null : deck.id);
                          }}
                          variant={activeSaveDeckItemId === deck.id ? "primary" : "secondary"}
                          size="sm"
                          className="flex gap-1.5"
                        >
                          <FolderPlus className={`w-3.5 h-3.5 ${activeSaveDeckItemId === deck.id ? "text-black" : "text-white"}`} />
                          <span className="font-mono uppercase tracking-wider">Add to Deck</span>
                        </Button>
                      )}

                      {activeSaveDeckItemId === deck.id && (
                        <>
                          {/* Global click-outside overlay */}
                          <div
                            className="fixed inset-0 z-30 cursor-default"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSaveDeckItemId(null);
                            }}
                          />

                          <div className="absolute right-0 bottom-10 bg-surface-container-lowest border border-[#1a1a1a] rounded-md p-3.5 z-40 shadow-2xl min-w-[220px] text-left">
                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#222222]">
                              <p className="text-[10px] font-sans text-on-surface uppercase tracking-wider font-semibold">
                                SAVE TO PERSONAL DECK
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveSaveDeckItemId(null);
                                }}
                                className="text-zinc-400 hover:text-white transition-colors p-0.5 rounded cursor-pointer"
                                title="Close"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="space-y-1 max-h-[120px] overflow-y-auto scrollbar-none">
                              {decks.map(userDeck => {
                                const isSavedInThisDeck = userDeck.cards?.some((c: any) => c.answer === deck.description);
                                return (
                                  <button
                                    key={userDeck.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isSavedInThisDeck) {
                                        onRemoveCardFromDeck(deck.title, deck.description, userDeck.id);
                                        setSavedFeedback({ ...savedFeedback, [deck.id]: `Removed` });
                                      } else {
                                        onSaveCardToDeck(deck.title, deck.description, userDeck.id);
                                        setSavedFeedback({ ...savedFeedback, [deck.id]: `Saved` });
                                      }
                                      setTimeout(() => {
                                        setSavedFeedback(prev => {
                                          const next = { ...prev };
                                          delete next[deck.id];
                                          return next;
                                        });
                                      }, 2000);
                                    }}
                                    className="w-full text-left px-2 py-1.5 text-xs font-sans text-on-surface hover:text-white hover:bg-[#1a1a1a] rounded transition-colors flex items-center justify-between cursor-pointer"
                                  >
                                    <span className="truncate max-w-[150px]">{userDeck.title}</span>
                                    {isSavedInThisDeck ? (
                                      <span className="flex items-center justify-center w-4 h-4 rounded-sm bg-white/20 border border-white text-white">
                                        <Check className="w-2.5 h-2.5" />
                                      </span>
                                    ) : (
                                      <span className="w-4 h-4 rounded-sm border border-zinc-800" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Inline custom deck creator */}
                            <div className="border-t border-[#121212] mt-2.5 pt-2.5">
                              <p className="text-[10px] font-sans text-zinc-400 uppercase tracking-wider mb-1.5">
                                or save to a new deck
                              </p>
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!newDeckTitle.trim()) return;
                                  onSaveToNewDeck(deck.title, deck.description, newDeckTitle.trim());
                                  setSavedFeedback({ ...savedFeedback, [deck.id]: newDeckTitle.trim() });
                                  setNewDeckTitle("");
                                  setActiveSaveDeckItemId(null);
                                  setTimeout(() => {
                                    setSavedFeedback(prev => {
                                      const next = { ...prev };
                                      delete next[deck.id];
                                      return next;
                                    });
                                  }, 3000);
                                }}
                                className="flex gap-1.5"
                              >
                                <Input
                                  type="text"
                                  placeholder="New Deck name..."
                                  value={newDeckTitle}
                                  onChange={(e) => setNewDeckTitle(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="bg-black border-zinc-800 focus:border-zinc-700 text-left"
                                />
                                <Button
                                  type="submit"
                                  onClick={(e) => e.stopPropagation()}
                                  variant="primary"
                                  size="sm"
                                  className="px-2.5 py-1"
                                >
                                  +
                                </Button>
                              </form>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {/* Decrypt Load More Indicator */}
      <div className="mt-16 flex flex-col items-center gap-4">
        <div className="w-px h-12 bg-white/20"></div>
        <Button
          onClick={handleDecryptMore}
          disabled={isDecrypting}
          variant="ghost"
          className="text-[11px] gap-2"
        >
          {isDecrypting ? (
            <span>DECRYPTING WORK BENCH REPOSITORIES...</span>
          ) : hasDecrypted ? (
            <span>REPOSITORIES FULLY SYNCD</span>
          ) : (
            <>
              <Unlock className="w-3.5 h-3.5" />
              <span>DECRYPT MORE DATA</span>
            </>
          )}
        </Button>
      </div>

    </div>
  );
}
