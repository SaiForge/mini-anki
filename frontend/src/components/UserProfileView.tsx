import { useState, useMemo } from "react";
import { 
  X, 
  Flame, 
  Users, 
  Terminal, 
  BookOpen, 
  Sparkles, 
  Code, 
  Share2, 
  Heart, 
  CheckCircle2, 
  UserPlus, 
  UserCheck,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowLeft,
  Grid,
  MessageSquare
} from "lucide-react";
import { FeedItem, StudyDeck } from "../types";
import { FeedCard } from "./cards/FeedCard";
import { useEffect, useRef } from "react";
import { getPublicProfile, followUser, unfollowUser, checkIsFollowing } from "../api/socialApi";
import { getUserPosts, PostResponse, likePost, unlikePost } from "../api/feedApi";
import { getPublicUserDecks, mapApiDeckToStudyDeck, ApiDeck } from "../api/deckApi";

interface UserProfileViewProps {
  username: string;
  onClose: () => void;
  feedItems: FeedItem[];
  userDecks: StudyDeck[];
  onToggleFollow: (username: string) => void;
  onStudyDeck: (deckName: string, deckId?: string) => void;
  onImportDeck?: (deck: any) => void;
  onDeletePost?: (postId: string) => void;
  userEmail?: string;
  currentUserId?: string;
  currentUsername?: string;
  onMessageClick?: (user: { user_id: string; username: string; full_name: string | null; avatar_url: string | null }) => void;
}

