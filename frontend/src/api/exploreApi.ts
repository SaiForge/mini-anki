// frontend/src/api/exploreApi.ts
import { axiosClient as API } from "./axiosClient";

export interface PublicDeck {
  deck_id: string;
  title: string;
  description: string | null;
  category: string | null;
  is_public: boolean;
  is_default: number;
  fork_count: number;
  like_count: number;
  card_count: number;
  original_deck_id: string | null;
  created_at: string;
  is_liked: boolean;
  owner_username: string | null;
  owner_id?: string;
  owner_full_name: string | null;
  owner_avatar_url: string | null;
  tags?: string[];
}

export interface BrowseResponse {
  total: number;
  items: PublicDeck[];
}

export interface SearchResponse {
  decks: PublicDeck[];
  posts: {
    post_id: string;
    title: string | null;
    body: string;
    category: string | null;
    created_at: string;
    author_username: string | null;
  }[];
  users: {
    user_id: string;
    username: string | null;
    full_name: string | null;
    bio: string | null;
    profile_picture_url: string | null;
    current_streak: number;
  }[];
}

// Browse public decks with optional filters
export const browseDecks = async (
  params?: { category?: string; q?: string; skip?: number; limit?: number }
): Promise<BrowseResponse> => {
  const res = await API.get("/api/explore/decks", { params });
  return res.data;
};

// Trending decks
export const getTrendingDecks = async (limit = 10): Promise<PublicDeck[]> => {
  const res = await API.get("/api/explore/decks/trending", { params: { limit } });
  return res.data;
};

// Fetch a single public deck by ID
export const getPublicDeck = async (deckId: string): Promise<PublicDeck> => {
  const res = await API.get(`/api/explore/decks/${deckId}`);
  return res.data;
};

// Fetch cards for a public deck
export const getPublicDeckCards = async (deckId: string): Promise<any[]> => {
  const res = await API.get(`/api/explore/decks/${deckId}/cards`);
  return res.data;
};

// Full-text search
export const searchAll = async (q: string, limit = 20): Promise<SearchResponse> => {
  const res = await API.get("/api/explore/search", { params: { q, limit } });
  return res.data;
};

// Publish / unpublish deck
export const publishDeck = async (deckId: string): Promise<void> => {
  await API.post(`/api/decks/${deckId}/publish`);
};

export const unpublishDeck = async (deckId: string): Promise<void> => {
  await API.post(`/api/decks/${deckId}/unpublish`);
};

// Fork a public deck into own library
export const forkDeck = async (deckId: string): Promise<PublicDeck> => {
  const res = await API.post(`/api/decks/${deckId}/fork`);
  return res.data;
};

// Like / unlike a deck
export const likeDeck = async (deckId: string): Promise<void> => {
  await API.post(`/api/decks/${deckId}/like`);
};

export const unlikeDeck = async (deckId: string): Promise<void> => {
  await API.delete(`/api/decks/${deckId}/like`);
};

export const updateDeckMeta = async (
  deckId: string,
  payload: { title?: string; description?: string; category?: string; tags?: string[] }
): Promise<PublicDeck> => {
  const res = await API.put(`/api/decks/${deckId}`, payload);
  return res.data;
}

// --- PULL REQUESTS ---

export interface PullRequestResponse {
  pr_id: string;
  original_deck_id: string;
  forked_deck_id: string;
  author_id: string;
  author_username: string | null;
  status: string;
  message: string | null;
  created_at: string;
  new_cards_count: number;
  new_cards?: {
    card_id: string;
    front_text: string;
    back_text: string;
  }[];
}

export const createPullRequest = async (forkedDeckId: string, message?: string): Promise<PullRequestResponse> => {
  const res = await API.post(`/api/decks/${forkedDeckId}/pull-request`, { message });
  return res.data;
};

export const getPullRequests = async (deckId: string): Promise<PullRequestResponse[]> => {
  const res = await API.get(`/api/decks/${deckId}/pull-requests`);
  return res.data;
};

export const approvePullRequest = async (prId: string, cardIds?: string[]): Promise<{ status: string; added_cards: number }> => {
  const res = await API.post(`/api/decks/pull-requests/${prId}/approve`, cardIds ? { card_ids: cardIds } : {});
  return res.data;
};

export const rejectPullRequest = async (prId: string): Promise<{ status: string }> => {
  const res = await API.post(`/api/decks/pull-requests/${prId}/reject`);
  return res.data;
};
