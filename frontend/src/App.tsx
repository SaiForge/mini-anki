import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FeedItem, 
  StudyDeck, 
  SystemLog, 
  StudyStats 
} from "./types";
import { getMe, UserResponse } from "./api/authApi";
import { getDecks, mapApiDeckToStudyDeck, saveDeckMeta, deleteDeck as apiDeleteDeck, DeckLocalMeta, createCard, getDeckCards, createDeck } from "./api/deckApi";
import { createPost, getForYouFeed, getFollowingFeed, likePost, unlikePost, bookmarkPost, removeBookmark, deletePost, PostResponse } from "./api/feedApi";
import { getTrendingDecks, likeDeck, unlikeDeck } from "./api/exploreApi";
import { followUser, unfollowUser } from "./api/socialApi";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import FeedView from "./components/FeedView";
import ExploreView from "./components/ExploreView";
import DecksView from "./components/DecksView";
import NotificationsView from "./components/NotificationsView";
import SettingsView from "./components/SettingsView";
import ProfileView from "./components/ProfileView";
import StudySession from "./components/StudySession";
import UserProfileView from "./components/UserProfileView";
import AuthView from "./components/AuthView";
import { ConceptPublisher, ConceptFormData } from "./components/ConceptPublisher";
import MessagesView from "./components/MessagesView";
import AIChatPanel from "./components/AIChatPanel";
import SinglePostView from "./components/SinglePostView";

