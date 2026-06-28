import { useState, useEffect, useCallback } from "react";
import {
  Bell, Heart, MessageSquare, UserPlus, GitFork, Bookmark,
  Trash2, Check, RefreshCw, Trophy, Flame, Layers, Sparkles,
  ChevronRight, BarChart2, Loader2
} from "lucide-react";
import {
  getNotifications, markOneRead, markAllRead, deleteNotification,
  NotificationItem
} from "../api/notificationsApi";
import {
  getStudyStats, getReviewHistory, getLeaderboard,
  StudyStats, DayCount, LeaderboardEntry
} from "../api/analyticsApi";

// ─── type icon map ──────────────────────────────────────────────────────────
const TYPE_ICON: Record<string, React.ReactNode> = {
  LIKE:      <Heart className="w-3.5 h-3.5 text-red-400" />,
  COMMENT:   <MessageSquare className="w-3.5 h-3.5 text-blue-400" />,
  REPLY:     <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />,
  FOLLOW:    <UserPlus className="w-3.5 h-3.5 text-green-400" />,
  DECK_FORK: <GitFork className="w-3.5 h-3.5 text-yellow-400" />,
  BOOKMARK:  <Bookmark className="w-3.5 h-3.5 text-purple-400" />,
  SYSTEM:    <Bell className="w-3.5 h-3.5 text-zinc-400" />,
};

const ago = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const groupByDay = (notifs: NotificationItem[]) => {
  const groups: Record<string, NotificationItem[]> = {};
  for (const n of notifs) {
    const day = n.created_at ? new Date(n.created_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) : "Unknown";
    if (!groups[day]) groups[day] = [];
    groups[day].push(n);
  }
  return groups;
};