// Preset metadata for system authors
const SYSTEM_PROFILES: Record<string, {
  name: string;
  bio: string;
  avatar: string;
  avatarBg: string;
  streak: number;
  followers: number;
  following: number;
  customAvatarUrl?: string;
  decks: {
    id: string;
    title: string;
    description: string;
    cardCount: number;
    category: string;
    iconType: string;
    progress: number;
    cards: { id: string; question: string; answer: string; details?: string }[];
  }[];
}> = {
  "@james_clear": {
    name: "James Clear",
    bio: "Author of Atomic Habits. Optimizing human behavior, cognitive feedback loops, and daily system thresholds.",
    avatar: "JC",
    avatarBg: "bg-amber-950/40 border-amber-800 text-amber-200",
    streak: 42,
    followers: 12400,
    following: 122,
    decks: [
      {
        id: "j-deck-1",
        title: "Atomic Habit Loops",
        description: "Cue, craving, response, and reward reinforcement loops for system-level learning.",
        cardCount: 3,
        category: "BEHAVIOR",
        iconType: "brain",
        progress: 80,
        cards: [
          {
            id: "jc-1",
            question: "What are the Four Laws of Behavior Change?",
            answer: "1. Make it obvious, 2. Make it attractive, 3. Make it easy, 4. Make it satisfying.",
            details: "To break a bad habit, invert these: make it invisible, unattractive, difficult, and unsatisfying."
          },
          {
            id: "jc-2",
            question: "Define the term 'Identity-Based Habits'.",
            answer: "Habits built by focusing on who you wish to become, rather than what you want to achieve.",
            details: "The ultimate form of intrinsic motivation is when a habit becomes part of your identity (e.g. 'I am a writer' vs 'I want to write')."
          },
          {
            id: "jc-3",
            question: "Explain the Plateau of Latent Potential.",
            answer: "The period where small changes appear to make no difference until you cross a critical threshold to unleash progress.",
            details: "Early work is not wasted; it is stored, like heating an ice cube from 25 to 31 degrees."
          }
        ]
      }
    ]
  },
  "@alexchen": {
    name: "Alex Chen",
    bio: "Systems architect, Rustacean, compiler enthusiast. Deeply passionate about low-level concurrency and V8 event loops.",
    avatar: "AC",
    avatarBg: "bg-blue-950/40 border-blue-800 text-blue-200",
    streak: 12,
    followers: 842,
    following: 92,
    decks: [
      {
        id: "deck-1",
        title: "Systems Architecture",
        description: "Distributed systems, microservices, and high-availability design patterns.",
        cardCount: 3,
        category: "SYSTEMS",
        iconType: "terminal",
        progress: 65,
        cards: [] // Will link to standard in app
      },
      {
        id: "deck-2",
        title: "ECMAScript Internals",
        description: "V8 engine, garbage collection, optimization techniques, and event loop mechanics.",
        cardCount: 2,
        category: "WEB",
        iconType: "terminal",
        progress: 12,
        cards: []
      }
    ]
  },
  "@sophialind": {
    name: "Sophia Lind",
    bio: "Curating simplicity in digital designs, high-contrast visual systems, structural typography and computational aesthetics.",
    avatar: "SL",
    avatarBg: "bg-purple-950/40 border-purple-800 text-purple-200",
    streak: 32,
    followers: 2500,
    following: 310,
    decks: [
      {
        id: "sophia-deck-1",
        title: "Typography & Grid Systems",
        description: "The Swiss design manual for digital interfaces. Focus on 8px grid and modular layout scaling principles.",
        cardCount: 2,
        category: "DESIGN",
        iconType: "science",
        progress: 45,
        cards: [
          {
            id: "sl-1",
            question: "Why is the 8px grid preferred in digital UI design?",
            answer: "Because most screen resolutions are divisible by 8, simplifying layout scaling and consistency across devices.",
            details: "It creates an aesthetic balance between padding, margins, and line heights."
          },
          {
            id: "sl-2",
            question: "Define the visual technique 'Negative Space' or White Space.",
            answer: "The empty area around or between design elements, used to provide breathing room and draw focus to what's important.",
            details: "Negative space is an active design element, not just empty space."
          }
        ]
      }
    ]
  },
  "@alan_kay": {
    name: "Alan Kay",
    bio: "Pioneer of OOP, Smalltalk, computer systems, and GUIs. Predicting the future of computing by inventing it.",
    avatar: "AK",
    avatarBg: "bg-emerald-950/40 border-emerald-800 text-emerald-200",
    streak: 50,
    followers: 51200,
    following: 8,
    decks: [
      {
        id: "deck-4",
        title: "Cybersecurity Protocols",
        description: "OAuth2 flow delegation, JWT hardening practices, cryptographic keys, and token mitigation.",
        cardCount: 2,
        category: "SECURITY",
        iconType: "security",
        progress: 45,
        cards: []
      }
    ]
  },
  "@dev_grump": {
    name: "Dev Grump",
    bio: "Husband, father, and sarcastic compiler developer. Making fun of architectural bloat, JS frameworks, and light mode.",
    avatar: "DG",
    avatarBg: "bg-red-950/40 border-red-800 text-red-200",
    streak: 3,
    followers: 940,
    following: 45,
    decks: [
      {
        id: "deck-jokes",
        title: "Developer Humor",
        description: "A library of funny computer science puns and programmer developer jokes.",
        cardCount: 3,
        category: "JOKES",
        iconType: "brain",
        progress: 60,
        cards: []
      }
    ]
  },
  "@riddler": {
    name: "Riddle Maker",
    bio: "Crafting debugging puzzles, logic traps, and binary brain teasers to sharpen human diagnostic networks.",
    avatar: "RM",
    avatarBg: "bg-zinc-900 border-zinc-700 text-zinc-100",
    streak: 22,
    followers: 1210,
    following: 2,
    decks: [
      {
        id: "deck-riddles",
        title: "Logic Riddles",
        description: "Clever riddles and logical math puzzles to sharpen your debugging brain.",
        cardCount: 3,
        category: "RIDDLES",
        iconType: "science",
        progress: 40,
        cards: []
      }
    ]
  },
  "@cleancoder": {
    name: "CleanCoder",
    bio: "Adherent of SOLID principles, pristine code systems, test-driven dev (TDD), refactoring guides, and elegant abstractions.",
    avatar: "CC",
    avatarBg: "bg-teal-950/40 border-teal-800 text-teal-200",
    streak: 85,
    followers: 3410,
    following: 140,
    decks: [
      {
        id: "deck-3",
        title: "PostgreSQL Optimization",
        description: "Index tuning, lock types, EXPLAIN ANALYZE execution pipelines, and vacuuming strategies.",
        cardCount: 2,
        category: "DATABASE",
        iconType: "database",
        progress: 88,
        cards: []
      }
    ]
  },
  "@kolarsaibag": {
    name: "Sai Bag",
    bio: "Researching systems architectures, study engines, and custom telemetry structures.",
    avatar: "SB",
    avatarBg: "bg-neutral-900 border-zinc-700 text-white",
    streak: 42,
    followers: 24,
    following: 130,
    decks: []
  }
};