// Lucide custom icons for mobile/AI chat
import { 
  Terminal as TerminalIcon, 
  Sparkles, 
  Send, 
  X, 
  Plus, 
  Home, 
  Compass, 
  Bell, 
  Layers, 
  User, 
  Settings,
  Tag,
  HelpCircle,
  Hash,
  Info,
  Zap,
  BookOpen,
  Search
} from "lucide-react";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem("access_token");
  });
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null);
  const [decksLoading, setDecksLoading] = useState<boolean>(true);
  const [activeTab, setActiveTabRaw] = useState<string>("feed");
  const [tabHistory, setTabHistory] = useState<string[]>([]);

  const scrollPositions = useRef<Record<string, number>>({});

  const setActiveTab = useCallback((newTab: string) => {
    scrollPositions.current[activeTab] = window.scrollY;
    setActiveTabRaw(prev => {
      if (prev !== newTab) {
        setTabHistory(h => [...h, prev]);
      }
      return newTab;
    });
  }, [activeTab]);

  const goBackTab = useCallback((fallback: string) => {
    scrollPositions.current[activeTab] = window.scrollY;
    setTabHistory(prev => {
      if (prev.length === 0) {
        setActiveTabRaw(fallback);
        return prev;
      }
      const newHistory = [...prev];
      const last = newHistory.pop()!;
      setActiveTabRaw(last);
      return newHistory;
    });
  }, [activeTab]);

  const handleRootTabClick = useCallback((tab: string) => {
    scrollPositions.current[activeTab] = window.scrollY;
    setTabHistory([]);
    setActiveTabRaw(tab);
  }, [activeTab]);

  const [publicDecksFeed, setPublicDecksFeed] = useState<FeedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [messagesTargetUser, setMessagesTargetUser] = useState<{user_id: string; username: string; full_name: string | null; avatar_url: string | null} | null>(null);
  const [activeStudyDeck, setActiveStudyDeck] = useState<string | null>(null);
  const [activeStudyDeckId, setActiveStudyDeckId] = useState<string | null>(null);
  const [isActiveStudyDeckPublic, setIsActiveStudyDeckPublic] = useState<boolean>(false);
  const [selectedProfileUsername, setSelectedProfileUsername] = useState<string | null>(null);
  const [showAiAssistant, setShowAiAssistant] = useState<boolean>(false);
  const [quickAddDrawerMode, setQuickAddDrawerMode] = useState<"publish" | "deck-only" | null>(null);
  const [feedSubTab, setFeedSubTab] = useState<"ONLY_FOR_YOU" | "FOLLOWING">("ONLY_FOR_YOU");

  // Single post view state
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activePostOpenComments, setActivePostOpenComments] = useState<boolean>(false);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem("study-lab-theme");
    return stored !== "light";
  });

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.remove("light");
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.style.colorScheme = "light";
    }
    localStorage.setItem("study-lab-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  // Fetch real decks and merge with any locally-stored UI metadata
  const fetchDecksData = useCallback(() => {
    setDecksLoading(true);
    getDecks()
      .then(async (apiDecks) => {
        const mappedDecks = await Promise.all(
          apiDecks.map(async (d) => {
            const mapped = mapApiDeckToStudyDeck(d);
            try {
              const apiCards = await getDeckCards(mapped.id);
              mapped.cards = apiCards.map(c => ({
                id: c.card_id,
                question: c.front_text,
                answer: c.back_text,
              }));
            } catch (e) {
              console.error(`Failed to load cards for deck ${mapped.id}`, e);
            }
            return mapped;
          })
        );
        setDecks(mappedDecks);
      })
      .catch((err) => {
        console.error("Failed to fetch decks", err);
      })
      .finally(() => setDecksLoading(false));
  }, []);

  // Bootstrap: load user profile + real decks from the backend when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setDecksLoading(false);
      return;
    }
    // Fetch logged-in user
    getMe()
      .then((user) => {
        setCurrentUser(user);
        setStats((prev) => ({
          ...prev,
          dailyStreak: user.current_streak,
        }));
      })
      .catch(() => {
        // Token is invalid/expired — force re-login
        handleLogout();
      });

    // Fetch real decks and merge with any locally-stored UI metadata
    fetchDecksData();

    // Fetch trending public decks for the "DECKS" feed toggle
    getTrendingDecks(10)
      .then((trending) => {
        const mapped: FeedItem[] = trending.map(d => ({
          id: d.deck_id,
          category: "DECK",
          title: d.title,
          content: d.description || "",
          likes: d.like_count,
          likedByUser: d.is_liked,
          timeLabel: "recent",
          authorName: d.owner_full_name || d.owner_username || "Anonymous",
          authorUsername: d.owner_username || "anonymous",
          authorId: d.owner_id,
          authorAvatarUrl: d.owner_avatar_url || undefined,
          tags: (d.tags && d.tags.length > 0) ? d.tags : (d.category ? [d.category.toLowerCase(), "study", "deck"] : ["study", "deck"]),
        }));
        setPublicDecksFeed(mapped);
      })
      .catch(console.error);

  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // User Profile metadata — derived from real API once loaded
  const userEmail = currentUser?.email ?? "";

  // Initial database/state for Decks matching screens
  const [decks, setDecks] = useState<StudyDeck[]>([]);

  // General workbench study stats
  const [stats, setStats] = useState<StudyStats>({
    totalRetention: 92.4,
    dailyStreak: 42,
    studyTime: 12.8,
    globalRank: "#24",
  });

  // State log notifications lists
  const [logs, setLogs] = useState<SystemLog[]>([
    {
      id: "log-1",
      message: "Alex Chen requested access to your 'Advanced Neural Nets' deck.",
      logId: "882-901",
      type: "REQUEST_INCOMING",
      timeLabel: "02:14:11",
      read: false,
    },
    {
      id: "log-2",
      message: "Your daily streak is at risk. 4 hours remaining to maintain Mastery Level 4.",
      logId: "441-002",
      type: "SYSTEM_ALERT",
      timeLabel: "05:42:01",
      read: false,
    },
    {
      id: "log-3",
      message: "Sync complete. 42 new cards added to 'Systems Design'.",
      logId: "112-556",
      type: "SYNC_SUCCESS",
      timeLabel: "YESTERDAY",
      read: true,
    },
    {
      id: "log-4",
      message: 'Sarah Miller commented on your shared deck: "The hardware-level abstraction is excellent."',
      logId: "990-221",
      type: "SOCIAL_INTERACTION",
      timeLabel: "YESTERDAY",
      read: true,
    },
    {
      id: "log-5",
      message: "System Maintenance scheduled for Sunday, 02:00 UTC.",
      logId: "001-999",
      type: "SYSTEM_GLOBAL",
      timeLabel: "OCT 12",
      read: true,
    }
  ]);

  // Original curated concept cards matching exact screenshot layout elements
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);

  // AI assistant messaging dialog flow
  const [aiMessages, setAiMessages] = useState<{ sender: "user" | "bot"; text: string }[]>([
    { sender: "bot", text: "STUDY_LAB neural companion online. Submit research query or ask about system logs." }
  ]);
  const [aiInput, setAiInput] = useState<string>("");

  const handleDeletePost = useCallback(async (id: string) => {
    try {
      await deletePost(id);
      setFeedItems(prev => prev.filter(item => item.id !== id));
    } catch (e) {
      console.error("Failed to delete post", e);
    }
  }, []);

  const handleToggleLike = useCallback(async (id: string) => {
    const postItem = feedItems.find(x => x.id === id);
    if (postItem) {
      setFeedItems(prev => prev.map(item =>
        item.id === id ? { ...item, likedByUser: !item.likedByUser, likes: item.likedByUser ? item.likes - 1 : item.likes + 1 } : item
      ));
      try {
        if (postItem.likedByUser) await unlikePost(id);
        else await likePost(id);
      } catch (e) {
        setFeedItems(prev => prev.map(item =>
          item.id === id ? { ...item, likedByUser: !item.likedByUser, likes: item.likedByUser ? item.likes - 1 : item.likes + 1 } : item
        ));
      }
      return;
    }

    const deckItem = publicDecksFeed.find(x => x.id === id);
    if (deckItem) {
      setPublicDecksFeed(prev => prev.map(item =>
        item.id === id ? { ...item, likedByUser: !item.likedByUser, likes: item.likedByUser ? item.likes - 1 : item.likes + 1 } : item
      ));
      try {
        if (deckItem.likedByUser) await unlikeDeck(id);
        else await likeDeck(id);
      } catch (e) {
        setPublicDecksFeed(prev => prev.map(item =>
          item.id === id ? { ...item, likedByUser: !item.likedByUser, likes: item.likedByUser ? item.likes - 1 : item.likes + 1 } : item
        ));
      }
    }
  }, [feedItems, publicDecksFeed]);

  const handleToggleBookmark = useCallback(async (id: string) => {
    // Optimistic update
    setFeedItems(prev => prev.map(item =>
      item.id === id ? { ...item, bookmarkedByUser: !item.bookmarkedByUser } : item
    ));
    try {
      const item = feedItems.find(x => x.id === id);
      if (item?.bookmarkedByUser) {
        await removeBookmark(id);
      } else {
        await bookmarkPost(id);
      }
    } catch (e) {
      // Rollback on failure
      setFeedItems(prev => prev.map(item =>
        item.id === id ? { ...item, bookmarkedByUser: !item.bookmarkedByUser } : item
      ));
    }
  }, [feedItems]);

  const handleToggleFollow = useCallback(async (authorUsername: string) => {
    let authorName = authorUsername;
    let targetAuthorId: string | undefined = undefined;
    let isNowFollowed = false;
    let wasFollowed = false;
    
    setFeedItems(prev => {
      const targetItem = prev.find(item => item.authorUsername === authorUsername);
      if (targetItem) {
        authorName = targetItem.authorName || authorName;
        targetAuthorId = targetItem.authorId;
        wasFollowed = !!targetItem.isFollowed;
        isNowFollowed = !targetItem.isFollowed;
      }
      return prev.map(item => {
        if (item.authorUsername === authorUsername) {
          return {
            ...item,
            isFollowed: isNowFollowed,
          };
        }
        return item;
      });
    });

    if (targetAuthorId) {
      try {
        if (wasFollowed) {
          await unfollowUser(targetAuthorId);
        } else {
          await followUser(targetAuthorId);
        }
      } catch (e) {
        console.error("Failed to toggle follow status", e);
        // Rollback on failure
        setFeedItems(prev => prev.map(item => {
          if (item.authorUsername === authorUsername) {
            return { ...item, isFollowed: wasFollowed };
          }
          return item;
        }));
        return; // Don't show log if failed
      }
    }

    const followAlert: SystemLog = {
      id: `alert-follow-${Date.now()}`,
      message: !isNowFollowed 
        ? `Unfollowed ${authorName}. Content removed from your FOLLOWING feed.`
        : `You are now following ${authorName}. New decrypted concept items added to your FOLLOWING feed.`,
      logId: "305-115",
      type: "SOCIAL_INTERACTION",
      timeLabel: "JUST NOW",
      read: false,
    };
    setLogs(prev => [followAlert, ...prev]);
  }, []);

  const handleImportSharedDeck = useCallback((newDeck: StudyDeck) => {
    setDecks(prev => {
      const exists = prev.some(d => d.id === newDeck.id || d.title.toLowerCase() === newDeck.title.toLowerCase());
      if (exists) return prev;
      return [...prev, newDeck];
    });

    const importAlert: SystemLog = {
      id: `alert-import-${Date.now()}`,
      message: `Database synchronized. Imported Shared Deck '${newDeck.title}' with ${newDeck.cardCount} flashcards.`,
      logId: "505-119",
      type: "SYNC_SUCCESS",
      timeLabel: "JUST NOW",
      read: false,
    };
    setLogs(prev => [importAlert, ...prev]);
  }, []);

  // Update study stats dynamically when user gets card correct
  const handleCardResult = useCallback((success: boolean) => {
    setStats(prev => {
      const incrementMultiplier = success ? 0.3 : 0.1;
      const updatedRetention = Math.min(99.6, +(prev.totalRetention + (success ? 0.1 : -0.2)).toFixed(1));
      return {
        ...prev,
        totalRetention: updatedRetention,
        studyTime: +(prev.studyTime + incrementMultiplier).toFixed(1),
        dailyStreak: success ? prev.dailyStreak + 1 : prev.dailyStreak,
      };
    });
  }, []);

  // Notification clear triggers
  const handleToggleReadLog = useCallback((id: string) => {
    setLogs(prev => prev.map(l => l.id === id ? { ...l, read: true } : l));
  }, []);

  const handleClearLog = useCallback((id: string) => {
    setLogs(prev => prev.filter(l => l.id !== id));
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setLogs(prev => prev.map(l => ({ ...l, read: true })));
  }, []);

  // Fetches older mock logs as audits
  const handleFetchOlderLogs = useCallback(() => {
    const freshLogs: SystemLog[] = [
      {
        id: `old-${Date.now()}-1`,
        message: "Cache allocation complete. Allocated 1.2MB partition to Local Database Nodes.",
        logId: "109-224",
        type: "SYNC_SUCCESS",
        timeLabel: "4 DAYS AGO",
        read: true,
      },
      {
        id: `old-${Date.now()}-2`,
        message: "Failed token exchange on Node 15. Attempting JWT credentials recovery.",
        logId: "550-991",
        type: "SYSTEM_ALERT",
        timeLabel: "5 DAYS AGO",
        read: true,
      }
    ];
    setLogs(prev => [...prev, ...freshLogs]);
  }, []);

  // Quick helper reset stats trigger
  const handleResetStats = useCallback(() => {
    setStats({
      totalRetention: 65,
      dailyStreak: 0,
      studyTime: 0,
      globalRank: "#999"
    });
  }, []);

  // Load feed from backend
  const loadFeed = useCallback(async () => {
    try {
      const data = await getForYouFeed(0, 30);
      const mapped: FeedItem[] = data.map((p: PostResponse) => ({
        id: p.post_id,
        category: p.category || p.content_type || "CONCEPT",
        title: p.title || "",
        content: p.body,
        codeSnippet: p.code_snippet || undefined,
        imageUrl: p.image_url || undefined,
        likes: p.likes_count,
        likedByUser: p.is_liked,
        bookmarkedByUser: p.is_bookmarked,
        timeLabel: new Date(p.created_at).toLocaleDateString(),
        isPrivate: p.is_private,
        authorName: p.author_full_name || p.author_username || "Unknown",
        authorUsername: p.author_username ? `@${p.author_username}` : "@unknown",
        authorId: p.author_id,
        authorAvatar: (p.author_full_name || p.author_username || "?").substring(0, 2).toUpperCase(),
        authorAvatarUrl: p.author_avatar_url || undefined,
        isFollowed: p.is_followed,
        tags: [],
        commentsCount: p.comments_count,
      }));
      // Prepend mock items for demo flavour but put real posts first
      setFeedItems(prev => {
        const mockItems = prev.filter(i => !i.id.startsWith("post-") ? false : true);
        const existingIds = new Set(mapped.map(m => m.id));
        const mockOnly = mockItems.filter(m => !existingIds.has(m.id));
        return [...mapped, ...mockOnly];
      });
    } catch (e) {
      console.warn("Could not load feed from backend, using mock data", e);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadFeed();
    }
  }, [isAuthenticated, loadFeed]);

  // Handle addition of a custom feed post
  const handlePublishFeedPost = async (data: ConceptFormData) => {
    if (!data.qContent.trim()) return;

    // Parse tags from qTagsString
    const tagsArray = data.qTagsString
      .split(/[\s,]+/)
      .map(tag => tag.trim().replace(/^#/, ""))
      .filter(tag => tag.length > 0);

    const isRiddle = data.qContentType === "RIDDLE";
    const isJoke = data.qContentType === "JOKE";
    const isFlashcard = data.qContentType === "FLASHCARD";

    // Persist to backend if publishing
    if (quickAddDrawerMode === "publish") {
      try {
        const posted = await createPost({
          content_type: data.qContentType,
          title: data.qTitle || undefined,
          body: data.qContent,
          code_snippet: data.qCode || undefined,
          category: isRiddle ? "RIDDLES" : isJoke ? "JOKES" : data.qCategory.toUpperCase(),
          is_private: data.qPrivate,
          deck_id: data.qDeckId || undefined,
        });
        const newItem: FeedItem = {
          id: posted.post_id,
          category: posted.category || posted.content_type,
          title: posted.title || "",
          content: posted.body,
          codeSnippet: posted.code_snippet || undefined,
          likes: 0,
          likedByUser: false,
          bookmarkedByUser: false,
          timeLabel: "JUST NOW",
          isPrivate: posted.is_private,
          authorName: currentUser?.full_name || currentUser?.username || "Me",
          authorUsername: currentUser?.username ? `@${currentUser.username}` : "@me",
          authorAvatar: (currentUser?.full_name || currentUser?.username || "?").substring(0, 2).toUpperCase(),
          isFollowed: true,
          tags: tagsArray.length > 0 ? tagsArray : undefined,
        };
        setFeedItems(prev => [newItem, ...prev]);
      } catch (e) {
        console.error("Failed to publish post to backend", e);
        // Fallback: add locally
        const created: FeedItem = {
          id: `custom-${Date.now()}`,
          category: isRiddle ? "RIDDLES" : isJoke ? "JOKES" : data.qCategory.toUpperCase(),
          title: data.qTitle,
          content: data.qContent,
          codeSnippet: (isFlashcard || data.qContentType === "CONCEPT") && data.qCode ? data.qCode : undefined,
          likes: 0,
          likedByUser: false,
          bookmarkedByUser: false,
          timeLabel: "JUST NOW",
          isPrivate: data.qPrivate,
          authorName: "Me",
          authorUsername: "@me",
          authorAvatar: "ME",
          isFollowed: true,
          tags: tagsArray.length > 0 ? tagsArray : undefined,
        };
        setFeedItems(prev => [created, ...prev]);
      }
    }

    // Add to specific deck if chosen
    if (data.qDeckId) {
      const question = data.qTitle || `Discuss the core concept of ${data.qCategory}`;
      const answer = data.qContent;
      const details = data.qCode ? `Source code context:\n${data.qCode}` : undefined;

      try {
        const apiCard = await createCard(data.qDeckId, question, answer);
        const newCard = {
          id: apiCard.card_id,
          question,
          answer,
          details,
        };

        setDecks(prev => prev.map(deck => {
          if (deck.id === data.qDeckId) {
            return {
              ...deck,
              cardCount: deck.cardCount + 1,
              hasChanges: deck.originalDeckId ? true : false,
              cards: [...deck.cards, newCard]
            };
          }
          return deck;
        }));
      } catch (e) {
        console.error("Failed to save custom card to backend deck", e);
      }
    }

    setQuickAddDrawerMode(null);

    // Send a system alert notification indicating successful custom publish!
    const publishAlert: SystemLog = {
      id: `alert-${Date.now()}`,
      message: quickAddDrawerMode === "deck-only"
        ? `Card successfully added to your deck.`
        : `Sync complete. Custom ${data.qContentType.toLowerCase()} card successfully cataloged.`,
      logId: "209-441",
      type: "SYNC_SUCCESS",
      timeLabel: "JUST NOW",
      read: false,
    };
    setLogs(prev => [publishAlert, ...prev]);

    setStats(prev => ({
      ...prev,
      studyTime: +(prev.studyTime + 0.1).toFixed(1)
    }));
  };

  const handleSaveCardToDeck = useCallback(async (feedItemId: string, deckId: string) => {
    const item = feedItems.find(x => x.id === feedItemId);
    if (!item) return;

    const question = item.title || `Discuss the core concept of ${item.category}`;
    const answer = item.content;
    const details = item.codeSnippet ? `Source code context:\n${item.codeSnippet}` : undefined;

    try {
      const apiCard = await createCard(deckId, question, answer);
      const newCard = {
        id: apiCard.card_id,
        question,
        answer,
        details,
      };

      setDecks(prev => prev.map(deck => {
        if (deck.id === deckId) {
          // Prevent duplicate
          const exists = deck.cards?.some(c => c.answer === newCard.answer && c.question === newCard.question);
          if (exists) return deck;
          return {
            ...deck,
            cardCount: deck.cardCount + 1,
            hasChanges: deck.originalDeckId ? true : false,
            cards: [...(deck.cards || []), newCard]
          };
        }
        return deck;
      }));
    } catch (e) {
      console.error("Failed to save feed card to backend deck", e);
    }

    // The card is saved to a deck, but the original feed post remains visible.

    // Trigger log notification
    const deckObj = decks.find(d => d.id === deckId);
    const alertSave: SystemLog = {
      id: `alert-save-${Date.now()}`,
      message: `Card saved. Added concept from '${item.category}' to your '${deckObj?.title || 'Selected Deck'}'.`,
      logId: "305-110",
      type: "SYNC_SUCCESS",
      timeLabel: "JUST NOW",
      read: false,
    };
    setLogs(prev => [alertSave, ...prev]);

    // Update studyTime stat slightly to reflect new academic storage cataloging
    setStats(prev => ({
      ...prev,
      studyTime: +(prev.studyTime + 0.1).toFixed(1)
    }));
  }, [feedItems, decks]);

  const handleRemoveCardFromDeck = useCallback((feedItemId: string, deckId: string) => {
    const item = feedItems.find(x => x.id === feedItemId);
    if (!item) return;

    setDecks(prev => prev.map(deck => {
      if (deck.id === deckId) {
        const originalCards = deck.cards || [];
        const filteredCards = originalCards.filter(c => c.answer !== item.content);
        const removedCount = originalCards.length - filteredCards.length;
        return {
          ...deck,
          cardCount: Math.max(0, deck.cardCount - removedCount),
          cards: filteredCards
        };
      }
      return deck;
    }));

    // Trigger log notification
    const deckObj = decks.find(d => d.id === deckId);
    const alertUnsave: SystemLog = {
      id: `alert-unsave-${Date.now()}`,
      message: `Card unsaved. Removed concept from '${item.category}' from your '${deckObj?.title || 'Selected Deck'}'.`,
      logId: "305-111",
      type: "SYSTEM_ALERT",
      timeLabel: "JUST NOW",
      read: false,
    };
    setLogs(prev => [alertUnsave, ...prev]);
  }, [feedItems, decks]);

  const handleSaveToNewDeck = useCallback((feedItemId: string, newDeckTitle: string) => {
    const item = feedItems.find(x => x.id === feedItemId);
    if (!item) return;

    // Construct the flashcard
    const newCard = {
      id: `saved-${Date.now()}`,
      question: item.title || `Discuss the core concept of ${item.category}`,
      answer: item.content,
      details: item.codeSnippet ? `Source code context:\n${item.codeSnippet}` : undefined,
    };

    // Construct the new StudyDeck
    const newDeck: StudyDeck = {
      id: `deck-new-${Date.now()}`,
      category: item.category.toUpperCase() || "STORAGE",
      title: newDeckTitle,
      description: `Newly generated private stack for ${item.category} concepts.`,
      progress: 0,
      cardCount: 1,
      iconType: "terminal",
      cards: [newCard]
    };

    setDecks(prev => [...prev, newDeck]);

    // The card is saved to a new deck, but the original feed post remains visible.

    // Trigger logs
    const alertNewSave: SystemLog = {
      id: `alert-new-save-${Date.now()}`,
      message: `New deck created: '${newDeckTitle}'. Successfully saved concept card.`,
      logId: "401-220",
      type: "SYNC_SUCCESS",
      timeLabel: "JUST NOW",
      read: false,
    };
    setLogs(prev => [alertNewSave, ...prev]);

    setStats(prev => ({
      ...prev,
      studyTime: +(prev.studyTime + 0.3).toFixed(1)
    }));
  }, [feedItems]);

  const handleSaveExploreCardToDeck = useCallback((title: string, desc: string, deckId: string) => {
    const newCard = {
      id: `saved-${Date.now()}`,
      question: title,
      answer: desc,
      details: `Imported from Explore library: ${title}`,
    };

    setDecks(prev => prev.map(deck => {
      if (deck.id === deckId) {
        const exists = deck.cards?.some(c => c.question === newCard.question);
        if (exists) return deck;
        return {
          ...deck,
          cardCount: deck.cardCount + 1,
          hasChanges: deck.originalDeckId ? true : false,
          cards: [...(deck.cards || []), newCard]
        };
      }
      return deck;
    }));

    const deckObj = decks.find(d => d.id === deckId);
    const alertSave: SystemLog = {
      id: `alert-save-${Date.now()}`,
      message: `Successfully imported '${title}' concept into your '${deckObj?.title || 'Selected Deck'}'.`,
      logId: "305-110",
      type: "SYNC_SUCCESS",
      timeLabel: "JUST NOW",
      read: false,
    };
    setLogs(prev => [alertSave, ...prev]);

    setStats(prev => ({
      ...prev,
      studyTime: +(prev.studyTime + 0.1).toFixed(1)
    }));
  }, [decks]);

  const handleRemoveExploreCardFromDeck = useCallback((title: string, desc: string, deckId: string) => {
    setDecks(prev => prev.map(deck => {
      if (deck.id === deckId) {
        const originalCards = deck.cards || [];
        const filteredCards = originalCards.filter(c => c.answer !== desc);
        const removedCount = originalCards.length - filteredCards.length;
        return {
          ...deck,
          cardCount: Math.max(0, deck.cardCount - removedCount),
          cards: filteredCards
        };
      }
      return deck;
    }));

    const deckObj = decks.find(d => d.id === deckId);
    const alertUnsave: SystemLog = {
      id: `alert-unsave-${Date.now()}`,
      message: `Removed '${title}' concept from your '${deckObj?.title || 'Selected Deck'}'.`,
      logId: "305-112",
      type: "SYSTEM_ALERT",
      timeLabel: "JUST NOW",
      read: false,
    };
    setLogs(prev => [alertUnsave, ...prev]);
  }, [decks]);

  const handleSaveExploreToNewDeck = useCallback((title: string, desc: string, newDeckTitle: string) => {
    const newCard = {
      id: `saved-${Date.now()}`,
      question: title,
      answer: desc,
      details: `Imported from Explore library: ${title}`,
    };

    const newDeck: StudyDeck = {
      id: `deck-${Date.now()}`,
      category: "EXPLORE",
      title: newDeckTitle,
      description: `Newly generated private stack for ${title} concepts.`,
      progress: 0,
      cardCount: 1,
      iconType: "terminal",
      cards: [newCard]
    };

    setDecks(prev => [...prev, newDeck]);

    const alertNewSave: SystemLog = {
      id: `alert-new-save-${Date.now()}`,
      message: `New deck created: '${newDeckTitle}'. Successfully imported '${title}'.`,
      logId: "401-220",
      type: "SYNC_SUCCESS",
      timeLabel: "JUST NOW",
      read: false,
    };
    setLogs(prev => [alertNewSave, ...prev]);

    setStats(prev => ({
      ...prev,
      studyTime: +(prev.studyTime + 0.3).toFixed(1)
    }));
  }, []);

  // AI assistant chat generator
  const handleSendAiMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;

    const query = aiInput;
    setAiMessages(prev => [...prev, { sender: "user", text: query }]);
    setAiInput("");

    setTimeout(() => {
      let botResponse = "Workspace request accepted. Let's analyze. Could you configure the API key in settings or select 'Study Now' to verify node performance?";
      const lowerQuery = query.toLowerCase();

      if (lowerQuery.includes("rules") || lowerQuery.includes("monad")) {
        botResponse = "In Category Theory, a Monad represents an endofunctor paired with programmatic natural transformations (return/bind) mapped as: m a -> (a -> m b) -> m b.";
      } else if (lowerQuery.includes("streak") || lowerQuery.includes("rank")) {
        botResponse = `Your daily streak holds safe at ${stats.dailyStreak} consecutive cycles. Retention metrics log: ${stats.totalRetention}%.`;
      } else if (lowerQuery.includes("postgres") || lowerQuery.includes("database")) {
        botResponse = "Postgres Optimization utilizes b-tree index queries. EXPLAIN ANALYZE triggers immediate execution passes to analyze live row filter tuples.";
      } else if (lowerQuery.includes("system") || lowerQuery.includes("log")) {
        botResponse = `Active ledger reports ${logs.filter(l => !l.read).length} unread warnings. High-level division: Alex Chen's pending deck access.`;
      }

      setAiMessages(prev => [...prev, { sender: "bot", text: botResponse }]);
    }, 600);
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setCurrentUser(null);
    setIsAuthenticated(false);
    setDecks([]);
  };

  if (!isAuthenticated) {
    return (
      <AuthView 
        onLoginSuccess={(token) => {
          localStorage.setItem("access_token", token);
          setIsAuthenticated(true);
        }} 
      />
    );
  }

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-black text-[#e5e2e1] font-sans selection:bg-white selection:text-black">
      
      {/* Sidebar Navigation (Desktop Only) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          handleRootTabClick(tab);
          setSearchQuery("");
        }} 
        onStudyNowClick={() => {
          // Use first non-default deck or default deck
          const firstDeck = decks.find(d => !d.title.includes("Today's Review")) || decks[0];
          if (firstDeck) {
            setActiveStudyDeck(firstDeck.title);
            setActiveStudyDeckId(firstDeck.id);
            setIsActiveStudyDeckPublic(false);
          }
        }} 
      />

      {/* Main Core View Area */}
      <div className="flex-1 min-w-0 lg:ml-64 flex flex-col min-h-screen relative">
        
        {/* Responsive Header Component */}
        <Header 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            handleRootTabClick(tab);
            setSearchQuery(""); // Clear search query on navigation
          }}
          onAddNewClick={() => {
            if (activeTab === "decks") {
              setActiveTab("decks");
              // triggers show add deck form
            } else {
              setQuickAddDrawerMode("publish");
            }
          }}
          onOpenAssistant={() => setShowAiAssistant(true)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(prev => !prev)}
          feedSubTab={feedSubTab}
          setFeedSubTab={setFeedSubTab}
        />

        {/* Current Content Canvas */}
        <main className="flex-1">
          <AnimatePresence 
            mode="wait" 
            onExitComplete={() => {
              // Restore scroll position for the incoming tab after exit animation completes
              window.scrollTo({
                top: scrollPositions.current[activeTab] || 0,
                behavior: "instant"
              });
            }}
          >
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
          {activeTab === "feed" && (
            <FeedView 
              items={feedSubTab === "ONLY_FOR_YOU" ? feedItems : publicDecksFeed}
              onToggleLike={handleToggleLike}
              onToggleBookmark={handleToggleBookmark}
              onAddNewClick={() => setQuickAddDrawerMode("publish")}
              searchQuery={searchQuery}
              decks={decks}
              onSaveCardToDeck={handleSaveCardToDeck}
              onSaveToNewDeck={handleSaveToNewDeck}
              onRemoveCardFromDeck={handleRemoveCardFromDeck}
              onToggleFollow={handleToggleFollow}
              onViewProfile={(username) => {
                if (currentUser && (username === currentUser.username || username === `@${currentUser.username}`)) {
                  setActiveTab("profile");
                } else {
                  setSelectedProfileUsername(username); 
                  setActiveTab("user-profile"); 
                }
              }}
              onSearchChange={setSearchQuery}
              onStudyDeck={(deckName, deckId) => {
                setActiveStudyDeck(deckName);
                setActiveStudyDeckId(deckId ?? decks.find(d => d.title === deckName)?.id ?? null);
                setIsActiveStudyDeckPublic(true);
                setActiveTab("study");
              }}
              feedSubTab={feedSubTab}
              setFeedSubTab={setFeedSubTab}
              isDarkMode={isDarkMode}
              currentUserId={currentUser?.user_id}
              currentUsername={currentUser?.username || undefined}
              onDeletePost={handleDeletePost}
            />
          )}

          {activeTab === "explore" && (
            <ExploreView 
              onStudyDeck={(deckName, deckId) => {
                setActiveStudyDeck(deckName);
                setActiveStudyDeckId(deckId ?? decks.find(d => d.title === deckName)?.id ?? null);
                setIsActiveStudyDeckPublic(true);
                setActiveTab("study");
              }}
              searchQuery={searchQuery}
              decks={decks}
              feedItems={feedItems}
              onSaveCardToDeck={handleSaveExploreCardToDeck}
              onSaveToNewDeck={handleSaveExploreToNewDeck}
              onRemoveCardFromDeck={handleRemoveExploreCardFromDeck}
              onToggleFollow={handleToggleFollow}
              onViewProfile={(username) => {
                if (currentUser && (username === currentUser.username || username === `@${currentUser.username}`)) {
                  setActiveTab("profile");
                } else {
                  setSelectedProfileUsername(username); 
                  setActiveTab("user-profile"); 
                }
              }}
              isDarkMode={isDarkMode}
              currentUserId={currentUser?.user_id}
              currentUsername={currentUser?.username || undefined}
            />
          )}

          {activeTab === "decks" && (
            <DecksView 
              decks={decks}
              stats={stats}
              isDarkMode={isDarkMode}
              decksLoading={decksLoading}
              onStudyDeck={(deckName, deckId) => {
                setActiveStudyDeck(deckName);
                setActiveStudyDeckId(deckId ?? decks.find(d => d.title === deckName)?.id ?? null);
                setIsActiveStudyDeckPublic(false);
                setActiveTab("study");
              }}
              onRefreshDecks={fetchDecksData}
              onAddNewCardClick={() => setQuickAddDrawerMode("deck-only")}
              onAddNewDeck={(newDeck) => {
                setDecks(prev => [...prev, newDeck]);
                setStats(curr => ({
                  ...curr,
                  studyTime: +(curr.studyTime + 0.5).toFixed(1)
                }));
              }}
              onDeleteDeck={async (deckId) => {
                try {
                  await apiDeleteDeck(deckId);
                  setDecks(prev => prev.filter(d => d.id !== deckId));
                  const alertDel: SystemLog = {
                    id: `alert-del-${Date.now()}`,
                    message: "Deck deleted and removed from your repository.",
                    logId: "701-002",
                    type: "SYSTEM_ALERT",
                    timeLabel: "JUST NOW",
                    read: false,
                  };
                  setLogs(prev => [alertDel, ...prev]);
                } catch {
                  // ignore, deck might be default
                }
              }}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === "notifications" && (
            <NotificationsView 
              onOpenUserProfile={(username) => {
                setSelectedProfileUsername(username);
                setActiveTab("user-profile");
              }}
              onNavigateToDecks={() => setActiveTab("decks")}
              onOpenPost={(postId, openComments) => {
                setActivePostId(postId);
                setActivePostOpenComments(openComments);
                setActiveTab("post");
              }}
              onOpenDeck={(deckId) => {
                const d = decks.find(dk => dk.id === deckId);
                if (d) {
                  setActiveStudyDeck(d.title);
                  setActiveStudyDeckId(d.id);
                  setIsActiveStudyDeckPublic(false);
                  setActiveTab("study");
                } else {
                  setActiveStudyDeck("Community Deck");
                  setActiveStudyDeckId(deckId);
                  setIsActiveStudyDeckPublic(true);
                  setActiveTab("study");
                }
              }}
            />
          )}

          {activeTab === "messages" && (
            <MessagesView
              currentUserId={currentUser?.user_id || ""}
              searchQuery={searchQuery}
              isDarkMode={isDarkMode}
              targetUser={messagesTargetUser}
              onClearTargetUser={() => setMessagesTargetUser(null)}
              onOpenUserProfile={(username) => {
                setSelectedProfileUsername(username);
                setActiveTab("user-profile");
              }}
            />
          )}

          {activeTab === "settings" && (
            <SettingsView 
              userEmail={userEmail} 
              isDarkMode={isDarkMode}
              onToggleDarkMode={() => setIsDarkMode(prev => !prev)}
              onLogout={handleLogout}
            />
          )}

          {activeTab === "profile" && (
            <ProfileView 
              userEmail={currentUser?.email || "anonymous@node"} 
              currentUser={currentUser}
              onProfileUpdate={setCurrentUser}
              stats={stats}
              onResetStats={handleResetStats}
              isDarkMode={isDarkMode}
              feedItems={feedItems}
              userDecks={decks}
              onStudyDeck={(deckName, deckId) => {
                setActiveStudyDeck(deckName);
                setActiveStudyDeckId(deckId ?? decks.find(d => d.title === deckName)?.id ?? null);
                setIsActiveStudyDeckPublic(false);
                setActiveTab("study");
              }}
              onDeletePost={handleDeletePost}
              currentUserId={currentUser?.user_id}
              currentUsername={currentUser?.username || undefined}
            />
          )}

          {activeTab === "post" && activePostId && (
            <SinglePostView
              postId={activePostId}
              autoOpenComments={activePostOpenComments}
              onClose={() => goBackTab("feed")}
              currentUserId={currentUser?.user_id || undefined}
              currentUsername={currentUser?.username || undefined}
              isDarkMode={isDarkMode}
              onToggleLike={handleToggleLike}
              onToggleBookmark={handleToggleBookmark}
              decks={decks}
              onSaveCardToDeck={handleSaveCardToDeck as any}
              onSaveToNewDeck={handleSaveToNewDeck}
              onRemoveCardFromDeck={handleRemoveCardFromDeck}
              onDeletePost={handleDeletePost}
              onOpenUserProfile={(username) => {
                setSelectedProfileUsername(username);
                setActiveTab("user-profile");
              }}
            />
          )}

          {activeTab === "user-profile" && selectedProfileUsername && (
            <UserProfileView 
              username={selectedProfileUsername}
              onClose={() => {
                setSelectedProfileUsername(null);
                goBackTab("feed");
              }}
              feedItems={feedItems}
              userDecks={decks}
              onToggleFollow={handleToggleFollow}
              onStudyDeck={(deckName, deckId) => {
                setActiveStudyDeck(deckName);
                setActiveStudyDeckId(deckId ?? decks.find(d => d.title === deckName)?.id ?? null);
                setIsActiveStudyDeckPublic(true);
                setActiveTab("study");
              }}
              userEmail={userEmail}
              currentUserId={currentUser?.user_id}
              currentUsername={currentUser?.username || undefined}
              onMessageClick={(user) => {
                setMessagesTargetUser(user);
                setActiveTab("messages");
              }}
            />
          )}

          {activeTab === "study" && activeStudyDeck !== null && isActiveStudyDeckPublic && (
            <StudySession 
              deckTitle={activeStudyDeck}
              deckId={activeStudyDeckId}
              cards={decks.find(d => d.title === activeStudyDeck)?.cards || []}
              onClose={() => {
                setActiveStudyDeck(null);
                setActiveStudyDeckId(null);
                setIsActiveStudyDeckPublic(false);
                goBackTab("explore");
              }}
              onCardResult={handleCardResult}
              isDarkMode={isDarkMode}
              isPublic={isActiveStudyDeckPublic}
              decks={decks}
              onImportDeck={handleImportSharedDeck}
              onSaveCardToDeck={handleSaveCardToDeck}
              onRemoveCardFromDeck={handleRemoveCardFromDeck}
            />
          )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile / Tablet Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 w-full z-45 flex justify-around items-center h-16 bg-[#131313]/95 backdrop-blur-lg border-t border-[#1A1A1A]">
          {[
            { id: "decks", icon: Layers, label: "Decks" },
            { id: "feed", icon: Compass, label: "Explore" },
            { id: "explore", icon: Search, label: "Search" },
            { id: "notifications", icon: Bell, label: "Logs" },
            { id: "profile", icon: User, label: "Me" },
            { id: "settings", icon: Settings, label: "Config" }
          ].map((btn) => {
            const Icon = btn.icon;
            const isTabActive = activeTab === btn.id;
            return (
              <button
                key={btn.id}
                onClick={() => {
                  handleRootTabClick(btn.id);
                  setSearchQuery("");
                }}
                className={`flex flex-col items-center justify-center p-2 text-center flex-1 cursor-pointer transition-all ${
                  isTabActive ? "text-white font-bold scale-102" : "text-on-surface-variant/70 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-sans mt-1 font-medium tracking-wide">{btn.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Padding offset helper for mobile navigation overlay */}
        <div className="h-20 lg:hidden"></div>

      </div>

      {/* ── Phase 5: Real AI Study Companion Panel ── */}
      <AIChatPanel
        isOpen={showAiAssistant}
        onClose={() => setShowAiAssistant(false)}
        decks={decks}
        isDarkMode={isDarkMode}
        onDeckCreated={async (name: string) => {
          const newDeck = await createDeck(name);
          return newDeck.deck_id;
        }}
        onCardsAdded={async (deckId: string, cards: { front: string; back: string }[]) => {
          for (const card of cards) {
            await createCard(deckId, card.front, card.back);
          }
        }}
        onDecksRefresh={fetchDecksData}
      />

      {/* Slide-In Concept Card Publisher Wizard */}
      {quickAddDrawerMode !== null && (
        <ConceptPublisher 
          onClose={() => setQuickAddDrawerMode(null)} 
          onPublish={handlePublishFeedPost} 
          isDarkMode={isDarkMode} 
          userDecks={decks}
          mode={quickAddDrawerMode}
        />
      )}

      {/* Interactive flashcard study mode active session overlay */}
      {activeStudyDeck !== null && !isActiveStudyDeckPublic && (
        <StudySession 
          deckTitle={activeStudyDeck}
          deckId={activeStudyDeckId}
          cards={decks.find(d => d.title === activeStudyDeck)?.cards || []}
          onClose={() => {
            setActiveStudyDeck(null);
            setActiveStudyDeckId(null);
            setIsActiveStudyDeckPublic(false);
            goBackTab("decks");
          }}
          onCardResult={handleCardResult}
          isDarkMode={isDarkMode}
          isPublic={false}
          decks={decks}
          onImportDeck={handleImportSharedDeck}
          onSaveCardToDeck={handleSaveCardToDeck}
          onRemoveCardFromDeck={handleRemoveCardFromDeck}
        />
      )}

    </div>
  );
}