// ─── 30-day heatmap ─────────────────────────────────────────────────────────
function ReviewHeatmap({ data }: { data: DayCount[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex gap-1 flex-wrap">
      {data.map(d => {
        const intensity = d.count / max;
        const opacity = d.count === 0 ? 0.06 : 0.2 + intensity * 0.8;
        return (
          <div
            key={d.date}
            title={`${d.date}: ${d.count} cards`}
            className="w-3.5 h-3.5 rounded-sm cursor-default transition-opacity"
            style={{ backgroundColor: `rgba(255,255,255,${opacity})` }}
          />
        );
      })}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
interface NotificationsViewProps {
  onOpenUserProfile?: (username: string) => void;
  onNavigateToDecks?: () => void;
  onOpenPost?: (postId: string, openComments: boolean) => void;
  onOpenDeck?: (deckId: string) => void;
}

export default function NotificationsView({ onOpenUserProfile, onNavigateToDecks, onOpenPost, onOpenDeck }: NotificationsViewProps) {
  const [activeSection, setActiveSection] = useState<"NOTIFICATIONS" | "ANALYTICS">("NOTIFICATIONS");

  // ── Notifications state ──
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(true);

  // ── Analytics state ──
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [history, setHistory] = useState<DayCount[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadNotifs = useCallback(async () => {
    setNotifsLoading(true);
    try {
      const data = await getNotifications(0, 50);
      setNotifs(data);
    } catch (e) {
      console.warn("Failed to load notifications", e);
    } finally {
      setNotifsLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [s, h, lb] = await Promise.all([
        getStudyStats(),
        getReviewHistory(30),
        getLeaderboard(10),
      ]);
      setStats(s);
      setHistory(h);
      setLeaderboard(lb);
    } catch (e) {
      console.warn("Failed to load analytics", e);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => { loadNotifs(); }, [loadNotifs]);
  useEffect(() => {
    if (activeSection === "ANALYTICS") loadAnalytics();
  }, [activeSection, loadAnalytics]);

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleToggleRead = async (id: string) => {
    await markOneRead(id);
    setNotifs(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n));
  };

  const handleDelete = async (id: string) => {
    await deleteNotification(id);
    setNotifs(prev => prev.filter(n => n.notification_id !== id));
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;
  const grouped = groupByDay(notifs);

  return (
    <div className="max-w-[860px] mx-auto px-4 lg:px-8 py-8 pb-32 space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between border-b border-[#1A1A1A] pb-5">
        <div>
          <h1 className="text-xl font-bold text-white font-sans flex items-center gap-2.5">
            <Bell className="w-5 h-5" />
            Notifications
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-black text-[9px] font-bold font-mono">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mt-0.5">
            Social activity · Analytics · Leaderboard
          </p>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-1 p-1 border border-[#1a1a1a] rounded-lg bg-black">
          {(["NOTIFICATIONS", "ANALYTICS"] as const).map(s => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded transition-all cursor-pointer ${
                activeSection === s
                  ? "bg-white text-black font-bold"
                  : "text-zinc-500 hover:text-white"
              }`}
            >
              {s === "NOTIFICATIONS" ? "Inbox" : "Analytics"}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          NOTIFICATIONS SECTION
      ═══════════════════════════════════════════════════════════ */}
      {activeSection === "NOTIFICATIONS" && (
        <div className="space-y-6">
          {/* Toolbar */}
          {notifs.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                {unreadCount} unread · {notifs.length} total
              </span>
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] font-mono text-zinc-400 hover:text-white transition-colors uppercase tracking-wider cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            </div>
          )}

          {notifsLoading ? (
            <div className="flex items-center gap-2 justify-center py-16 text-zinc-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[10px] font-mono uppercase tracking-widest">Loading notifications…</span>
            </div>
          ) : notifs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20">
              <Bell className="w-8 h-8 text-zinc-800" />
              <p className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">No notifications yet</p>
              <p className="text-xs text-zinc-600 text-center max-w-xs">
                Interact with the community — like posts, follow users, and get notified when others engage with you.
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([day, items]) => (
              <div key={day} className="space-y-1">
                <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest px-1 pb-1">{day}</p>
                <div className="border border-[#1a1a1a] rounded-lg overflow-hidden divide-y divide-[#1A1A1A]">
                  {items.map(n => (
                    <div
                      key={n.notification_id}
                      onClick={() => {
                        if (!n.is_read) handleToggleRead(n.notification_id);
                        
                        if (n.entity_type === "POST" && n.entity_id && onOpenPost) {
                          if (n.type === "LIKE" || n.type === "COMMENT" || n.type === "REPLY" || n.type === "BOOKMARK") {
                            onOpenPost(n.entity_id, n.type === "COMMENT" || n.type === "REPLY");
                            return;
                          }
                        }

                        if (n.entity_type === "DECK" && n.entity_id && onOpenDeck) {
                          onOpenDeck(n.entity_id);
                          return;
                        }

                        if (n.actor && n.actor.username && onOpenUserProfile) {
                          onOpenUserProfile(n.actor.username);
                        } else if (n.type === "DECK_FORK" && onNavigateToDecks) {
                          onNavigateToDecks();
                        }
                      }}
                      className={`group flex items-center gap-4 px-4 py-3.5 transition-all ${
                        n.is_read
                          ? "bg-black hover:bg-[#0e0e0e]"
                          : "bg-[#111111] hover:bg-[#131313] cursor-pointer"
                      }`}
                    >
                      {/* Unread dot */}
                      <div className="flex-shrink-0">
                        <div className={`w-1.5 h-1.5 rounded-full ${n.is_read ? "bg-transparent" : "bg-white"}`} />
                      </div>

                      {/* Actor avatar */}
                      <div className="w-7 h-7 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center text-[10px] font-mono text-white flex-shrink-0">
                        {n.actor
                          ? (n.actor.name || n.actor.username || "?").substring(0, 2).toUpperCase()
                          : "SYS"}
                      </div>

                      {/* Type icon */}
                      <div className="flex-shrink-0">
                        {TYPE_ICON[n.type] || TYPE_ICON["SYSTEM"]}
                      </div>

                      {/* Message */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-sans leading-relaxed ${n.is_read ? "text-zinc-400" : "text-white"}`}>
                          {n.message}
                        </p>
                        <span className="text-[9px] font-mono text-zinc-600">{ago(n.created_at)}</span>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(n.notification_id); }}
                        className="opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-red-400 transition-all p-1 cursor-pointer"
                        title="Dismiss"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ANALYTICS SECTION
      ═══════════════════════════════════════════════════════════ */}
      {activeSection === "ANALYTICS" && (
        <div className="space-y-8">
          {analyticsLoading ? (
            <div className="flex items-center gap-2 justify-center py-16 text-zinc-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[10px] font-mono uppercase tracking-widest">Loading analytics…</span>
            </div>
          ) : (
            <>
              {/* ── Stats Grid ── */}
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Total Cards", value: stats.total_cards, icon: <Layers className="w-4 h-4 text-blue-400" /> },
                    { label: "Due Today", value: stats.cards_due_today, icon: <RefreshCw className="w-4 h-4 text-orange-400" /> },
                    { label: "Total Decks", value: stats.total_decks, icon: <BarChart2 className="w-4 h-4 text-purple-400" /> },
                    { label: "Concepts Posted", value: stats.total_posts, icon: <Sparkles className="w-4 h-4 text-yellow-400" /> },
                    { label: "Likes Received", value: stats.likes_received, icon: <Heart className="w-4 h-4 text-red-400" /> },
                    { label: "Day Streak", value: stats.daily_streak, icon: <Flame className="w-4 h-4 text-orange-500" /> },
                  ].map(s => (
                    <div key={s.label} className="border border-[#1a1a1a] bg-black rounded-lg p-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-900 flex items-center justify-center flex-shrink-0">
                        {s.icon}
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white font-mono leading-none">{s.value.toLocaleString()}</p>
                        <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider mt-0.5">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── 30-day Review Heatmap ── */}
              {history.length > 0 && (
                <div className="border border-[#1a1a1a] bg-black rounded-lg p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">30-Day Study Activity</h3>
                    <span className="text-[9px] font-mono text-zinc-700">
                      {history.reduce((s, d) => s + d.count, 0)} total cards
                    </span>
                  </div>
                  <ReviewHeatmap data={history} />
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-mono text-zinc-700">Less</span>
                    {[0.06, 0.3, 0.55, 0.8, 1].map((o, i) => (
                      <div key={i} className="w-3 h-3 rounded-sm" style={{ backgroundColor: `rgba(255,255,255,${o})` }} />
                    ))}
                    <span className="text-[9px] font-mono text-zinc-700">More</span>
                  </div>
                </div>
              )}

              {/* ── Leaderboard ── */}
              {leaderboard.length > 0 && (
                <div className="border border-[#1a1a1a] bg-black rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#1a1a1a] flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Global Leaderboard</h3>
                  </div>
                  <div className="divide-y divide-[#111]">
                    {leaderboard.map((u, i) => (
                      <div
                        key={u.user_id}
                        className={`flex items-center gap-4 px-5 py-3 transition-colors ${
                          u.is_current_user ? "bg-white/[0.03]" : "hover:bg-[#080808]"
                        }`}
                      >
                        {/* Rank */}
                        <span className={`text-sm font-bold font-mono w-6 text-center flex-shrink-0 ${
                          i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-orange-400" : "text-zinc-600"
                        }`}>
                          {i + 1}
                        </span>
                        {/* Avatar */}
                        <div className="w-7 h-7 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center text-[9px] font-mono text-white flex-shrink-0">
                          {(u.full_name || u.username || "?").substring(0, 2).toUpperCase()}
                        </div>
                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${u.is_current_user ? "text-white" : "text-zinc-300"}`}>
                            {u.full_name || u.username || "Anonymous"}
                            {u.is_current_user && <span className="text-[9px] font-mono text-zinc-500 ml-1.5">(you)</span>}
                          </p>
                          <p className="text-[9px] font-mono text-zinc-600">@{u.username || "?"}</p>
                        </div>
                        {/* Score badges */}
                        <div className="flex items-center gap-3 text-[9px] font-mono text-zinc-600">
                          <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" />{u.streak}</span>
                          <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-yellow-400" />{u.posts}</span>
                          <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-400" />{u.likes_received}</span>
                        </div>
                        {/* Total score */}
                        <span className="text-xs font-bold font-mono text-white w-12 text-right">{u.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!stats && !analyticsLoading && (
                <div className="py-16 text-center text-zinc-700 text-xs font-mono">
                  No analytics data yet. Start studying to generate stats!
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
