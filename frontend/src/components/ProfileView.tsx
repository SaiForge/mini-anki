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
import { uploadAvatar, resolveMediaUrl } from "../api/uploadApi";

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
  avatarUrl: string;
  tags: string[];
  followers: number;
  following: number;
}

const AVATAR_PRESETS = [
  { id: "synth", label: "Synthwave", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80" },
  { id: "obsidian", label: "Obsidian", url: "https://images.unsplash.com/photo-1618005198143-e5283b519a7f?w=150&auto=format&fit=crop&q=80" },
  { id: "amber", label: "Aura", url: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=150&auto=format&fit=crop&q=80" },
  { id: "nebula", label: "Nebula", url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=150&auto=format&fit=crop&q=80" },
  { id: "user_original", label: "Original", url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDL6PO85wdDFKsVML2LXXpJBdHNX41Jo4OTHzknvlMQ3o6WwYZ_3DqYVzxckDKH3qd3TYBnhY32-6D3cADyWKHKBGIpUhLFlkt2XL3EHIgrufopv69gtz6WoD59u5ZszSaTVYzpX_84EegyZnAhOXXDIaREBC8m2hcxBzZAQcYLPs3ucyxZKgOaK8XPXNZgzzP2pfctpIQj-qHjjn6swdDzwLtw2glyyma4LaSY79elyfhxg_qTYqHkQhxko-J3VTC2b4GjFMje2FSj" }
];

export default function ProfileView({ userEmail, currentUser, onProfileUpdate, stats, onResetStats, isDarkMode = true, feedItems, userDecks, onStudyDeck, onDeletePost, currentUserId, currentUsername }: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [newTagInput, setNewTagInput] = useState<string>("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
      avatarUrl: AVATAR_PRESETS[4].url,
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
      avatarUrl: currentUser.profile_picture_url || prev.avatarUrl,
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
        profile_picture_url: draft.avatarUrl,
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

  // Phase 5: Avatar file upload handler
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const url = await uploadAvatar(file);
      const resolved = resolveMediaUrl(url);
      setProfile(prev => ({ ...prev, avatarUrl: resolved }));
      setDraft(prev => ({ ...prev, avatarUrl: resolved }));
      if (onProfileUpdate && currentUser) {
        onProfileUpdate({ ...currentUser, profile_picture_url: resolved });
      }
      setSuccessMsg("Avatar updated successfully.");
      setTimeout(() => setSuccessMsg(""), 2000);
    } catch (err: any) {
      alert("Upload failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const addTag = () => {
    const cleaned = newTagInput.trim();
    if (cleaned && !draft.tags.includes(cleaned)) {
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
    <div id="profile-view-container" className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-8 pb-32">
      
      {/* Top action status feedback */}
      {successMsg && (
        <div id="success-banner" className="py-2.5 px-4 bg-white/10 border border-white/20 text-white text-xs font-mono rounded-xs animate-fadeIn flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="text-white/60 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Card Element */}
      <div id="profile-card" className="w-full">
        
        {/* Read Mode Content */}
        {!isEditing ? (
          <div className="space-y-6 pt-4">
            
            {/* Instagram Style Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-10 text-center sm:text-left">
              
              {/* Avatar Column */}
              <div className="flex-shrink-0">
                {/* Hidden file input for avatar upload */}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <div
                  className="relative w-24 h-24 sm:w-36 sm:h-36 group cursor-pointer mx-auto sm:mx-0"
                  onClick={() => avatarInputRef.current?.click()}
                  title="Click to upload new profile picture"
                >
                  <img 
                    id="profile-avatar"
                    alt="Developer Profile Avatar" 
                    className="w-full h-full rounded-full border border-[#1A1A1A] object-cover bg-black"
                    src={profile.avatarUrl}
                    referrerPolicy="no-referrer"
                  />
                  <div className={`absolute inset-0 rounded-full flex items-center justify-center transition-all ${
                    isUploadingAvatar
                      ? "bg-black/60"
                      : "bg-black/0 group-hover:bg-black/50"
                  }`}>
                    {isUploadingAvatar ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>
              </div>

              {/* Info Column */}
              <div className="flex-1 w-full space-y-4 sm:space-y-5">
                
                {/* 1. Full Name and Buttons */}
                <div className="flex items-start justify-between w-full gap-4">
                  <h2 id="profile-display-name" className="text-2xl sm:text-3xl font-bold text-white font-sans truncate flex items-baseline justify-center sm:justify-start gap-3">
                    {profile.name}
                    <span className="font-medium text-zinc-400 uppercase text-xs tracking-wider">{profile.role}</span>
                  </h2>
                  <button
                    id="edit-profile-toggle"
                    onClick={() => setIsEditing(true)}
                    className="p-2 -mr-2 sm:mr-0 hover:bg-[#262626] text-zinc-400 hover:text-white rounded-lg transition-all flex-shrink-0"
                    title="Edit Profile"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                </div>

                {/* 2. Username */}
                <div className="text-center sm:text-left text-base text-zinc-400 font-sans font-medium -mt-2">
                  @{currentUser?.username || userEmail.split("@")[0]}
                </div>

                {/* 3. Stats Row */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-6 gap-y-3 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white font-sans text-base">{publicPosts.length}</span>
                    <span className="text-[15px] text-zinc-300 font-sans">posts</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white font-sans text-base">{publicDecks.length}</span>
                    <span className="text-[15px] text-zinc-300 font-sans">decks</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white font-sans text-base">{profile.followers}</span>
                    <span className="text-[15px] text-zinc-300 font-sans">followers</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white font-sans text-base">{profile.following}</span>
                    <span className="text-[15px] text-zinc-300 font-sans">following</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white font-sans text-base">{currentUser?.current_streak ?? stats.dailyStreak}</span>
                    <span className="text-[15px] text-zinc-300 font-sans flex items-center gap-1"><Flame className="w-4 h-4 text-orange-500" /> streak</span>
                  </div>
                </div>

                {/* 4. Bio Section */}
                <div className="space-y-3 text-sm font-sans pt-2">
                  <p className="text-white whitespace-pre-wrap max-w-lg mx-auto sm:mx-0 text-center sm:text-left text-[15px] leading-relaxed">
                    {profile.bio || "No biography provided. Click Edit Profile to set up your developer synopsis."}
                  </p>
                  
                  {/* 5. Expertise Tags */}
                  {profile.tags.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-2 pt-2">
                      {profile.tags.map((tag, idx) => (
                        <span key={idx} className="text-xs text-blue-300 hover:text-blue-200 font-sans cursor-pointer transition-colors bg-[#112240] border border-[#233554] px-2.5 py-1 rounded-md">
                          #{tag.replace(/\s+/g, '')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

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

              {/* Avatar Selector Column */}
              <div className="space-y-6 md:border-r md:border-[#1A1A1A] md:pr-6">
                <div>
                  <Label className="text-left mb-1.5" isDarkMode={isDarkMode}>Selected Avatar</Label>
                  <div className="flex justify-center p-4">
                    <img 
                      alt="Avatar Draft Preview" 
                      className="w-20 h-20 rounded-full border-2 border-white object-cover bg-black"
                      src={draft.avatarUrl || AVATAR_PRESETS[4].url}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = AVATAR_PRESETS[4].url;
                      }}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-left mb-2" isDarkMode={isDarkMode}>Preset Artwork</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {AVATAR_PRESETS.map((ap) => (
                      <button
                        key={ap.id}
                        type="button"
                        title={ap.label}
                        onClick={() => setDraft({ ...draft, avatarUrl: ap.url })}
                        className={`w-9 h-9 rounded-full overflow-hidden border transition-all relative cursor-pointer ${
                          draft.avatarUrl === ap.url 
                            ? "border-primary scale-110 shadow-none border-2" 
                            : "border-transparent hover:border-outline-variant"
                        }`}
                      >
                        <img src={ap.url} className="w-full h-full object-cover" alt={ap.label} referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-left mb-1" isDarkMode={isDarkMode}>Custom Image URL</Label>
                  <Input
                    type="url"
                    id="edit-avatar-url"
                    value={draft.avatarUrl}
                    onChange={(e) => setDraft({ ...draft, avatarUrl: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    isDarkMode={isDarkMode}
                    className="text-left"
                  />
                </div>
              </div>

              {/* General Fields Column */}
              <div className="md:col-span-2 space-y-4">
                
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
                    maxLength={300}
                    rows={3}
                    placeholder="Describe your primary development paradigms and focus areas..."
                    className={cn(
                      "w-full rounded-sm px-3 py-2 text-sm focus:outline-none transition-colors font-sans resize-none",
                      isDarkMode
                        ? "bg-transparent border border-[#1A1A1A] focus:border-white placeholder:text-on-surface-variant/50 text-white"
                        : "bg-transparent border border-[#c9ada7] focus:border-[#22223b] placeholder:text-[#4a4e69]/50 text-[#22223b]"
                    )}
                  />
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
                      placeholder="Add learning focus (e.g. Docker, TypeScript)"
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
                      className="px-3"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <span className="text-[9px] font-mono text-on-surface-variant/50 uppercase block">Press Enter or click (+) to push focus values. Click tag to incinerate.</span>
                </div>

              </div>

            </div>

          </form>
        )}

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
      <div className="mt-4 pb-32">
        {activeSubTab === "POSTS" ? (
          <div className="space-y-4 pb-4">
            {publicPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <Grid className="w-12 h-12 mb-4" />
                <p className="text-sm font-sans">No concepts published yet.</p>
              </div>
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
                <Layers className="w-12 h-12 mb-4" />
                <p className="text-sm font-sans">No decks published yet.</p>
              </div>
            ) : (
              publicDecks.slice(0, displayLimit).map((deck) => (
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
                ))
              )}
              {publicDecks.length > displayLimit && (
                 <div ref={loadMoreRef} className="py-6 text-center text-xs text-zinc-500 font-mono flex justify-center"><div className="w-4 h-4 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>
              )}
            </div>
          )}
        </div>    </div>
  );
}
