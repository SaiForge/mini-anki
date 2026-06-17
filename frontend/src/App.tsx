import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FeedItem, 
  StudyDeck, 
  SystemLog, 
  StudyStats 
} from "./types";
import { getMe, UserResponse } from "./api/authApi";
import { getDecks, mapApiDeckToStudyDeck, saveDeckMeta, deleteDeck as apiDeleteDeck, DeckLocalMeta, createCard } from "./api/deckApi";
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
  const [activeTab, setActiveTab] = useState<string>("feed");

  const [publicDecksFeed] = useState<FeedItem[]>([
    {
      id: "deck-feed-1",
      category: "DECK",
      title: "Dynamic Programming Patterns",
      content: "Deep dive into memoization, tabulation, and complexity analysis for string manipulation problems. Contains 142 Cards.",
      likes: 340,
      likedByUser: false,
      bookmarkedByUser: false,
      timeLabel: "OCT 14",
      authorName: "Dev Kaufman",
      authorUsername: "@dev_kaufman",
      authorAvatar: "DK",
      isFollowed: false,
      tags: ["algorithms", "cs"],
      isPrivate: false,
    },
    {
      id: "deck-feed-2",
      category: "DECK",
      title: "Haskell: Monads in Practice",
      content: "Pragmatic structures, functors, applicability, and computational sequencing in pure functional paradigms.",
      likes: 890,
      likedByUser: true,
      bookmarkedByUser: true,
      timeLabel: "2 DAYS AGO",
      authorName: "Lambda Stack",
      authorUsername: "@λ_stack",
      authorAvatar: "LS",
      isFollowed: true,
      tags: ["haskell", "functional"],
      isPrivate: false,
    },
    {
      id: "deck-feed-3",
      category: "DECK",
      title: "Quantum Electrodynamics",
      content: "Basic formulas, QED Feynman diagrams, photon behaviors, and perturbation methods.",
      likes: 1205,
      likedByUser: false,
      bookmarkedByUser: false,
      timeLabel: "OCT 20",
      authorName: "QED Physicist",
      authorUsername: "@qed_physicist",
      authorAvatar: "QP",
      isFollowed: false,
      tags: ["physics", "quantum"],
      isPrivate: false,
    }
  ]);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeStudyDeck, setActiveStudyDeck] = useState<string | null>(null);
  const [activeStudyDeckId, setActiveStudyDeckId] = useState<string | null>(null);
  const [isActiveStudyDeckPublic, setIsActiveStudyDeckPublic] = useState<boolean>(false);
  const [selectedProfileUsername, setSelectedProfileUsername] = useState<string | null>(null);
  const [showAiAssistant, setShowAiAssistant] = useState<boolean>(false);
  const [quickAddDrawerMode, setQuickAddDrawerMode] = useState<"publish" | "deck-only" | null>(null);
  const [feedSubTab, setFeedSubTab] = useState<"ONLY_FOR_YOU" | "FOLLOWING">("ONLY_FOR_YOU");

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
    getDecks()
      .then((apiDecks) => {
        const mapped = apiDecks.map((d) => mapApiDeckToStudyDeck(d));
        setDecks(mapped);
      })
      .catch(() => {
        // Keep mock decks if fetch fails (offline fallback)
      })
      .finally(() => setDecksLoading(false));
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // User Profile metadata — derived from real API once loaded
  const userEmail = currentUser?.email ?? "";

  // Initial database/state for Decks matching screens
  const [decks, setDecks] = useState<StudyDeck[]>([
    {
      id: "deck-1",
      category: "SYSTEMS",
      title: "Systems Architecture",
      description: "Distributed systems, microservices, and high-availability design patterns.",
      progress: 65,
      cardCount: 3,
      iconType: "terminal",
      active: true,
      cards: [
        {
          id: "card-sa-1",
          question: "Describe the primary difference between gRPC and REST regarding network payloads.",
          answer: "gRPC utilizes Protocol Buffers (Protobuf) for binary serialization, resulting in highly compacted payloads. REST primarily relies on JSON strings, introducing higher parsing cycles and increased package overhead.",
          details: "Protobuf contracts (proto files) skip structural field transmissions on the wire by mapping indexes directly."
        },
        {
          id: "card-sa-2",
          question: "Explain the concept of 'Backpressure' in asynchronous messaging pipelines.",
          answer: "A flow-control mechanism where a slow downstream reader signals an upstream writer to buffer, delay, or throttle transfers. This prevents consumer memory saturation.",
          details: "Implemented natively in systems via TCP window adjustments, reactive streams, or token buckets."
        },
        {
          id: "card-sa-3",
          question: "What is the CAP Theorem trade-off during a continuous network division or partition?",
          answer: "A distributed structure must choose between Consistency (all nodes see synchronized data states) or Availability (all nodes return immediate answers even if stale). Both cannot be guaranteed.",
          details: "Under partition (P), consistency (C) requires refusing writes to isolated nodes, thereby breaking availability (A)."
        }
      ]
    },
    {
      id: "deck-2",
      category: "WEB",
      title: "ECMAScript Internals",
      description: "V8 engine, garbage collection, optimization techniques, and event loop mechanics.",
      progress: 12,
      cardCount: 2,
      iconType: "terminal",
      cards: [
        {
          id: "card-es-1",
          question: "What is the primary role of the V8 engine's Ignition interpreter and TurboFan compiler?",
          answer: "Ignition compiles JS source code to bytecode, executing it immediately. When routines run frequently (hot paths), TurboFan takes the bytecode and compiles it into highly optimized native machine code.",
          details: "If type assumptions fail later, V8 can deoptimize and drop back to interpreted bytecode."
        },
        {
          id: "card-es-2",
          question: "Describe V8 Garbage Collection's two generational spaces.",
          answer: "V8 separates the heap into a Nursery/Young generation (for short-lived objects, collected using an active Scavenger copying algorithm) and an Old Generation (for long-lived objects, collected via Sweep-Compact).",
          details: "The generational hypothesis states that most objects die or become unreachable very quickly after creation."
        }
      ]
    },
    {
      id: "deck-3",
      category: "DATA",
      title: "PostgreSQL Optimization",
      description: "Index tuning, lock types, EXPLAIN ANALYZE execution pipelines, and vacuuming strategies.",
      progress: 88,
      cardCount: 2,
      iconType: "database",
      cards: [
        {
          id: "card-pg-1",
          question: "How does the Postgres index process handle VACUUM commands?",
          answer: "VACUUM reclaims storage from stale row variants (dead tuples) created by updates or deletions and updates the database statistics. It does not compress indexes unless VACUUM FULL is called.",
          details: "Autovacuum runs in the background to prevent transaction ID wraparound and table bloat issues."
        },
        {
          id: "card-pg-2",
          question: "What is the difference between an Index Scan and an Index Only Scan in PostgreSQL?",
          answer: "An Index Scan looks up pointers in the index and then reads target blocks from the table heap. An Index Only Scan retrieves all requested columns directly from the index itself, avoiding heap reads completely.",
          details: "An Index Only Scan still refers to the visibility map to verify page visibility without visiting the heap."
        }
      ]
    },
    {
      id: "deck-4",
      category: "SECURITY",
      title: "Cybersecurity Protocols",
      description: "OAuth2 flow delegation, JWT hardening practices, cryptographic keys, and token mitigation.",
      progress: 45,
      cardCount: 2,
      iconType: "security",
      cards: [
        {
          id: "card-sec-1",
          question: "Explain the security difference between the Authorization Code flow and the Implicit flow in OAuth2.",
          answer: "Authorization Code flow returns an authorization code via front-channel redirect, which is then exchanged for an access token back-channel (server-to-server), protecting the token from browser exposure. Implicit flow returns the token directly in the browser fragment, risking leakage.",
          details: "Implicit flow has been deprecated by OAuth 2.1 in favor of Authorization Code with PKCE."
        },
        {
          id: "card-sec-2",
          question: "What is JWT Token hijacking and how does Token Rotation mitigate it?",
          answer: "Hijacking is when a packet or device leak exposes the refresh token. Rotation invalidates old tokens and issues a new refresh-access token pair on every refresh API request, immediately blacklisting any reuse from anomalous concurrent sessions.",
          details: "If a leaked old refresh token is reused, the auth server detects the duplicate and revokes the entire lineage."
        }
      ]
    },
    {
      id: "deck-jokes",
      category: "Jokes",
      title: "Developer Humor",
      description: "A library of funny computer science puns and programmer developer jokes.",
      progress: 60,
      cardCount: 3,
      iconType: "brain",
      cards: [
        {
          id: "joke-c-1",
          question: "Why do programmers wear glasses?",
          answer: "Because they can't C#.",
          details: "A classic pun referencing Microsoft's C# language and visual acuity."
        },
        {
          id: "joke-c-2",
          question: "How many programmers does it take to change a light bulb?",
          answer: "None, that is a hardware issue.",
          details: "Software engineers usually don't deal with physical hardware components."
        },
        {
          id: "joke-c-3",
          question: "What is a programmer's favorite hangout place?",
          answer: "Foo Bar.",
          details: "Foo and Bar are standard placeholder names (metasyntactic variables) in computer science."
        }
      ]
    },
    {
      id: "deck-riddles",
      category: "Riddles",
      title: "Logic Riddles",
      description: "Clever riddles and logical math puzzles to sharpen your debugging brain.",
      progress: 40,
      cardCount: 3,
      iconType: "science",
      cards: [
        {
          id: "riddle-c-1",
          question: "I have keys but open no locks. I have space but no room. You can enter but can't go outside. What am I?",
          answer: "A Keyboard!",
          details: "Contains keys (letters/numbers), a space bar, and an Enter key."
        },
        {
          id: "riddle-c-2",
          question: "The more of them you take, the more you leave behind. What are they?",
          answer: "Footsteps!",
          details: "Walking forward leaves footsteps behind you."
        },
        {
          id: "riddle-c-3",
          question: "What has a head and a tail but no body?",
          answer: "A coin.",
          details: "A standard two-sided coin."
        }
      ]
    }
  ]);

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
  const [feedItems, setFeedItems] = useState<FeedItem[]>([
    {
      id: "post-1",
      category: "The Principle of Atomic Habits",
      title: "",
      content: '"Small changes often appear to make no difference until you cross a critical threshold."',
      likes: 1200,
      likedByUser: false,
      bookmarkedByUser: false,
      timeLabel: "08:42 AM",
      authorName: "James Clear",
      authorUsername: "@james_clear",
      authorAvatar: "JC",
      isFollowed: false,
      tags: ["habits", "behavior", "systems"],
    },
    {
      id: "post-2",
      category: "PROGRAMMING",
      title: "Asynchronous Logic in Rust",
      content: "Futures in Rust are poll-based rather than completion-based. This architectural choice minimizes the runtime overhead, making it ideal for high-performance systems.",
      codeSnippet: "fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;",
      likes: 842,
      likedByUser: false,
      bookmarkedByUser: false,
      timeLabel: "YESTERDAY",
      authorName: "Alex Chen",
      authorUsername: "@alexchen",
      authorAvatar: "AC",
      isFollowed: true,
      tags: ["rust", "async", "programming"],
    },
    {
      id: "post-3",
      category: "Visual Identity",
      title: "Simplicity is the ultimate sophistication.",
      content: '"Simplicity is the ultimate sophistication."',
      imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBCX9-3Jpxb-olaTAWgu5xBFtvDj2Qc4jz_-qcTXp62ZO_wuUswhVRukfZw9nV25AUjZ52CH6Afxpg45BKLdNaqM4C02zxkkdvToIC7CUR-Mn3_ekspweNCZxSC0ZBuSPBXnuJVKvBIAZn9PPHFtTyV1Kl_t6OKNRgeX3oMUAULy2bQxl1aHmjGgi01oRNvKYPJGmUdEzorbQWjLMKuKi3VDmsuU0QYoXNLh3EoNr4h0zJAM8Voe9BUUEZcOdLUvxbcjfRN0vr99LKI",
      likes: 2500,
      likedByUser: false,
      bookmarkedByUser: false,
      timeLabel: "OCT 24",
      authorName: "Sophia Lind",
      authorUsername: "@sophialind",
      authorAvatar: "SL",
      isFollowed: false,
      tags: ["design", "minimalism", "grid"],
    },
    {
      id: "post-4",
      category: "Philosophy of Science",
      title: "",
      content: "The best way to predict the future is to invent it.",
      quoteAuthor: "— Alan Kay",
      likes: 512,
      likedByUser: false,
      bookmarkedByUser: false,
      timeLabel: "2 DAYS AGO",
      isQuoteStyle: true,
      authorName: "Alan Kay",
      authorUsername: "@alan_kay",
      authorAvatar: "AK",
      isFollowed: true,
      tags: ["oop", "computing", "philosophy"],
    },
    {
      id: "joke-post-1",
      category: "JOKES",
      title: "Binary Humor",
      content: "There are only 10 types of people in the world: those who understand binary, and those who don't.",
      likes: 721,
      likedByUser: false,
      bookmarkedByUser: false,
      isPrivate: false,
      timeLabel: "3 hours ago",
      authorName: "Dev Grump",
      authorUsername: "@dev_grump",
      authorAvatar: "DG",
      isFollowed: false,
      tags: ["joke", "binary", "cs-puns"],
    },
    {
      id: "riddle-post-1",
      category: "RIDDLES",
      title: "The Silent Truth",
      content: "What is so fragile that saying its name breaks it?",
      quoteAuthor: "TAP TO REVEAL: Silence",
      isQuoteStyle: true,
      likes: 512,
      likedByUser: false,
      bookmarkedByUser: false,
      isPrivate: false,
      timeLabel: "YESTERDAY",
      authorName: "Riddle Maker",
      authorUsername: "@riddler",
      authorAvatar: "RM",
      isFollowed: false,
      tags: ["riddle", "silence", "puzzles"],
    },
    {
      id: "joke-post-2",
      category: "JOKES",
      title: "Clean Code",
      content: "Why do programmers prefer dark mode?\n\nBecause light attracts bugs!",
      likes: 889,
      likedByUser: false,
      bookmarkedByUser: false,
      isPrivate: true,
      timeLabel: "Just now",
      authorName: "CleanCoder",
      authorUsername: "@cleancoder",
      authorAvatar: "CC",
      isFollowed: true,
      tags: ["joke", "darkmode", "debugging"],
    }
  ]);

  // AI assistant messaging dialog flow
  const [aiMessages, setAiMessages] = useState<{ sender: "user" | "bot"; text: string }[]>([
    { sender: "bot", text: "STUDY_LAB neural companion online. Submit research query or ask about system logs." }
  ]);
  const [aiInput, setAiInput] = useState<string>("");
  const handleToggleLike = useCallback((id: string) => {
    setFeedItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          likedByUser: !item.likedByUser,
        };
      }
      return item;
    }));
  }, []);

  const handleToggleBookmark = useCallback((id: string) => {
    setFeedItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          bookmarkedByUser: !item.bookmarkedByUser,
        };
      }
      return item;
    }));
  }, []);

  const handleToggleFollow = useCallback((authorUsername: string) => {
    let authorName = authorUsername;
    let isNowFollowed = false;
    
    setFeedItems(prev => {
      const targetItem = prev.find(item => item.authorUsername === authorUsername);
      if (targetItem) {
        authorName = targetItem.authorName || authorName;
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
      const exists = prev.some(d => d.title.toLowerCase() === newDeck.title.toLowerCase());
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

    const created: FeedItem = {
      id: `custom-${Date.now()}`,
      category: isRiddle ? "RIDDLES" : isJoke ? "JOKES" : data.qCategory.toUpperCase(),
      title: data.qTitle,
      content: data.qContent,
      codeSnippet: (isFlashcard || data.qContentType === "CONCEPT") && data.qCode ? data.qCode : undefined,
      quoteAuthor: isRiddle ? `TAP TO REVEAL: ${data.qCode || "Answer"}` : undefined,
      isQuoteStyle: isRiddle,
      likes: 0,
      likedByUser: false,
      bookmarkedByUser: false,
      timeLabel: "JUST NOW",
      isPrivate: data.qPrivate,
      authorName: "Sai Bag",
      authorUsername: "@kolarsaibag",
      authorAvatar: "SB",
      isFollowed: true,
      tags: tagsArray.length > 0 ? tagsArray : undefined,
    };

    if (quickAddDrawerMode === "publish") {
      setFeedItems([created, ...feedItems]);
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
            cards: [...(deck.cards || []), newCard]
          };
        }
        return deck;
      }));
    } catch (e) {
      console.error("Failed to save feed card to backend deck", e);
    }

    // Mark corresponding feed item as private/Only for you
    setFeedItems(prev => prev.map(x => {
      if (x.id === feedItemId) {
        return { ...x, isPrivate: true };
      }
      return x;
    }));

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

    // Mark corresponding feed item as private/Only for  you
    setFeedItems(prev => prev.map(x => {
      if (x.id === feedItemId) {
        return { ...x, isPrivate: true };
      }
      return x;
    }));

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
    <div className="flex min-h-screen bg-black text-[#e5e2e1] font-sans selection:bg-white selection:text-black">
      
      {/* Sidebar Navigation (Desktop Only) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
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
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        
        {/* Responsive Header Component */}
        <Header 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
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
          <AnimatePresence mode="wait">
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
              onViewProfile={(username) => { setSelectedProfileUsername(username); setActiveTab("user-profile"); }}
              onSearchChange={setSearchQuery}
              onStudyDeck={(deckName) => {
                setActiveStudyDeck(deckName);
                setActiveStudyDeckId(decks.find(d => d.title === deckName)?.id ?? null);
                setIsActiveStudyDeckPublic(true);
                setActiveTab("study");
              }}
              feedSubTab={feedSubTab}
              setFeedSubTab={setFeedSubTab}
              isDarkMode={isDarkMode}
            />
          )}

          {activeTab === "explore" && (
            <ExploreView 
              onStudyDeck={(deckName) => {
                setActiveStudyDeck(deckName);
                setActiveStudyDeckId(decks.find(d => d.title === deckName)?.id ?? null);
                setIsActiveStudyDeckPublic(true);
                setActiveTab("study");
              }}
              searchQuery={searchQuery}
              decks={decks}
              feedItems={feedItems}
              onSaveCardToDeck={handleSaveExploreCardToDeck}
              onSaveToNewDeck={handleSaveExploreToNewDeck}
              onRemoveCardFromDeck={handleRemoveExploreCardFromDeck}
            />
          )}

          {activeTab === "decks" && (
            <DecksView 
              decks={decks}
              stats={stats}
              isDarkMode={isDarkMode}
              decksLoading={decksLoading}
              onStudyDeck={(deckName) => {
                setActiveStudyDeck(deckName);
                setActiveStudyDeckId(decks.find(d => d.title === deckName)?.id ?? null);
                setIsActiveStudyDeckPublic(false);
              }}
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
              logs={logs}
              onToggleRead={handleToggleReadLog}
              onClearLog={handleClearLog}
              onMarkAllRead={handleMarkAllRead}
              onFetchOlderLogs={handleFetchOlderLogs}
              searchQuery={searchQuery}
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
              userEmail={userEmail} 
              currentUser={currentUser}
              stats={stats}
              onResetStats={handleResetStats}
              isDarkMode={isDarkMode}
              feedItems={feedItems}
              userDecks={decks}
              onStudyDeck={(deckName) => {
                setActiveStudyDeck(deckName);
                setActiveStudyDeckId(decks.find(d => d.title === deckName)?.id ?? null);
                setIsActiveStudyDeckPublic(true);
                setActiveTab("study");
              }}
            />
          )}

          {activeTab === "user-profile" && selectedProfileUsername && (
            <UserProfileView 
              username={selectedProfileUsername}
              onClose={() => {
                setSelectedProfileUsername(null);
                setActiveTab("feed");
              }}
              feedItems={feedItems}
              userDecks={decks}
              onToggleFollow={handleToggleFollow}
              onStudyDeck={(deckName) => {
                setActiveStudyDeck(deckName);
                setActiveStudyDeckId(decks.find(d => d.title === deckName)?.id ?? null);
                setIsActiveStudyDeckPublic(true);
                setActiveTab("study");
              }}
              userEmail={userEmail}
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
                setActiveTab("explore");
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
                  setActiveTab(btn.id);
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

      {/* Slide-In AI Assistant Terminal Side-Panel Drawer */}
      {showAiAssistant && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-black border-l border-[#1A1A1A] z-50 flex flex-col justify-between shadow-2xl animated slideInRight">
          <header className="p-4 border-b border-[#1A1A1A] flex items-center justify-between bg-surface">
            <div className="flex items-center gap-2">
              <TerminalIcon className="w-4 h-4 text-white" />
              <span className="text-xs font-mono font-bold tracking-wider text-white">INTELLIGENCE TERMINAL</span>
            </div>
            <button 
              onClick={() => setShowAiAssistant(false)}
              className="text-on-surface-variant hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {aiMessages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`p-3 border rounded-xs text-xs space-y-1 ${
                  msg.sender === "user" 
                    ? "bg-[#111111] border-[#1a1a1a] text-white ml-6 font-sans text-right" 
                    : "bg-[#0e0e0e] border-[#1a1a1a] text-on-surface mr-6 font-mono font-light text-left"
                }`}
              >
                {msg.sender === "bot" && (
                  <span className="text-[9px] text-white font-bold uppercase tracking-widest block">
                    node-assistant //
                  </span>
                )}
                <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendAiMessage} className="p-4 border-t border-[#1A1A1A] bg-[#0e0e0e] flex gap-2">
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ask about monads, streaks, or DB index types..."
              className="flex-1 bg-black text-xs p-2 border border-[#1A1A1A] rounded-xs focus:border-white focus:ring-0 outline-none text-white font-mono"
            />
            <button type="submit" className="p-2 bg-white hover:bg-neutral-200 text-black border border-white font-bold rounded-xs cursor-pointer">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

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
