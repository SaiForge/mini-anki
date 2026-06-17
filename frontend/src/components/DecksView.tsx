import React, { useState } from "react";
import { 
  Plus, 
  Terminal, 
  Flame, 
  Hourglass, 
  Trophy, 
  Database, 
  ShieldCheck,
  BookOpen,
  Brain,
  HelpCircle,
  Trash2,
  Loader2
} from "lucide-react";
import { StudyDeck, StudyStats } from "../types";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { DeckPublisher, DeckFormData } from "./DeckPublisher";
import { createDeck, mapApiDeckToStudyDeck, saveDeckMeta } from "../api/deckApi";

interface DecksViewProps {
  decks: StudyDeck[];
  stats: StudyStats;
  onStudyDeck: (deckName: string) => void;
  onAddNewDeck: (deck: StudyDeck) => void;
  onDeleteDeck: (deckId: string) => Promise<void>;
  onAddNewCardClick?: () => void;
  decksLoading?: boolean;

  searchQuery: string;
  isDarkMode?: boolean;
}

export default function DecksView({
  decks,
  stats,
  onStudyDeck,
  onAddNewDeck,
  onDeleteDeck,
  onAddNewCardClick,
  decksLoading = false,
  searchQuery,
  isDarkMode = true
}: DecksViewProps) {
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredDecks = decks.filter((deck) => {
    return (
      deck.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deck.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deck.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleCreateDeck = async (data: DeckFormData) => {
    const tagsArray = data.dTagsString
      .split(/[\s,]+/)
      .map(tag => tag.trim().replace(/^#/, ""))
      .filter(tag => tag.length > 0);

    setCreating(true);
    try {
      // 1. Create deck in the backend (generates real UUID)
      const apiDeck = await createDeck(data.dTitle);

      // 2. Save UI-only metadata to localStorage, keyed by real UUID
      const meta = {
        category: data.dCategory.toUpperCase(),
        description: data.dDescription,
        iconType: data.dIcon,
        isPrivate: data.dPrivate,
        progress: 0,
        tags: tagsArray.length > 0 ? tagsArray : [],
      };
      saveDeckMeta(apiDeck.deck_id, meta);

      // 3. Map to StudyDeck and pass up to parent state
      const created = mapApiDeckToStudyDeck(apiDeck, meta);
      onAddNewDeck(created);
      setShowAddForm(false);
    } catch (err) {
      console.error("Failed to create deck:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 lg:px-8 py-8 space-y-12 pb-32">
      {/* Upper Repository Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#1A1A1A]">
        <div>
          <span className="text-[10px] font-mono text-white uppercase tracking-[0.25em] mb-2 block font-semibold">
            Private Repository
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans">
            Study Decks
          </h1>
        </div>
        
        {/* Actions Row */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => onAddNewCardClick?.()}
            variant="outline"
            className="flex items-center gap-2 border-[#1A1A1A] hover:border-white text-on-surface hover:bg-neutral-900/35"
          >
            <Plus className="w-4 h-4" />
            <span>New Card</span>
          </Button>
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Deck</span>
          </Button>
        </div>
      </div>

      {/* Inline interactive deck customizer creator */}
      {showAddForm && (
        <DeckPublisher 
          onClose={() => setShowAddForm(false)} 
          onPublish={handleCreateDeck} 
          isDarkMode={isDarkMode} 
        />
      )}

      {/* Centered Study Tracks with hairline rows layout */}
      <div className="border border-[#1A1A1A] rounded-lg shadow-sm overflow-hidden divide-y divide-[#1A1A1A]">
        {decksLoading ? (
          // Loading skeleton
          [0, 1, 2].map(i => (
            <div key={i} className="flex items-center justify-between p-6 animate-pulse">
              <div className="flex items-center gap-5 flex-1">
                <div className="w-11 h-11 rounded-xs bg-neutral-900" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-neutral-800 rounded w-40" />
                  <div className="h-2 bg-neutral-900 rounded w-64" />
                </div>
              </div>
              <div className="h-8 w-20 bg-neutral-800 rounded-xs" />
            </div>
          ))
        ) : filteredDecks.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-xs font-mono text-on-surface-variant/40 uppercase tracking-widest">No decks found. Create your first deck above.</p>
          </div>
        ) : filteredDecks.map((deck) => {
          // Resolve correct icon styles
          const renderIcon = () => {
            switch (deck.iconType) {
              case "terminal":
                return <Terminal className="w-5 h-5 text-white" />;
              case "database":
                return <Database className="w-5 h-5 text-on-surface-variant group-hover:text-white transition-colors" />;
              case "security":
                return <ShieldCheck className="w-5 h-5 text-on-surface-variant group-hover:text-white transition-colors" />;
              case "brain":
                return <Brain className="w-5 h-5 text-pink-400 group-hover:text-pink-300 transition-colors" />;
              case "science":
                return <HelpCircle className="w-5 h-5 text-yellow-400 group-hover:text-yellow-300 transition-colors" />;
              default:
                return <BookOpen className="w-5 h-5 text-on-surface-variant group-hover:text-white transition-colors" />;
            }
          };

          const isSystemsActive = deck.active || deck.title.toLowerCase().includes("systems");

          return (
            <div
              key={deck.id}
              className={`group flex flex-col md:flex-row items-stretch md:items-center justify-between p-6 transition-all duration-200 ${
                isSystemsActive ? "bg-surface-container-lowest/70" : "bg-black hover:bg-neutral-900/35"
              }`}
            >
              <div className="flex items-center gap-5 flex-1 mb-4 md:mb-0">
                {/* Visual Icon card housing */}
                <div className="w-11 h-11 flex items-center justify-center border border-[#1A1A1A] bg-black rounded-xs">
                  {renderIcon()}
                </div>
                
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-sans font-bold text-sm text-white group-hover:text-white transition-colors">
                      {deck.title}
                    </h3>
                    {isSystemsActive && (
                      <Badge variant="default" className="text-[9px] px-2 py-0.5">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed max-w-xl">
                    {deck.description}
                  </p>
                </div>
              </div>

              {/* Progress metrics and CTA segment */}
              <div className="flex items-center gap-4 sm:gap-8 justify-between md:justify-end">
                {/* Horizontal progress bar details */}
                <div className="hidden sm:block">
                  <span className="text-[9px] font-mono text-on-surface-variant/50 uppercase tracking-widest block mb-1">
                    Progress
                  </span>
                  <div className="w-28 h-1 bg-surface-container-highest rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${isSystemsActive ? "bg-white" : "bg-on-surface-variant/30"}`} 
                      style={{ width: `${deck.progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Card count tag */}
                <div className="text-right">
                  <span className="text-[9px] font-mono text-on-surface-variant/40 uppercase tracking-widest block">
                    Cards
                  </span>
                  <span className="text-xs font-mono font-bold text-white">
                    {deck.cardCount.toLocaleString()}
                  </span>
                </div>

                {/* Primary dynamic CTA action button based on specs */}
                {deck.cardCount > 0 ? (
                  <Button
                    onClick={() => onStudyDeck(deck.title)}
                    variant="primary"
                    className="active:scale-95"
                  >
                    Study Now
                  </Button>
                ) : (
                  <Button
                    onClick={() => onStudyDeck(deck.title)}
                    variant="outline"
                    className="border-outline-variant hover:border-white text-on-surface hover:bg-neutral-900"
                  >
                    Review
                  </Button>
                )}

                {/* Delete button — hidden for default deck (📚 Today's Review) */}
                {!deck.title.includes("Today's Review") && (
                  <button
                    onClick={async () => {
                      setDeletingId(deck.id);
                      await onDeleteDeck(deck.id);
                      setDeletingId(null);
                    }}
                    disabled={deletingId === deck.id}
                    title="Delete this deck"
                    className="p-2 text-on-surface-variant/40 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {deletingId === deck.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>



      {/* Grid Pattern Background subtle indicator line */}
      <div className="absolute inset-0 -z-10 opacity-15 pointer-events-none">
        <div 
          className="absolute inset-0" 
          style={{ 
            backgroundImage: "radial-gradient(circle at 50% 50%, #1A1A1A 1px, transparent 1px)", 
            backgroundSize: "24px 24px" 
          }}
        ></div>
      </div>
    </div>
  );
}
