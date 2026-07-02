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
  onStudyDeck: (deckName: string, deckId?: string) => void;
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
        className={`relative group flex flex-col md:flex-row items-center justify-between p-6 transition-all duration-200 ${isSystemsActive ? "bg-surface-container-lowest/70" : "bg-black hover:bg-neutral-900/35"
          }`}
      >
        {/* Full-width thin progress bar at the top */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/5">
          <div
            className={`h-full transition-all duration-500 ${isSystemsActive ? "bg-white" : "bg-indigo-400 group-hover:bg-indigo-300"}`}
            style={{ width: `${deck.progress || 0}%` }}
          ></div>
        </div>

        <div className="flex items-center gap-5 flex-1 mb-4 md:mb-0 w-full md:w-auto">
          {/* Visual Icon card housing */}
          <div className="w-11 h-11 flex items-center justify-center border border-[#1A1A1A] bg-black rounded-xs shrink-0">
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
        <div className="flex items-center gap-4 sm:gap-8 justify-between md:justify-end w-full md:w-auto">
          {/* Card count tag */}
          <div className="text-right shrink-0">
            <span className="text-[9px] font-mono text-on-surface-variant/40 uppercase tracking-widest block">
              Cards
            </span>
            <span className="text-xs font-mono font-bold text-white">
              {deck.cardCount.toLocaleString()}
            </span>
          </div>

          {/* PR Actions */}
          {deck.originalDeckId && deck.hasChanges ? (
            <Button
              onClick={() => setSubmittingPRFor(deck.id)}
              variant="outline"
              className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 px-3"
              title="Submit changes to original deck"
            >
              <GitPullRequest className="w-4 h-4 mr-1.5" />
              Submit PR
            </Button>
          ) : (deck.isPublic || publishStatus[deck.id]) ? (
            <Button
              onClick={() => setViewingPRsFor(deck.id)}
              variant="ghost"
              className="text-zinc-400 hover:text-white px-3"
              title="View Contributions"
            >
              <GitPullRequest className="w-4 h-4 mr-1.5" />
              PRs
            </Button>
          ) : null}

          {/* Primary dynamic CTA action button based on specs */}
          {deck.cardCount > 0 && deck.progress < 100 ? (
            <Button
              onClick={() => onStudyDeck(deck.title)}
              variant="primary"
              className="active:scale-95 whitespace-nowrap"
            >
              Study Now
            </Button>
          ) : (
            <Button
              onClick={() => onStudyDeck(deck.title)}
              variant="outline"
              className="border-outline-variant hover:border-white text-on-surface hover:bg-neutral-900 whitespace-nowrap"
            >
              Review
            </Button>
          )}

          {/* Menu button — hidden for default deck */}
          {!deck.title.includes("Today's Review") && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === deck.id ? null : deck.id);
                }}
                className="p-2 text-on-surface-variant/40 hover:text-white transition-colors cursor-pointer rounded-md hover:bg-neutral-800/50"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {openMenuId === deck.id && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}
                  />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-[#0a0a0a] border border-[#1A1A1A] rounded-md shadow-lg overflow-hidden z-20 flex flex-col py-1">
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
                      className="px-4 py-2.5 text-left text-[11px] font-mono tracking-wider text-zinc-300 hover:bg-neutral-800 hover:text-white flex items-center gap-3 transition-colors"
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
                      className="px-4 py-2.5 text-left text-[11px] font-mono tracking-wider text-red-500 hover:bg-neutral-800 flex items-center gap-3 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      DELETE DECK
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
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
      <div className="space-y-8">
        {/* Default Decks Section */}
        {defaultDecks.length > 0 && (
          <div className="border border-[#1A1A1A] rounded-lg shadow-sm overflow-hidden divide-y divide-[#1A1A1A]">
            {defaultDecks.map(renderDeckRow)}
          </div>
        )}

        {/* Custom Decks Section */}
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
