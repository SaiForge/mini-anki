import React, { useState, useEffect, useCallback } from "react";
import {
  Bell, Heart, MessageSquare, UserPlus, GitFork, Bookmark,
  Trash2, Check, RefreshCw, Trophy, Flame, Layers, Sparkles,
  ChevronRight, BarChart2, Loader2
} from "lucide-react";
import {
  getNotifications, markOneRead, markAllRead, deleteNotification,
  NotificationItem
} from "../api/notificationsApi";


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
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
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



// ─── Main component ──────────────────────────────────────────────────────────
interface NotificationsViewProps {
  onOpenUserProfile?: (username: string) => void;
  onNavigateToDecks?: () => void;
  onOpenPost?: (postId: string, openComments: boolean) => void;
  onOpenDeck?: (deckId: string) => void;
}

export default function NotificationsView({ onOpenUserProfile, onNavigateToDecks, onOpenPost, onOpenDeck }: NotificationsViewProps) {
  // ── Notifications state ──
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(true);

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

  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  useEffect(() => {
    const handleNotification = (event: any) => {
      const msg = event.detail as NotificationItem;
      setNotifs(prev => {
        // Prevent duplicate notifications in the list
        if (prev.some(n => n.notification_id === msg.notification_id)) return prev;
        return [msg, ...prev];
      });
    };
    window.addEventListener('notification_received', handleNotification);
    return () => window.removeEventListener('notification_received', handleNotification);
  }, []);

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
            Social activity
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          NOTIFICATIONS SECTION
      ═══════════════════════════════════════════════════════════ */}
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
                <div className="flex flex-col gap-1">
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
                      className={`group flex items-center gap-3 py-3 px-2 transition-all cursor-pointer ${
                        n.is_read
                          ? "hover:bg-white/5 rounded-lg"
                          : "bg-white/5 rounded-lg hover:bg-white/10"
                      }`}
                    >
                      {/* Avatar with Icon Badge */}
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center text-xs font-mono text-white font-bold">
                          {n.actor
                            ? (n.actor.name || n.actor.username || "?").substring(0, 2).toUpperCase()
                            : "SYS"}
                        </div>
                        {/* Tiny badge */}
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-black flex items-center justify-center border border-zinc-800 shadow-sm">
                          {React.cloneElement(TYPE_ICON[n.type] as React.ReactElement || TYPE_ICON["SYSTEM"], { className: "w-2.5 h-2.5" })}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 flex items-center flex-wrap">
                        <span className={`text-sm tracking-tight ${n.is_read ? "text-zinc-300 font-normal" : "text-white font-semibold"}`}>
                          {n.message}
                        </span>
                        <span className="text-xs text-zinc-500 ml-2 font-light">
                          {ago(n.created_at)}
                        </span>
                      </div>

                      {/* Right Action Area */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(n.notification_id); }}
                          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1"
                          title="Dismiss"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        
                        {!n.is_read && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
    </div>
  );
}