export default function UserProfileView({
  username,
  onClose,
  feedItems,
  userDecks,
  onToggleFollow,
  onStudyDeck,
  onImportDeck,
  onDeletePost,
  userEmail,
  currentUserId,
  currentUsername,
  onMessageClick
}: UserProfileViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"POSTS" | "DECKS">("POSTS");
  const [revealedItems, setRevealedItems] = useState<Record<string, boolean>>({});
  const [copiedLinkPostId, setCopiedLinkPostId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<Record<string, boolean>>({});

  // Lazy loading state
  const [displayLimit, setDisplayLimit] = useState(10);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisplayLimit(10); // reset when tab changes
  }, [activeSubTab]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayLimit((prev) => prev + 10);
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [activeSubTab]);

  const [remoteUser, setRemoteUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowedStatus, setIsFollowedStatus] = useState(false);
  const [followProcessing, setFollowProcessing] = useState(false);
  const [userPosts, setUserPosts] = useState<PostResponse[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [remoteDecks, setRemoteDecks] = useState<ApiDeck[]>([]);

  useEffect(() => {
    let active = true;
    const fetchUser = async () => {
      setLoading(true);
      try {
        const u = await getPublicProfile(username);
        if (active) {
          setRemoteUser(u);
          const followData = await checkIsFollowing(u.user_id);
          setIsFollowedStatus(followData.is_following);
          // Fetch this user's posts from backend
          setPostsLoading(true);
          try {
            const posts = await getUserPosts(u.user_id, 0, 30);
            if (active) setUserPosts(posts);
          } catch (e) {
            console.warn("Could not load user posts", e);
          } finally {
            if (active) setPostsLoading(false);
          }

          // Fetch this user's public decks from backend
          try {
            const decks = await getPublicUserDecks(u.user_id);
            if (active) setRemoteDecks(decks);
          } catch (e) {
            console.warn("Could not load user decks", e);
          }
        }
      } catch (err) {
        console.warn("Failed to load user profile via API, falling back to mock", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchUser();
    return () => { active = false; };
  }, [username]);

  // Resolve user information dynamically
  const userDetails = useMemo(() => {
    if (remoteUser) {
      return {
        id: remoteUser.user_id,
        name: remoteUser.full_name || remoteUser.username,
        bio: remoteUser.bio || "No biography provided.",
        avatar: remoteUser.full_name ? remoteUser.full_name.substring(0,2).toUpperCase() : remoteUser.username.substring(0,2).toUpperCase(),
        avatarBg: "bg-neutral-900 border-zinc-700 text-white",
        streak: remoteUser.current_streak || 0,
        followers: remoteUser.followers_count || 0,
        following: remoteUser.following_count || 0,
        customAvatarUrl: remoteUser.profile_picture_url,
        role: remoteUser.role || "RESEARCH NODE",
        decks: remoteDecks.map(d => mapApiDeckToStudyDeck(d))
      };
    }

    // If logged-in user, load updated version from localStorage if present
    if (username === "@kolarsaibag") {
      const saved = localStorage.getItem("user_profile_data_custom");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return {
            name: parsed.name || "Sai Bag",
            bio: parsed.bio || "Researching systems architectures, study engines, and custom telemetry structures.",
            avatar: "SB",
            avatarBg: "bg-neutral-900 border-zinc-700 text-white",
            streak: 42,
            followers: 24,
            following: 130,
            customAvatarUrl: parsed.avatarUrl,
            role: "LOCAL STUDENT",
            decks: userDecks.map(deck => ({
              id: deck.id,
              title: deck.title,
              description: deck.description,
              cardCount: deck.cardCount,
              category: deck.category,
              iconType: deck.iconType,
              progress: deck.progress,
              cards: deck.cards
            }))
          };
        } catch (e) {
          // ignore error
        }
      }
    }

    const preset = SYSTEM_PROFILES[username];
    if (preset) {
      // For preset users, map their decks matching the main store's decks
      const resolvedDecks = preset.decks.map(presetDeck => {
        const matchingGlobal = userDecks.find(d => d.title.toLowerCase() === presetDeck.title.toLowerCase() || d.id === presetDeck.id);
        if (matchingGlobal) {
          return {
            ...presetDeck,
            id: matchingGlobal.id,
            cardCount: matchingGlobal.cardCount,
            progress: matchingGlobal.progress,
            cards: matchingGlobal.cards
          };
        }
        return presetDeck;
      });

      return {
        ...preset,
        decks: resolvedDecks
      };
    }

    // Default backup profile
    return {
      name: username.startsWith("@") ? username.substring(1) : username,
      bio: "Study block validator investigating low-level compiler abstractions and system diagnostics.",
      avatar: username.substring(1, 3).toUpperCase() || "U",
      avatarBg: "bg-zinc-900 border-zinc-800 text-white",
      streak: 7,
      followers: 120,
      following: 85,
      role: "RESEARCH NODE",
      decks: []
    };
  }, [username, userDecks, remoteUser, remoteDecks]);

  // Extract author name for follow status tracking
  const matchedFeedItem = useMemo(() => {
    return feedItems.find(item => item.authorUsername === username);
  }, [feedItems, username]);

  // Filter public posts — use backend data for remote users, feedItems for mock/self
  const publicPosts = useMemo(() => {
    if (remoteUser && userPosts.length > 0) {
      // Map PostResponse → FeedItem shape for FeedCard
      return userPosts.map(p => ({
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
        authorName: p.author_full_name || p.author_username || "",
        authorUsername: p.author_username ? `@${p.author_username}` : username,
        authorId: p.author_id,
        authorAvatar: (p.author_full_name || p.author_username || "?").substring(0, 2).toUpperCase(),
        isFollowed: isFollowedStatus,
        tags: [],
        commentsCount: p.comments_count,
      }));
    }
    return feedItems.filter(item => item.authorUsername === username);
  }, [remoteUser, userPosts, feedItems, username, isFollowedStatus]);

  // Handle local decryption flip
  const handleToggleReveal = (id: string) => {
    setRevealedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleToggleFollow = async () => {
    if (!remoteUser) return;
    setFollowProcessing(true);
    try {
      if (isFollowedStatus) {
        await unfollowUser(remoteUser.user_id);
        setIsFollowedStatus(false);
      } else {
        await followUser(remoteUser.user_id);
        setIsFollowedStatus(true);
      }
    } catch (e) {
      console.error("Failed to toggle follow", e);
    } finally {
      setFollowProcessing(false);
    }
  };

  // Helper copy link action
  const handleSharePost = (id: string, category: string, text: string) => {
    setCopiedLinkPostId(id);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}/post/${id}\n\n[${category}] ${text}`);
    }
    setTimeout(() => {
      setCopiedLinkPostId(null);
    }, 2000);
  };

  // Import a shared deck to user's library
  const handleImportDeckToMyLibrary = (deck: any) => {
    if (!onImportDeck) return;
    setImportStatus(prev => ({ ...prev, [deck.id]: true }));
    
    // Add custom helper construction
    const importedDeck = {
      id: `imported-${Date.now()}-${deck.id}`,
      category: deck.category || "IMPORTED",
      title: deck.title,
      description: deck.description,
      progress: 0,
      cardCount: deck.cardCount || deck.cards?.length || 0,
      iconType: deck.iconType || "terminal",
      cards: deck.cards || []
    };
    
    onImportDeck(importedDeck);
    
    setTimeout(() => {
      setImportStatus(prev => ({ ...prev, [deck.id]: false }));
    }, 1500);
  };

  return (
    <div className="w-full max-w-3xl mx-auto py-8 px-4 sm:px-6 relative animated fadeIn">
        
        {/* Back Action top left */}
        <button 
          id="close-profile-btn"
          onClick={onClose}
          className="mb-8 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors cursor-pointer text-xs font-mono uppercase tracking-wider"
          title="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* Main Card Element */}
        <div id="profile-card" className="w-full">
          <div className="space-y-6 pt-4">
            
            <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-10">
              {/* Avatar Section */}
              <div className="flex justify-center sm:justify-start flex-shrink-0">
                <div className="relative group">
                  {userDetails.customAvatarUrl ? (
                    <img 
                      src={userDetails.customAvatarUrl} 
                      alt={userDetails.name}
                      className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border border-[#1A1A1A] object-cover bg-black relative"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full border border-[#1A1A1A] flex items-center justify-center text-3xl font-mono font-black uppercase ${userDetails.avatarBg}`}>
                      {userDetails.avatar}
                    </div>
                  )}
                </div>
              </div>

              {/* Info Column */}
              <div className="flex-1 w-full space-y-4 sm:space-y-5">
                
                {/* 1. Full Name and Buttons */}
                <div className="flex items-start justify-between w-full gap-4">
                  <h2 id="profile-display-name" className="text-2xl sm:text-3xl font-bold text-white font-sans truncate flex items-baseline justify-center sm:justify-start gap-3">
                    {userDetails.name}
                    <span className="font-medium text-zinc-400 uppercase text-xs tracking-wider hidden sm:inline">{userDetails.role || "RESEARCH NODE"}</span>
                  </h2>
                  <div className="flex flex-row items-center gap-2 flex-shrink-0">
                    {/* Profile Follow states */}
                    {username !== "@kolarsaibag" && userEmail !== username && remoteUser && (
                      <div className="flex flex-row items-center gap-2 flex-shrink-0">
                        {!isFollowedStatus ? (
                          <button
                            onClick={handleToggleFollow}
                            disabled={followProcessing}
                            className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-on-primary text-[10px] font-mono font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <UserPlus className="w-4 h-4" />
                            <span>{followProcessing ? "..." : "Follow"}</span>
                          </button>
                        ) : (
                          <button
                            onClick={handleToggleFollow}
                            disabled={followProcessing}
                            className="px-4 py-1.5 bg-surface-container hover:bg-surface-high text-on-surface text-xs font-mono font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <UserCheck className="w-4 h-4 text-green-500" />
                            <span>{followProcessing ? "..." : "Following"}</span>
                          </button>
                        )}
                        {userDetails.id && (
                          <button
                            onClick={() => onMessageClick?.({
                              user_id: userDetails.id,
                              username: username.startsWith('@') ? username.substring(1) : username,
                              full_name: userDetails.name !== username ? userDetails.name : null,
                              avatar_url: userDetails.customAvatarUrl || null
                            })}
                            className="px-4 py-1.5 bg-surface-container hover:bg-surface-high text-on-surface text-[10px] font-mono font-bold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span>Message</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Username */}
                <div className="text-center sm:text-left text-base text-zinc-400 font-sans font-medium -mt-2">
                  @{username.startsWith("@") ? username.substring(1) : username}
                </div>

                {/* 3. Stats Row */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-6 gap-y-3 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white font-sans text-base">{publicPosts.length}</span>
                    <span className="text-[15px] text-zinc-300 font-sans">posts</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white font-sans text-base">{userDetails.decks?.length || 0}</span>
                    <span className="text-[15px] text-zinc-300 font-sans">decks</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white font-sans text-base">{userDetails.followers >= 1000 ? `${(userDetails.followers / 1000).toFixed(1)}k` : userDetails.followers}</span>
                    <span className="text-[15px] text-zinc-300 font-sans">followers</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white font-sans text-base">{userDetails.following}</span>
                    <span className="text-[15px] text-zinc-300 font-sans">following</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white font-sans text-base">{userDetails.streak}</span>
                    <span className="text-[15px] text-zinc-300 font-sans flex items-center gap-1"><Flame className="w-4 h-4 text-orange-500" /> streak</span>
                  </div>
                </div>

                {/* 4. Bio Section */}
                <div className="space-y-3 text-sm font-sans pt-2">
                  <p className="text-white whitespace-pre-wrap max-w-lg mx-auto sm:mx-0 text-center sm:text-left text-[15px] leading-relaxed">
                    {userDetails.bio || "No biography provided."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Selector: Instagram Style */}
        <div className="border-t border-[#1a1a1a] mt-10">
          <div className="flex items-center justify-center gap-12 sm:gap-16">
            <button
              onClick={() => setActiveSubTab("POSTS")}
              className={`flex items-center gap-2 py-4 text-xs font-sans font-bold tracking-widest uppercase transition-colors border-t border-transparent relative -top-px ${
                activeSubTab === "POSTS"
                  ? "border-white text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Concepts</span>
            </button>
            <button
              onClick={() => setActiveSubTab("DECKS")}
              className={`flex items-center gap-2 py-4 text-xs font-sans font-bold tracking-widest uppercase transition-colors border-t border-transparent relative -top-px ${
                activeSubTab === "DECKS"
                  ? "border-white text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Decks</span>
            </button>
          </div>
        </div>

          {/* TAB CONTENTS */}
          <div className="max-h-[340px] overflow-y-auto pr-2 scrollbar-thin">
            {activeSubTab === "POSTS" ? (
              <div className="space-y-4">
                {postsLoading ? (
                  <div className="flex items-center gap-2 py-8 justify-center">
                    <div className="w-4 h-4 border border-zinc-700 border-t-white rounded-full animate-spin" />
                    <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">Loading concepts…</p>
                  </div>
                ) : publicPosts.length === 0 ? (
                  <p className="text-xs text-on-surface-variant/35 italic">No public lab concepts detected.</p>
                ) : (
                  publicPosts.slice(0, displayLimit).map((post) => (
                    <FeedCard
                      key={post.id}
                      isDarkMode={true}
                      viewMode="feed"
                      feedItem={post}
                      isSingle={false}
                      hideHeader={true}
                      currentStep={revealedItems[post.id] ? 2 : 0}
                      maxSteps={2}
                      onToggleReveal={() => handleToggleReveal(post.id)}
                      currentUsername={currentUsername}
                    />
                  ))
                )}
                {publicPosts.length > displayLimit && (
                   <div ref={loadMoreRef} className="py-6 text-center text-xs text-zinc-500 font-mono flex justify-center"><div className="w-4 h-4 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {(!userDetails.decks || userDetails.decks.length === 0) ? (
                  <p className="text-xs text-on-surface-variant/35 italic">No public recall decks registered.</p>
                ) : (
                  userDetails.decks.slice(0, displayLimit).map((deck) => {
                    const isImported = userDecks.some(uDeck => uDeck.title.toLowerCase() === deck.title.toLowerCase());
                    return (
                      <div 
                        key={deck.id}
                        className="p-5 border border-[#1a1a1a] bg-zinc-950/20 rounded hover:border-zinc-800 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono border border-[#1A1A1A] text-zinc-400 px-1.5 py-0.5 rounded tracking-wide font-bold uppercase">
                              {deck.category}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500 uppercase">{deck.cardCount || deck.cards?.length || 0} cards</span>
                          </div>
                          <h4 className="text-sm font-semibold font-sans text-white">{deck.title}</h4>
                          <p className="text-xs text-zinc-400 font-light leading-relaxed font-sans">{deck.description}</p>
                          
                          {deck.progress > 0 && (
                            <div className="pt-2 flex items-center gap-2 max-w-[200px]">
                              <div className="h-1 bg-zinc-900 rounded-full flex-1 overflow-hidden">
                                <div 
                                  className="h-full bg-white rounded-full"
                                  style={{ width: `${deck.progress}%` }}
                                />
                              </div>
                              <span className="text-[9px] font-mono text-zinc-500">{deck.progress}% mastery</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0 sm:items-end">
                          <button
                            onClick={() => {
                              onStudyDeck(deck.title, deck.id);
                            }}
                            className="bg-white hover:bg-zinc-200 text-black text-xs font-mono px-3 py-1.5 rounded-xs transition-colors flex items-center gap-1 cursor-pointer font-bold"
                          >
                            <span>Study</span>
                            <ArrowUpRight className="w-3 h-3 text-black" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                {userDetails.decks && userDetails.decks.length > displayLimit && (
                   <div ref={loadMoreRef} className="py-6 text-center text-xs text-zinc-500 font-mono flex justify-center"><div className="w-4 h-4 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>
                )}
              </div>
            )}
          </div>
      </div>
    
  );
}
