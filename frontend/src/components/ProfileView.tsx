import React, { useState, useEffect, useRef } from "react";
import { 
  User, 
  Flame, 
  Trophy, 
  Cpu, 
  RefreshCw,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  Clock,
  BookOpen,
  Camera,
  Grid,
  Layers,
  Settings
} from "lucide-react";
import { StudyStats, FeedItem, StudyDeck } from "../types";
import { FeedCard } from "./cards/FeedCard";
import { Users, ArrowUpRight } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Label } from "./ui/Label";
import { cn } from "../lib/utils";
import { UserResponse, updateMe } from "../api/authApi";
import { getFollowers, getFollowing } from "../api/socialApi";

interface ProfileViewProps {
  userEmail: string;
  currentUser?: UserResponse | null;
  onProfileUpdate?: (updatedUser: UserResponse) => void;
  stats: StudyStats;
  onResetStats: () => void;
  isDarkMode?: boolean;
  feedItems: FeedItem[];
  userDecks: StudyDeck[];
  onStudyDeck: (deckName: string, deckId?: string) => void;
  onDeletePost?: (id: string) => void;
  currentUserId?: string;
  currentUsername?: string;
}

interface ProfileData {
  name: string;
  role: string;
  bio: string;
  tags: string[];
  followers: number;
  following: number;
}



