// frontend/src/api/deckApi.ts
import { axiosClient } from "./axiosClient";
import { StudyDeck } from "../types";

// ─── API Response Types ────────────────────────────────────────────────────

export interface ApiDeck {
  deck_id: string;
  title: string;
  created_at: string;
  is_default: number;
  card_count: number;
  is_public?: boolean;
  description?: string;
  category?: string;
  tags?: string[];
  fork_count?: number;
  like_count?: number;
  original_deck_id?: string;
  has_changes?: boolean;
}

export interface ApiCard {
  card_id: string;
  deck_id: string;
  front_text: string;
  back_text: string;
  created_at: string;
}

// ─── localStorage metadata ─────────────────────────────────────────────────
// Since the backend Deck model has no category/description/icon, we persist
// those UI-only fields locally, keyed by deck_id.

export interface DeckLocalMeta {
  category: string;
  description: string;
  iconType: StudyDeck["iconType"];
  isPrivate: boolean;
  progress: number;
  tags?: string[];
}

export function saveDeckMeta(deckId: string, meta: DeckLocalMeta): void {
  localStorage.setItem(`deck_meta_${deckId}`, JSON.stringify(meta));
}

export function loadDeckMeta(deckId: string): DeckLocalMeta | null {
  const raw = localStorage.getItem(`deck_meta_${deckId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeckLocalMeta;
  } catch {
    return null;
  }
}

export function deleteDeckMeta(deckId: string): void {
  localStorage.removeItem(`deck_meta_${deckId}`);
}

// ─── Map API → StudyDeck ───────────────────────────────────────────────────

export function mapApiDeckToStudyDeck(
  apiDeck: ApiDeck,
  overrideMeta?: Partial<DeckLocalMeta>
): StudyDeck {
  const stored = loadDeckMeta(apiDeck.deck_id);
  const meta: DeckLocalMeta = {
    category: apiDeck.category ?? overrideMeta?.category ?? stored?.category ?? "GENERAL",
    description: apiDeck.description ?? overrideMeta?.description ?? stored?.description ?? "",
    iconType: overrideMeta?.iconType ?? stored?.iconType ?? "terminal",
    isPrivate: overrideMeta?.isPrivate ?? stored?.isPrivate ?? false,
    progress: overrideMeta?.progress ?? stored?.progress ?? 0,
    tags: overrideMeta?.tags ?? stored?.tags ?? [],
  };

  // Persist so future loads have this info
  if (overrideMeta) {
    saveDeckMeta(apiDeck.deck_id, meta);
  }

  return {
    id: apiDeck.deck_id,
    title: apiDeck.title,
    category: meta.category,
    description: meta.description,
    iconType: meta.iconType,
    isPrivate: meta.isPrivate,
    isPublic: apiDeck.is_public ?? false,
    progress: meta.progress,
    cardCount: apiDeck.card_count,
    tags: meta.tags,
    originalDeckId: apiDeck.original_deck_id,
    hasChanges: apiDeck.has_changes,
    cards: [], // Cards are loaded separately during study session
  };
}

// ─── API Calls ─────────────────────────────────────────────────────────────

export async function getDecks(): Promise<ApiDeck[]> {
  const { data } = await axiosClient.get<ApiDeck[]>("/api/decks/");
  return data;
}

export async function getPublicUserDecks(userId: string): Promise<ApiDeck[]> {
  const { data } = await axiosClient.get<ApiDeck[]>(`/api/decks/user/${userId}/public`);
  return data;
}

export async function createDeck(
  title: string,
  description?: string,
  category?: string,
  is_public?: boolean,
  tags?: string[]
): Promise<ApiDeck> {
  const { data } = await axiosClient.post<ApiDeck>("/api/decks/", { 
    title,
    description,
    category,
    tags,
    is_public
  });
  return data;
}

export async function deleteDeck(deckId: string): Promise<void> {
  await axiosClient.delete(`/api/decks/${deckId}`);
  deleteDeckMeta(deckId);
}

export async function createCard(
  deckId: string,
  front_text: string,
  back_text: string
): Promise<ApiCard> {
  const { data } = await axiosClient.post<ApiCard>(
    `/api/decks/${deckId}/cards`,
    { front_text, back_text }
  );
  return data;
}

export async function deleteCard(deckId: string, cardId: string): Promise<void> {
  await axiosClient.delete(`/api/decks/${deckId}/cards/${cardId}`);
}

export async function getDeckCards(deckId: string): Promise<ApiCard[]> {
  const { data } = await axiosClient.get<ApiCard[]>(`/api/decks/${deckId}/cards`);
  return data;
}
