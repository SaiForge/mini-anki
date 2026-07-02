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
  MoreVertical
} from "lucide-react";
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
  isDarkMode = true
}: DecksViewProps) {
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
        className="relative group flex flex-col md:flex-row items-center justify-between px-6 pt-6 pb-8 md:pb-7 bg-[#0c0c0c] hover:bg-[#131313] rounded-lg transition-colors duration-200"
      >
        {/* Padded Progress Bar */}
        <div className="absolute bottom-3 left-6 right-6 h-[3px] bg-black/10 dark:bg-white/5 rounded-full overflow-hidden z-0">
          <div 
            className="absolute top-0 bottom-0 left-0 bg-[var(--theme-primary)] transition-all duration-500 ease-out" 
            style={{ width: `${deck.progress || 0}%` }} 
          />
        </div>
        <div className="flex items-center gap-5 flex-1 mb-4 md:mb-0 w-full md:w-auto z-10">
          {/* Action square */}
          <div className="w-11 h-11 flex items-center justify-center bg-black/5 dark:bg-white/5 rounded shrink-0 text-on-surface hover:text-white cursor-pointer transition-colors">
            <span className="font-mono text-sm font-bold">{'>_'}</span>
          </div>

          <div className="space-y-1">
            <h3 
              onClick={() => onStudyDeck(deck.title, deck.id, true)}
              className="font-sans font-bold text-base text-white flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            >
              {deck.title.replace(/📚\s*/g, '')}
            </h3>
            <p className="text-[11px] text-on-surface-variant leading-relaxed max-w-xl">
              {deck.description || deck.category?.toLowerCase()}
            </p>
          </div>
        </div>

        {/* Progress metrics and CTA segment */}
        <div className="flex items-center gap-6 justify-between md:justify-end w-full md:w-auto">
          {/* Card count tag */}
          <div className="text-right shrink-0 flex flex-col items-center justify-center">
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
              PRS
            </Button>
          ) : (deck.isPublic || publishStatus[deck.id]) ? (
            <Button
              onClick={() => setViewingPRsFor(deck.id)}
              variant="ghost"
              className="text-on-surface-variant hover:text-white px-2"
              title="View Contributions"
            >
              <GitPullRequest className="w-4 h-4 mr-1.5" />
              PRS
            </Button>
          ) : null}

          {/* Primary dynamic CTA action button */}
          {deck.cardCount > 0 && deck.progress < 100 ? (
            <Button
              onClick={() => onStudyDeck(deck.title)}
              className="bg-[var(--theme-primary)] text-[var(--theme-on-primary)] hover:opacity-90 active:scale-95 whitespace-nowrap rounded font-mono text-xs tracking-wider px-5 py-2.5 h-auto border-none"
            >
              STUDY NOW
            </Button>
          ) : (
            <Button
              onClick={() => onStudyDeck(deck.title)}
              variant="outline"
              className="border-[#1A1A1A] hover:bg-neutral-900 text-on-surface whitespace-nowrap rounded font-mono text-xs tracking-wider px-5 py-2.5 h-auto"
            >
              REVIEW
            </Button>
          )}

          {/* Menu button */}
          <div className="w-6 flex justify-end">
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
        </div>
      </div>
    );
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
            <div className="p-12 text-center bg-[#0c0c0c] rounded-xl">
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
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2 font-sans tracking-tight">Delete Deck</h3>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Are you sure you want to delete <span className="text-white font-semibold">{confirmDeleteDeck.title}</span>? This action cannot be undone and you will lose all cards in this deck.
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