export default function ProfileView({ userEmail, currentUser, onProfileUpdate, stats, onResetStats, isDarkMode = true, feedItems, userDecks, onStudyDeck, onDeletePost, currentUserId, currentUsername }: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [newTagInput, setNewTagInput] = useState<string>("");

  const [activeSubTab, setActiveSubTab] = useState<"POSTS" | "DECKS">("POSTS");
  const [revealedItems, setRevealedItems] = useState<Record<string, boolean>>({});
  
  // Lazy loading state
  const [displayLimit, setDisplayLimit] = useState(10);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Filter: public posts are only from the logged-in user (by real username or email handle)
  const myUsername = currentUser?.username
    ? `@${currentUser.username}`
    : userEmail ? `@${userEmail.split("@")[0]}` : null;
  const publicPosts = feedItems.filter(
    item => !item.isPrivate && (myUsername ? item.authorUsername === myUsername : false)
  );

  // Filter: public decks are those explicitly marked as public, excluding the default "Today's Review"
  const publicDecks = userDecks.filter(
    deck => deck.isPublic && !deck.title.includes("Today's Review")
  );

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
  }, [activeSubTab, publicPosts, publicDecks]);

  const handleToggleReveal = (id: string) => {
    setRevealedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };


  // Load custom profile state, seeding from real backend user if available
  const [profile, setProfile] = useState<ProfileData>({
      name: userEmail.split("@")[0],
      role: "Developer",
      bio: "No biography provided. Click Edit Profile to set up your developer synopsis.",
      tags: [],
      followers: 0,
      following: 0
  });

  // When currentUser arrives from the API, hydrate the profile
  useEffect(() => {
    if (!currentUser) return;
    setProfile(prev => ({
      ...prev,
      name: currentUser.full_name || currentUser.username || prev.name,
      bio: currentUser.bio || prev.bio,
      tags: currentUser.tags || prev.tags,
      role: currentUser.role || prev.role,
      followers: currentUser.followers_count !== undefined ? currentUser.followers_count : prev.followers,
      following: currentUser.following_count !== undefined ? currentUser.following_count : prev.following,
    }));

  }, [currentUser]);

  // Keep temporary draft values while editing
  const [draft, setDraft] = useState<ProfileData>({ ...profile });

  // Reset drafts whenever edit mode is toggled on
  useEffect(() => {
    if (isEditing) {
      setDraft({ ...profile });
    }
  }, [isEditing, profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updatedUser = await updateMe({
        full_name: draft.name,
        role: draft.role,
        bio: draft.bio,
        tags: draft.tags,
      });
      setProfile(draft);
      if (onProfileUpdate) {
        onProfileUpdate(updatedUser);
      }
      setIsEditing(false);
      setSuccessMsg("Profile variables stored successfully.");
      setTimeout(() => setSuccessMsg(""), 2000);
    } catch (err: any) {
      alert("Failed to update profile: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetStatsClick = () => {
    onResetStats();
    setSuccessMsg("Metrics ledger vacuumed completely.");
    setTimeout(() => setSuccessMsg(""), 2000);
  };

  const addTag = () => {
    const cleaned = newTagInput.trim();
    if (cleaned && !draft.tags.includes(cleaned) && draft.tags.length < 10) {
      setDraft({
        ...draft,
        tags: [...draft.tags, cleaned]
      });
      setNewTagInput("");
    }
  };

  const removeTag = (indexToRemove: number) => {
    setDraft({
      ...draft,
      tags: draft.tags.filter((_, idx) => idx !== indexToRemove)
    });
  };

  return (
    <div id="profile-view-container" className={`w-full min-h-screen pb-32 ${isDarkMode ? 'bg-transparent text-white' : 'bg-transparent text-[#2d3142]'}`}>
      
      {/* Top action status feedback */}
      {successMsg && (
        <div id="success-banner" className="py-2.5 px-4 bg-white/10 border border-white/20 text-white text-xs font-mono rounded-xs animate-fadeIn flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="text-white/60 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Profile Section */}
      <div id="profile-card" className="w-full max-w-[640px] mx-auto relative">
        
        {/* Read Mode Content */}
        {!isEditing ? (
          <div>
            {/* Top Action Bar (Edit Button) */}
            <div className="flex justify-end pt-4 pr-4 sm:pr-6">
              <button
                onClick={() => setIsEditing(true)}
                className={`transition-all p-2 rounded-full z-10 ${isDarkMode ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-[#ede8e3]/80 hover:bg-[#ede8e3] text-[#2d3142]'}`}
                title="Edit Profile"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Content */}
            <div className="px-4 sm:px-6 pb-6 pt-2">
              
              {/* Instagram-style Avatar & Stats Row */}
              <div className="flex items-center justify-between mb-4 gap-4">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 flex items-center justify-center shadow-sm ${isDarkMode ? 'bg-[#0f1115] border-[#0f1115]' : 'bg-[#ede8e3] border-[#ede8e3]'}`}>
                    <span className={`text-3xl sm:text-4xl font-semibold ${isDarkMode ? 'text-zinc-200' : 'text-[#2d3142]'}`}>
                      {profile.name ? profile.name.charAt(0).toUpperCase() : "U"}
                    </span>
                  </div>
                  {/* Streak Badge */}
                  <div className={`absolute -bottom-2 -right-2 rounded-xl px-2 py-1 flex items-center gap-1 shadow-md ${isDarkMode ? 'bg-zinc-800 border-[2.5px] border-[#0a0a0a]' : 'bg-[#2d3142]'}`}>
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span className={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-[#ffffff]'}`}>{currentUser?.current_streak ?? stats.dailyStreak}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-4 sm:gap-6 justify-around flex-1 pl-2 sm:pl-8">
                  <div className="flex flex-col items-center">
                    <span className={`text-lg sm:text-xl font-bold ${isDarkMode ? 'text-white' : 'text-[#2d3142]'}`}>{publicPosts.length}</span>
                    <span className={`text-[10px] sm:text-xs font-medium ${isDarkMode ? 'text-zinc-500' : 'text-[#2d3142]/60'}`}>posts</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className={`text-lg sm:text-xl font-bold ${isDarkMode ? 'text-white' : 'text-[#2d3142]'}`}>{profile.followers >= 1000 ? `${(profile.followers / 1000).toFixed(1)}k` : profile.followers}</span>
                    <span className={`text-[10px] sm:text-xs font-medium ${isDarkMode ? 'text-zinc-500' : 'text-[#2d3142]/60'}`}>followers</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className={`text-lg sm:text-xl font-bold ${isDarkMode ? 'text-white' : 'text-[#2d3142]'}`}>{profile.following}</span>
                    <span className={`text-[10px] sm:text-xs font-medium ${isDarkMode ? 'text-zinc-500' : 'text-[#2d3142]/60'}`}>following</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className={`text-lg sm:text-xl font-bold ${isDarkMode ? 'text-white' : 'text-[#2d3142]'}`}>{publicDecks.length}</span>
                    <span className={`text-[10px] sm:text-xs font-medium ${isDarkMode ? 'text-zinc-500' : 'text-[#2d3142]/60'}`}>decks</span>
                  </div>
                </div>
              </div>

              {/* User Info */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-[#2d3142]'}`}>{profile.name}</h2>
                  {profile.role && (
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full tracking-wider uppercase ${isDarkMode ? 'bg-[#1c1f26] text-zinc-400' : 'bg-[#2d3142] text-[#ffffff]'}`}>
                      {profile.role}
                    </span>
                  )}
                </div>

                <p className={`text-sm font-medium ${isDarkMode ? 'text-zinc-600' : 'text-[#2d3142]/50'}`}>@{currentUser?.username || userEmail.split("@")[0]}</p>

                {/* Bio Card */}
                {(profile.bio || profile.tags.length > 0) && (
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="w-full">
                      {profile.bio && (
                        <>
                          <p className={`text-xs font-medium sm:hidden ${isDarkMode ? 'text-zinc-600' : 'text-[#2d3142]/50'}`}>Bio</p>
                          <p className={`text-sm font-semibold whitespace-pre-wrap leading-snug ${isDarkMode ? 'text-zinc-300' : 'text-[#2d3142]'}`}>{profile.bio}</p>
                        </>
                      )}
                      
                      {/* Tags */}
                      {profile.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-2">
                          {profile.tags.map((tag, idx) => (
                            <span key={idx} className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${isDarkMode ? 'bg-[#1c1f26] text-zinc-400' : 'bg-[#2d3142]/10 text-[#2d3142]/70'}`}>
                              #{tag.replace(/\s+/g, '')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        ) : (
          
          /* Interactive Edit Mode Form */
          <form id="profile-edit-form" onSubmit={handleSave} className="p-6 sm:p-8 space-y-6">
            
            <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-3">
              <span className="text-xs font-mono text-white uppercase tracking-wider font-bold">Configure Profile Variables</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  id="cancel-edit-btn"
                  variant="outline"
                  size="sm"
                  isDarkMode={isDarkMode}
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </Button>
                <Button
                  type="submit"
                  id="save-profile-btn"
                  variant="primary"
                  size="sm"
                  isDarkMode={isDarkMode}
                  className="flex items-center gap-1"
                  disabled={isSaving}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                </Button>
              </div>
            </div>

            {/* Split layout: Avatar selection & textual properties */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* General Fields Column */}
              <div className="md:col-span-3 space-y-4">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-name" className="text-left mb-1" isDarkMode={isDarkMode}>Profile Name</Label>
                    <Input
                      required
                      type="text"
                      id="edit-name"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      maxLength={40}
                      isDarkMode={isDarkMode}
                      className="text-left font-sans"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-role" className="text-left mb-1" isDarkMode={isDarkMode}>Professional Title</Label>
                    <Input
                      required
                      type="text"
                      id="edit-role"
                      value={draft.role}
                      onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                      maxLength={60}
                      isDarkMode={isDarkMode}
                      className="text-left font-sans"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="edit-bio" className="text-left mb-1" isDarkMode={isDarkMode}>Biography</Label>
                  <textarea
                    id="edit-bio"
                    value={draft.bio}
                    onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                    maxLength={160}
                    rows={3}
                    placeholder="Describe your primary development paradigms and focus areas..."
                    className={cn(
                      "w-full rounded-sm px-3 py-2 text-sm focus:outline-none transition-colors font-sans resize-none",
                      isDarkMode
                        ? "bg-transparent border border-[#1A1A1A] focus:border-white placeholder:text-on-surface-variant/50 text-white"
                        : "bg-transparent border border-[#c9ada7] focus:border-[#22223b] placeholder:text-[#4a4e69]/50 text-[#22223b]"
                    )}
                  />
                  <div className="text-right text-[10px] mt-1 text-on-surface-variant/50 font-mono">
                    {draft.bio.length} / 160
                  </div>
                </div>

                {/* Editable Tag Skill Manager */}
                <div className="space-y-2">
                  <Label className="text-left" isDarkMode={isDarkMode}>Expertise Tags Manager</Label>
                  
                  {/* Dynamic draft badges list */}
                  <div className="flex flex-wrap gap-1.5 py-2">
                    {draft.tags.length > 0 ? (
                      draft.tags.map((tag, idx) => (
                        <span 
                          key={idx} 
                          className={cn("text-xs px-2 py-0.5 rounded border font-sans transition-all flex items-center gap-1 group cursor-pointer",
                            isDarkMode 
                              ? "bg-[#111] border-neutral-800 text-white hover:border-red-900/50 hover:text-red-400 hover:bg-red-950/20"
                              : "bg-black border-[#22223b] text-white hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                          )}
                          title="Click to remove tag"
                          onClick={() => removeTag(idx)}
                        >
                          <span>{tag}</span>
                          <X className={cn("w-3 h-3 group-hover:text-red-400", isDarkMode ? "text-on-surface-variant/50" : "text-white/70")} />
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-on-surface-variant/40 italic">No expertise tags defined. Add one below.</span>
                    )}
                  </div>

                  {/* Add action segment */}
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      id="edit-tag-input"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder={draft.tags.length >= 10 ? "Maximum tags reached" : "Add learning focus (e.g. Docker, TypeScript)"}
                      disabled={draft.tags.length >= 10}
                      isDarkMode={isDarkMode}
                      className="flex-1 text-left font-sans"
                    />
                    <Button
                      type="button"
                      id="add-tag-btn"
                      variant="outline"
                      size="icon"
                      isDarkMode={isDarkMode}
                      onClick={addTag}
                      disabled={draft.tags.length >= 10}
                      className="px-3"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <span className="text-[9px] font-mono text-on-surface-variant/50 uppercase block">Press Enter or click (+) to push focus values. Max 10 tags allowed. Click tag to incinerate.</span>
                </div>

              </div>

            </div>

          </form>
        )}

      </div>

      
      {/* Bottom Content Section */}
      {!isEditing && (
        <div className="w-full max-w-[640px] mx-auto min-h-[400px]">
        
        {/* Tab Selector: Instagram Style */}
        <div className={`border-t border-b ${isDarkMode ? 'border-[#1a1a1a]' : 'border-[#1a1a1a]/10'} mt-2`}>
          <div className="flex items-center justify-center gap-12 sm:gap-16">
            <button
              onClick={() => setActiveSubTab("POSTS")}
              className={`flex items-center gap-2 py-4 text-xs font-sans font-bold tracking-widest uppercase transition-colors border-t border-transparent relative -top-px ${
                activeSubTab === "POSTS"
                  ? (isDarkMode ? "border-white text-white" : "border-[#2d3142] text-[#2d3142]")
                  : (isDarkMode ? "text-zinc-500 hover:text-zinc-300" : "text-[#2d3142]/50 hover:text-[#2d3142]/80")
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Concepts</span>
            </button>
            <button
              onClick={() => setActiveSubTab("DECKS")}
              className={`flex items-center gap-2 py-4 text-xs font-sans font-bold tracking-widest uppercase transition-colors border-t border-transparent relative -top-px ${
                activeSubTab === "DECKS"
                  ? (isDarkMode ? "border-white text-white" : "border-[#2d3142] text-[#2d3142]")
                  : (isDarkMode ? "text-zinc-500 hover:text-zinc-300" : "text-[#2d3142]/50 hover:text-[#2d3142]/80")
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Decks</span>
            </button>
          </div>
        </div>

        {/* TAB CONTENTS */}
        <div className="mt-4 pb-32 px-4 sm:px-6">
          {activeSubTab === "POSTS" ? (
          <div className="space-y-4 pb-4">
            {publicPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <Grid className={`w-12 h-12 mb-4 ${isDarkMode ? 'text-zinc-500' : 'text-[#2d3142]'}`} />
                <p className={`text-sm font-sans ${isDarkMode ? 'text-white' : 'text-[#2d3142]'}`}>No concepts published yet.</p>
              </div>
            ) : (
              publicPosts.slice(0, displayLimit).map((post) => (
                <FeedCard
                  key={post.id}
                  isDarkMode={isDarkMode}
                  viewMode="feed"
                  feedItem={post}
                  isSingle={false}
                  hideHeader={true}
                  currentStep={revealedItems[post.id] ? 2 : 0}
                  maxSteps={2}
                  onToggleReveal={() => handleToggleReveal(post.id)}
                  onDeletePost={onDeletePost}
                  currentUsername={currentUser?.username || undefined}
                />
              ))
            )}
            {publicPosts.length > displayLimit && (
               <div ref={loadMoreRef} className="py-6 text-center text-xs text-zinc-500 font-mono flex justify-center"><div className="w-4 h-4 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>
            )}
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {publicDecks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <Layers className={`w-12 h-12 mb-4 ${isDarkMode ? 'text-zinc-500' : 'text-[#2d3142]'}`} />
                <p className={`text-sm font-sans ${isDarkMode ? 'text-white' : 'text-[#2d3142]'}`}>No public decks available.</p>
              </div>
            ) : (
              publicDecks.slice(0, displayLimit).map((deck) => (
                  <div 
                    key={deck.id}
                    className={`p-5 border rounded-xl hover:border-outline transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative ${isDarkMode ? 'bg-[#16181d] border-[#1c1f26]' : 'bg-[#fcfaf9] border-[#ede8e3]'}`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0 pr-16">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono border px-1.5 py-0.5 rounded tracking-wide font-bold uppercase ${isDarkMode ? 'border-zinc-700 text-zinc-400' : 'border-[#d6ccc2] text-[#8e857c]'}`}>
                          {deck.category}
                        </span>
                      </div>
                      <h4 className={`text-sm font-semibold font-sans ${isDarkMode ? 'text-white' : 'text-[#2d3142]'}`}>{deck.title}</h4>
                      <p className={`text-xs font-light leading-relaxed font-sans line-clamp-2 break-all ${isDarkMode ? 'text-zinc-400' : 'text-[#8e857c]'}`}>{deck.description}</p>
                    </div>

                    <div className="absolute top-5 right-5">
                      <span className={`text-[10px] font-mono uppercase ${isDarkMode ? 'text-zinc-500' : 'text-[#8e857c]'}`}>{deck.cardCount || deck.cards?.length || 0} cards</span>
                    </div>

                    <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0 sm:items-end self-end">
                      <button
                        onClick={() => {
                          onStudyDeck(deck.title, deck.id);
                        }}
                        className={`text-xs font-mono px-3 py-1.5 rounded-xs transition-colors flex items-center gap-1 cursor-pointer font-bold ${isDarkMode ? 'bg-white text-black hover:bg-zinc-200' : 'bg-[#2d3142] text-[#ffffff] hover:bg-[#1a1c25]'}`}
                      >
                        <span>Study</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
              {publicDecks.length > displayLimit && (
                 <div ref={loadMoreRef} className="py-6 text-center text-xs text-zinc-500 font-mono flex justify-center"><div className="w-4 h-4 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>
              )}
          </div>
        )}
      </div>
        </div>
      )}
    </div>
  );
}
