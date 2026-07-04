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
  Loader2,
  Globe,
  Lock,
  MoreVertical,
  Search,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StudyDeck, StudyStats } from "../types";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { DeckPublisher, DeckFormData } from "./DeckPublisher";
import { createDeck, mapApiDeckToStudyDeck, saveDeckMeta } from "../api/deckApi";
import { publishDeck, unpublishDeck, updateDeckMeta } from "../api/exploreApi";
import { PublishDeckModal } from "./PublishDeckModal";
import { PullRequestModal } from "./PullRequestModal";
import { SubmitPRModal } from "./SubmitPRModal";
import { GitPullRequest } from "lucide-react";

interface DecksViewProps {
  decks: StudyDeck[];
  stats: StudyStats;
  onStudyDeck: (deckName: string, deckId?: string, openInBrowseMode?: boolean) => void;
  onAddNewDeck: (deck: StudyDeck) => void;
  onDeleteDeck: (deckId: string) => Promise<void>;
  onAddNewCardClick?: () => void;
  decksLoading?: boolean;
  onRefreshDecks?: () => void;

  searchQuery: string;
  setSearchQuery?: (q: string) => void;
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
  onRefreshDecks,
  searchQuery,
  setSearchQuery,
  isDarkMode = true
}: DecksViewProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<Record<string, boolean>>({});
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishingDeck, setPublishingDeck] = useState<StudyDeck | null>(null);

  const [viewingPRsFor, setViewingPRsFor] = useState<string | null>(null);
  const [submittingPRFor, setSubmittingPRFor] = useState<string | null>(null);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDeleteDeck, setConfirmDeleteDeck] = useState<StudyDeck | null>(null);

  const filteredDecks = decks.filter((deck) => {
    return (
      deck.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deck.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deck.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const defaultDecks = filteredDecks.filter(deck => deck.title.includes("Today's Review"));
  const customDecks = filteredDecks.filter(deck => !deck.title.includes("Today's Review"));

  const handleCreateDeck = async (data: DeckFormData) => {
    const tagsArray = data.dTagsString
      .split(/[\s,]+/)
      .map(tag => tag.trim().replace(/^#/, ""))
      .filter(tag => tag.length > 0);

    setCreating(true);
    try {
      // 1. Create deck in the backend (generates real UUID)
      const apiDeck = await createDeck(
        data.dTitle,
        data.dDescription,
        data.dCategory,
        !data.dPrivate,
        tagsArray.length > 0 ? tagsArray : undefined
      );

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

  const renderDeckRow = (deck: StudyDeck) => {
    return (
      <div
        key={deck.id}
        className="relative group flex flex-col md:flex-row items-start md:items-center justify-between px-5 pt-4 pb-7 md:px-6 md:pb-5 bg-[#0c0c0c] hover:bg-[#131313] rounded-lg transition-colors duration-200"
      >
        {/* Menu button at top right */}
        <div className="absolute top-4 right-4 z-20 flex justify-end">
          {!deck.title.includes("Today's Review") ? (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === deck.id ? null : deck.id);
                }}
                className="p-1 text-on-surface-variant/40 hover:text-white transition-colors cursor-pointer rounded"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {openMenuId === deck.id && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}
                  />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-surface-container-lowest border border-outline-variant/30 rounded shadow-xl overflow-hidden z-20 flex flex-col py-1">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        const isCurrentlyPublic = publishStatus[deck.id] ?? deck.isPublic;
                        if (isCurrentlyPublic) {
                          setPublishingId(deck.id);
                          try {
                            await unpublishDeck(deck.id);
                            setPublishStatus(prev => ({ ...prev, [deck.id]: false }));
                          } catch (err) {
                            console.error("Failed to unpublish", err);
                          } finally {
                            setPublishingId(null);
                          }
                        } else {
                          setPublishingDeck(deck);
                        }
                      }}
                      disabled={publishingId === deck.id}
                      className="px-4 py-2.5 text-left text-[11px] font-mono tracking-wider text-on-surface hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors"
                    >
                      {publishingId === deck.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : (publishStatus[deck.id] ?? deck.isPublic)
                          ? <Lock className="w-4 h-4" />
                          : <Globe className="w-4 h-4" />}
                      {(publishStatus[deck.id] ?? deck.isPublic) ? "MAKE PRIVATE" : "PUBLISH DECK"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        setConfirmDeleteDeck(deck);
                      }}
                      className="px-4 py-2.5 text-left text-[11px] font-mono tracking-wider text-red-500 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      DELETE DECK
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>

        {/* Padded Progress Bar */}
        <div className="absolute bottom-3 left-6 right-6 h-[3px] bg-black/10 dark:bg-white/5 rounded-full overflow-hidden z-0">
          <div 
            className="absolute top-0 bottom-0 left-0 bg-[var(--theme-primary)] transition-all duration-500 ease-out" 
            style={{ width: `${deck.progress || 0}%` }} 
          />
        </div>
        <div className="flex items-center gap-5 flex-1 mb-4 md:mb-0 w-full md:w-auto z-10 pr-6 min-w-0">
          {/* Action square */}
          <div className="w-11 h-11 flex items-center justify-center bg-black/5 dark:bg-white/5 rounded shrink-0 text-on-surface hover:text-white cursor-pointer transition-colors">
            <span className="font-mono text-sm font-bold">{'>_'}</span>
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <h3 
              onClick={() => onStudyDeck(deck.title, deck.id, true)}
              className="font-sans font-bold text-lg text-white flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity truncate"
            >
              {deck.title.replace(/📚\s*/g, '')}
            </h3>
            <p className="text-[11px] text-on-surface-variant leading-relaxed line-clamp-1 md:line-clamp-2 break-all whitespace-normal">
              {deck.description || deck.category?.toLowerCase()}
            </p>
          </div>
        </div>

        {/* Progress metrics and CTA segment */}
        <div className="flex items-center gap-3 sm:gap-6 justify-between md:justify-end w-full md:w-auto mt-2 md:mt-0">
          {/* Card count tag */}
          <div className="text-center shrink-0 flex flex-col items-center justify-center">
            <span className="text-[9px] font-mono text-on-surface-variant/50 uppercase tracking-widest block mb-0.5">
              Cards
            </span>
            <span className="text-sm font-mono font-bold text-white">
              {deck.cardCount.toLocaleString()}
            </span>
          </div>

          {/* PR Actions */}
          {deck.originalDeckId && deck.hasChanges ? (
            <Button
              onClick={() => setSubmittingPRFor(deck.id)}
              variant="ghost"
              className="text-on-surface-variant hover:text-white px-2"
              title="Submit changes to original deck"
            >
              <GitPullRequest className="w-4 h-4 mr-1.5" />
              PRS {deck.prCount ? `(${deck.prCount})` : ""}
            </Button>
          ) : (deck.isPublic || publishStatus[deck.id]) ? (
            <Button
              onClick={() => setViewingPRsFor(deck.id)}
              variant="ghost"
              className="text-on-surface-variant hover:text-white px-2"
              title="View Contributions"
            >
              <GitPullRequest className="w-4 h-4 mr-1.5" />
              PRS {deck.prCount ? `(${deck.prCount})` : ""}
            </Button>
          ) : null}

          {/* Primary dynamic CTA action button */}
          {deck.cardCount > 0 && deck.progress < 100 ? (
            <Button
              onClick={() => onStudyDeck(deck.title)}
              className="bg-[var(--theme-primary)] text-[var(--theme-on-primary)] hover:opacity-90 active:scale-95 whitespace-nowrap rounded font-mono text-xs tracking-wider px-4 sm:px-5 py-2 h-auto border-none shrink-0"
            >
              STUDY NOW
            </Button>
          ) : (
            <Button
              onClick={() => onStudyDeck(deck.title)}
              variant="outline"
              className="border-[#1A1A1A] hover:bg-neutral-900 text-on-surface whitespace-nowrap rounded font-mono text-xs tracking-wider px-4 sm:px-5 py-2 h-auto shrink-0"
            >
              REVIEW
            </Button>
          )}

        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[640px] mx-auto px-4 md:px-0 pt-2 pb-8 space-y-8 pb-32">
      {/* Upper Repository Title & Controls */}
      <div className="flex flex-col pb-6 border-b border-[#1A1A1A]">
        {/* Top row: Title (left) & Search Toggle (top right) */}
        <div className="flex justify-between items-start mb-2">
          <div>
            <span className="text-[10px] font-mono text-white uppercase tracking-[0.25em] mb-2 block font-semibold">
              Private Repository
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-sans">
              Study Decks
            </h1>
          </div>
          
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              if (showSearch && setSearchQuery) setSearchQuery("");
            }}
            className={`w-11 h-11 flex items-center justify-center rounded-full transition-colors cursor-pointer ${showSearch ? (isDarkMode ? "bg-white/[0.06]" : "bg-[#22223b]/[0.06]") : (isDarkMode ? "hover:bg-white/5" : "hover:bg-[#22223b]/5")} ${isDarkMode ? "text-zinc-500 hover:text-zinc-100" : "text-[#4a4e69] hover:text-[#22223b]"}`}
          >
            {showSearch ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>
        </div>

        {/* Search Bar immediately below title */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 16 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              className="overflow-hidden w-full mb-2"
            >
              <div className={`flex items-center rounded-xl px-3 py-2 transition-all ${isDarkMode ? "bg-white/5 border border-white/10 text-zinc-100 focus-within:border-white/30" : "bg-[#22223b]/5 border border-[#22223b]/15 text-[#22223b] focus-within:border-[#22223b]/30"}`}>
                <Search className="w-4 h-4 mr-2 opacity-50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery?.(e.target.value)}
                  className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none placeholder:opacity-50"
                  placeholder="Filter study decks..."
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery?.("")} className="ml-2 opacity-50 hover:opacity-100 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions Row at the bottom of the header */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
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

      {/* Study Tracks Sections */}
      <div className="space-y-4">
        {/* Default Decks Section */}
        {defaultDecks.length > 0 && (
          <div className="flex flex-col gap-4">
            {defaultDecks.map(renderDeckRow)}
          </div>
        )}

        {/* Custom Decks Section */}
        <div className="flex flex-col gap-4">
          {decksLoading ? (
            // Loading skeleton
            [0, 1, 2].map(i => (
              <div key={i} className="flex items-center justify-between p-6 bg-[#0c0c0c] rounded-xl animate-pulse">
                <div className="flex items-center gap-5 flex-1">
                  <div className="w-11 h-11 rounded bg-neutral-900" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 bg-neutral-800 rounded w-40" />
                    <div className="h-2 bg-neutral-900 rounded w-64" />
                  </div>
                </div>
                <div className="h-8 w-20 bg-neutral-800 rounded" />
              </div>
            ))
          ) : customDecks.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-xs font-mono text-on-surface-variant/40 uppercase tracking-widest">No decks found. Create your first deck above.</p>
            </div>
          ) : customDecks.map(renderDeckRow)}
        </div>
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

      {publishingDeck && (
        <PublishDeckModal
          deck={publishingDeck}
          isDarkMode={isDarkMode}
          onClose={() => setPublishingDeck(null)}
          onConfirm={async (payload) => {
            try {
              // 1. Update metadata
              await updateDeckMeta(publishingDeck.id, payload);
              // 2. Publish
              await publishDeck(publishingDeck.id);
              setPublishStatus(prev => ({ ...prev, [publishingDeck.id]: true }));
              setPublishingDeck(null);
            } catch (err) {
              console.error("Failed to publish with metadata:", err);
              throw err;
            }
          }}
        />
      )}

      {/* PR Modals */}
      {viewingPRsFor && (
        <PullRequestModal
          deckId={viewingPRsFor}
          isDarkMode={isDarkMode}
          onClose={() => setViewingPRsFor(null)}
          onApproved={() => {
            if (onRefreshDecks) {
              onRefreshDecks();
            }
          }}
        />
      )}

      {submittingPRFor && (
        <SubmitPRModal
          forkedDeckId={submittingPRFor}
          onClose={() => setSubmittingPRFor(null)}
          onSubmitted={() => {
            setSubmittingPRFor(null);
            alert("Pull request submitted successfully!");
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteDeck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-lowest border border-outline-variant rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-on-surface mb-2 font-sans tracking-tight">Delete Deck</h3>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Are you sure you want to delete <span className="text-on-surface font-semibold">{confirmDeleteDeck.title}</span>? This action cannot be undone and you will lose all cards in this deck.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmDeleteDeck(null)} disabled={deletingId === confirmDeleteDeck.id}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={async () => {
                setDeletingId(confirmDeleteDeck.id);
                try {
                  await onDeleteDeck(confirmDeleteDeck.id);
                } finally {
                  setDeletingId(null);
                  setConfirmDeleteDeck(null);
                }
              }} disabled={deletingId === confirmDeleteDeck.id}>
                {deletingId === confirmDeleteDeck.id ? "Deleting..." : "Delete Deck"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
