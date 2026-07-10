import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, Send, ArrowLeft, Trash2, Loader2, Pencil, Check, X, Search, Sparkles
} from "lucide-react";
import {
  listConversations, getThread, sendMessage, markThreadRead, deleteMessage, updateMessage, deleteConversation,
  DmConversation, DmMessage
} from "../api/dmApi";
import { resolveMediaUrl } from "../api/uploadApi";
import { queryCache } from "../lib/useQuery";
import { motion, AnimatePresence } from "motion/react";

interface MessagesViewProps {
  currentUserId: string;
  searchQuery: string;
  isDarkMode?: boolean;
  onOpenUserProfile?: (username: string) => void;
  targetUser?: {
    user_id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  onClearTargetUser?: () => void;
  onOpenPost?: (postId: string) => void;
}

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
};

const messageTimeFormat = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const renderMessageBody = (body: string, isOwn: boolean, isDarkMode: boolean, onOpenPost?: (postId: string) => void) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  if (body.startsWith("Check out this concept: ") && body.includes("/post/")) {
    const parts = body.split("\n");
    let conceptText = parts[0].replace("Check out this concept: ", "");
    
    let topicName: string | null = null;
    const topicMatch = conceptText.match(/^\[(.*?)\]\s*(.*)/);
    if (topicMatch) {
      topicName = topicMatch[1];
      conceptText = topicMatch[2];
    }
    
    const url = parts.find(p => p.includes("/post/"));
    
    if (url) {
      const postIdMatch = url.match(/\/post\/([^/?#]+)/);
      const postId = postIdMatch ? postIdMatch[1] : null;

      return (
        <div className="flex flex-col gap-2 min-w-[200px]">
          {topicName && (
            <div className="flex items-center gap-1.5 opacity-80 mb-1">
              <Sparkles className="w-3 h-3" />
              <span className="text-[9px] font-mono uppercase tracking-wider font-bold opacity-70">{topicName}</span>
            </div>
          )}
          <p className="italic text-sm line-clamp-4 leading-relaxed">{conceptText}</p>
          {postId && onOpenPost ? (
            <button
              onClick={() => onOpenPost(postId)}
              className={`mt-2 text-[10px] font-mono py-2 px-3 rounded text-center transition-colors block uppercase font-bold tracking-wider cursor-pointer ${
                isOwn 
                  ? isDarkMode ? "bg-black/20 hover:bg-black/30 text-[#fdfbfb]" : "bg-white/20 hover:bg-white/30 text-[#fdfbfb]"
                  : isDarkMode ? "bg-white/10 hover:bg-white/20 text-white" : "bg-black/5 hover:bg-black/10 text-[#22223b]"
              }`}
            >
              Decrypt Concept
            </button>
          ) : (
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              className={`mt-2 text-[10px] font-mono py-2 px-3 rounded text-center transition-colors block uppercase font-bold tracking-wider ${
                isOwn 
                  ? isDarkMode ? "bg-black/20 hover:bg-black/30 text-[#fdfbfb]" : "bg-white/20 hover:bg-white/30 text-[#fdfbfb]"
                  : isDarkMode ? "bg-white/10 hover:bg-white/20 text-white" : "bg-black/5 hover:bg-black/10 text-[#22223b]"
              }`}
            >
              Decrypt Concept
            </a>
          )}
        </div>
      );
    }
  }

  return body.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a 
          key={i} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="underline underline-offset-2 hover:opacity-80 break-all font-semibold"
        >
          {part}
        </a>
      );
    }
    // Handle newlines
    return (
      <span key={i}>
        {part.split('\n').map((line, j, arr) => (
          <React.Fragment key={j}>
            {line}
            {j < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
      </span>
    );
  });
};

function Avatar({
  url, name, size = "md", isDarkMode = true
}: { url?: string | null; name?: string | null; size?: "sm" | "md" | "lg"; isDarkMode?: boolean }) {
  const sizeMap = { sm: "w-7 h-7 text-[9px]", md: "w-10 h-10 text-xs", lg: "w-12 h-12 text-sm" };
  const initials = (name || "?").substring(0, 2).toUpperCase();
  return (
    <div className={`${sizeMap[size]} rounded-full flex-shrink-0 flex items-center justify-center font-semibold overflow-hidden border ${isDarkMode
        ? "bg-zinc-800/80 border-white/10 text-zinc-300"
        : "bg-[#f2e9e4] border-[#c9ada7]/50 text-[#4a4e69]"
      }`}>
      {initials}
    </div>
  );
}

export default function MessagesView({ currentUserId, searchQuery, isDarkMode = true, onOpenUserProfile, targetUser, onClearTargetUser, onOpenPost }: MessagesViewProps) {
  const cacheKey = JSON.stringify(['conversations', currentUserId]);
  const initialConvs = queryCache[cacheKey]?.data || [];

  const [conversations, setConversations] = useState<DmConversation[]>(initialConvs);
  const [selectedConv, setSelectedConv] = useState<DmConversation | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [showLocalSearch, setShowLocalSearch] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(!initialConvs.length);
  const [msgLoading, setMsgLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  
  // Long press state
  const [longPressConv, setLongPressConv] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const selectedConvRef = useRef<DmConversation | null>(null);

  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);

  const handlePointerDown = (convId: string) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressConv(convId);
    }, 500); // 500ms tap and hold
  };

  const handlePointerUpOrLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDeleteConv = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation(convId);
      setConversations(prev => prev.filter(c => c.partner_id !== convId));
      if (selectedConv?.partner_id === convId) {
        setSelectedConv(null);
      }
      setLongPressConv(null);
    } catch (err) {
      console.warn("Failed to delete conversation", err);
    }
  };

  const handleMarkAsReadConv = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markThreadRead(convId);
      setConversations(prev => prev.map(c => c.partner_id === convId ? { ...c, unread_count: 0 } : c));
      setLongPressConv(null);
      window.dispatchEvent(new CustomEvent('fetch_unread_counts'));
    } catch (err) {
      console.warn("Failed to mark as read", err);
    }
  };

  const loadConversations = useCallback(async () => {
    if (!queryCache[cacheKey]?.data) {
      setLoading(true);
    }
    try {
      const data = await listConversations();
      queryCache[cacheKey] = { data, timestamp: Date.now() };
      setConversations(data);
      return data;
    } catch (e) {
      console.warn("Could not load conversations", e);
      return [];
    } finally {
      setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // WebSocket setup for real-time messages
  useEffect(() => {
    if (!currentUserId) return;
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connectWS = () => {
      // SECURITY FIX (Critical #2): Pass JWT token for server-side WebSocket auth.
      const token = localStorage.getItem("access_token") || "";
      const wsUrl = baseUrl.replace(/^http/, 'ws') + `/api/dm/ws/${currentUserId}?token=${encodeURIComponent(token)}`;
      console.log("Connecting to WebSocket:", wsUrl.replace(/token=[^&]+/, "token=***"));
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connected successfully to", wsUrl);
      };

      ws.onclose = (event) => {
        console.log("WebSocket disconnected", event.code, event.reason);
        // Auto-reconnect after 2 seconds
        reconnectTimeout = setTimeout(() => {
          console.log("Attempting to reconnect WebSocket...");
          connectWS();
        }, 2000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onmessage = (event) => {
        try {
          const msg: DmMessage = JSON.parse(event.data);
          console.log("WebSocket received message:", msg);
          const partnerId = (msg.sender_id === currentUserId ? msg.recipient_id : msg.sender_id).toLowerCase();

          setMessages(prev => {
            const currentConv = selectedConvRef.current;
            const currentPartnerId = currentConv?.partner_id?.toLowerCase();
            const isCurrentThread = currentPartnerId === partnerId;

            if (isCurrentThread) {
              if (prev.some(m => m.message_id === msg.message_id)) return prev;

              if (msg.sender_id !== currentUserId) {
                markThreadRead(partnerId).catch(console.error);
              }
              return [...prev, msg];
            }
            return prev;
          });

          setConversations(prev => {
            const currentConv = selectedConvRef.current;
            const currentPartnerId = currentConv?.partner_id?.toLowerCase();
            const isCurrentThread = currentPartnerId === partnerId;
            const idx = prev.findIndex(c => c.partner_id.toLowerCase() === partnerId);

            if (idx >= 0) {
              const updated = [...prev];
              const newUnread = (isCurrentThread || msg.sender_id === currentUserId) ? 0 : updated[idx].unread_count + 1;
              updated[idx] = {
                ...updated[idx],
                last_message: msg.body,
                last_message_at: msg.created_at,
                is_mine: msg.sender_id === currentUserId,
                unread_count: newUnread
              };
              const [item] = updated.splice(idx, 1);
              if (newUnread > 0) window.dispatchEvent(new CustomEvent('fetch_unread_counts'));
              return [item, ...updated];
            } else {
              loadConversations().then(() => window.dispatchEvent(new CustomEvent('fetch_unread_counts')));
              return prev;
            }
          });
        } catch (e) {
          console.warn("WebSocket parse error", e);
        }
      };
    };

    connectWS();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null; // Prevent reconnect on intentional unmount
        ws.close();
      }
    };
  }, [currentUserId, loadConversations]);

  // Handle opening a chat with a specific target user
  useEffect(() => {
    if (targetUser && !loading) {
      const existing = conversations.find(c => c.partner_id === targetUser.user_id);
      if (existing) {
        openThread(existing);
      } else {
        const newConv: DmConversation = {
          partner_id: targetUser.user_id,
          partner_username: targetUser.username,
          partner_full_name: targetUser.full_name,
          partner_avatar_url: targetUser.avatar_url,
          last_message: "",
          last_message_at: new Date().toISOString(),
          unread_count: 0,
          is_mine: true
        };
        setConversations(prev => [newConv, ...prev]);
        openThread(newConv);
      }
      onClearTargetUser?.();
    }
  }, [targetUser, loading, conversations]);

  const openThread = async (conv: DmConversation) => {
    setSelectedConv(conv);
    setEditingId(null);
    setMsgLoading(true);
    try {
      const data = await getThread(conv.partner_id);
      setMessages(data);
      await markThreadRead(conv.partner_id);
      window.dispatchEvent(new CustomEvent('fetch_unread_counts'));
      setConversations(prev => prev.map(c =>
        c.partner_id === conv.partner_id ? { ...c, unread_count: 0 } : c
      ));
    } catch (e) {
      console.warn("Could not load thread", e);
    } finally {
      setMsgLoading(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(editText.length, editText.length);
    }
  }, [editingId]);

  const handleSend = async () => {
    if (!inputText.trim() || !selectedConv || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSending(true);
    try {
      const msg = await sendMessage(selectedConv.partner_id, text);
      setMessages(prev => {
        if (prev.some(m => m.message_id === msg.message_id)) return prev;
        return [...prev, msg];
      });
      setConversations(prev => prev.map(c =>
        c.partner_id === selectedConv.partner_id
          ? { ...c, last_message: text, last_message_at: new Date().toISOString(), is_mine: true }
          : c
      ));
    } catch (e) {
      console.warn("Failed to send message", e);
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMsg = async (msg: DmMessage) => {
    if (msg.sender_id !== currentUserId) return;
    try {
      await deleteMessage(msg.message_id);
      setMessages(prev => prev.filter(m => m.message_id !== msg.message_id));
    } catch { }
  };

  const handleStartEdit = (msg: DmMessage) => {
    setEditingId(msg.message_id);
    setEditText(msg.body);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editText.trim() || editSaving) return;
    setEditSaving(true);
    try {
      const updated = await updateMessage(editingId, editText.trim());
      setMessages(prev => prev.map(m => m.message_id === editingId ? updated : m));
      setEditingId(null);
      setEditText("");
    } catch (e) {
      console.warn("Failed to edit message", e);
    } finally {
      setEditSaving(false);
    }
  };

  const filteredConvs = conversations.filter(c =>
    !localSearchQuery ||
    (c.partner_full_name || "").toLowerCase().includes(localSearchQuery.toLowerCase()) ||
    (c.partner_username || "").toLowerCase().includes(localSearchQuery.toLowerCase())
  );

  // Theme tokens
  const bg = "bg-transparent";
  const border = isDarkMode ? "border-white/[0.07]" : "border-[#c9ada7]/30";
  const panelBg = "bg-transparent";
  const textPrimary = isDarkMode ? "text-zinc-100" : "text-[#22223b]";
  const textSecondary = isDarkMode ? "text-zinc-500" : "text-[#4a4e69]";
  const textMuted = isDarkMode ? "text-zinc-700" : "text-[#9a8c98]";
  const inputBg = isDarkMode ? "bg-white/5 border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-white/25" : "bg-transparent border-[#22223b]/15 text-[#22223b] placeholder:text-[#9a8c98] focus:border-[#22223b]/30";
  const hoverBg = isDarkMode ? "hover:bg-white/5" : "hover:bg-[#22223b]/5";
  const activeBg = isDarkMode ? "bg-white/[0.06]" : "bg-[#22223b]/[0.06]";
  const activeAccent = isDarkMode ? "border-l-white" : "border-l-[#22223b]";
  const ownBubble = isDarkMode ? "bg-white text-[#111]" : "bg-[#22223b] text-[#fdfbfb]";
  const otherBubble = isDarkMode ? "bg-white/[0.07] border border-white/10 text-zinc-200" : "bg-zinc-100 border border-zinc-200 text-[#22223b]";
  const sendBtn = isDarkMode ? "bg-white text-black hover:bg-zinc-200" : "bg-[#22223b] text-[#f2e9e4] hover:bg-[#1a1a2e]";

  return (
    <div className="w-full flex" style={{ height: "calc(100dvh - env(safe-area-inset-bottom, 0px))" }}>
      <div className={`w-full h-full flex overflow-hidden ${bg} border-t ${border}`}>


        {/* ── Left Panel: Conversation List ── */}
        <div className={`w-full lg:w-80 flex-shrink-0 border-r ${border} flex flex-col ${panelBg} ${selectedConv ? "hidden lg:flex" : "flex"}`}>
          {/* Header with Search */}
          <div className={`px-5 py-5 border-b ${border}`}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`text-sm font-bold ${textPrimary} flex items-center gap-2.5`}>
                  <MessageSquare className="w-4 h-4" />
                  Messages
                </h1>
                <p className={`text-[10px] font-mono ${textMuted} uppercase tracking-widest mt-1`}>
                  Direct conversations
                </p>
              </div>

              <button
                onClick={() => {
                  setShowLocalSearch(!showLocalSearch);
                  if (showLocalSearch) setLocalSearchQuery(""); // Clear on hide
                }}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer ${showLocalSearch ? activeBg : hoverBg} ${textMuted} hover:${textPrimary}`}
              >
                {showLocalSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              </button>
            </div>

            <AnimatePresence>
              {showLocalSearch && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <div className={`flex items-center rounded-xl px-3 py-2 transition-all ${isDarkMode ? "bg-white/5 border border-white/10 text-zinc-100 focus-within:border-white/30" : "bg-[#22223b]/5 border border-[#22223b]/15 text-[#22223b] focus-within:border-[#22223b]/30"}`}>
                    <Search className="w-3.5 h-3.5 mr-2 opacity-50" />
                    <input
                      type="text"
                      value={localSearchQuery}
                      onChange={(e) => setLocalSearchQuery(e.target.value)}
                      className="bg-transparent border-none focus:ring-0 text-xs w-full outline-none placeholder:opacity-50"
                      placeholder="Search conversations..."
                      autoFocus
                    />
                    {localSearchQuery && (
                      <button onClick={() => setLocalSearchQuery("")} className="ml-2 opacity-50 hover:opacity-100 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-1 p-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl animate-pulse ${isDarkMode ? "bg-white/5" : "bg-[#22223b]/5"}`}>
                    <div className={`w-10 h-10 rounded-full flex-shrink-0 ${isDarkMode ? "bg-white/10" : "bg-[#22223b]/10"}`} />
                    <div className="flex-1 space-y-2">
                      <div className={`h-3 rounded w-2/3 ${isDarkMode ? "bg-white/10" : "bg-[#22223b]/10"}`} />
                      <div className={`h-2 rounded w-1/2 ${isDarkMode ? "bg-white/10" : "bg-[#22223b]/10"}`} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 px-4 text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDarkMode ? "bg-white/5" : "bg-[#22223b]/5"}`}>
                  <MessageSquare className={`w-5 h-5 ${textMuted}`} />
                </div>
                <p className={`text-[11px] font-mono ${textMuted} uppercase tracking-widest`}>No conversations yet</p>
                <p className={`text-xs ${textSecondary}`}>Visit a user's profile to start a conversation.</p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {filteredConvs.map(conv => (
                  <div key={conv.partner_id} className="relative">
                    <button
                      onClick={() => openThread(conv)}
                      onPointerDown={() => handlePointerDown(conv.partner_id)}
                      onPointerUp={handlePointerUpOrLeave}
                      onPointerLeave={handlePointerUpOrLeave}
                      onContextMenu={(e) => { e.preventDefault(); setLongPressConv(conv.partner_id); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all cursor-pointer select-none ${hoverBg} ${selectedConv?.partner_id === conv.partner_id ? `${activeBg} border-l-2 ${activeAccent} pl-3.5` : ""
                        }`}
                    >
                      <Avatar url={conv.partner_avatar_url} name={conv.partner_full_name || conv.partner_username} isDarkMode={isDarkMode} />
                      <div className="flex-1 min-w-0 pr-2 pointer-events-none">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[13px] font-semibold truncate ${conv.unread_count > 0 ? textPrimary : textSecondary}`}>
                            {conv.partner_full_name || conv.partner_username || "Anonymous"}
                          </span>
                          <span className={`text-[9px] font-mono ${textMuted} flex-shrink-0`}>{timeAgo(conv.last_message_at)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className={`text-[11px] truncate ${conv.unread_count > 0 ? textSecondary : textMuted}`}>
                            {conv.is_mine ? "You: " : ""}{conv.last_message}
                          </p>
                          {conv.unread_count > 0 && (
                            <span className={`flex-shrink-0 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${isDarkMode ? "bg-white text-black" : "bg-[#22223b] text-[#f2e9e4]"}`}>
                              {conv.unread_count > 9 ? "9+" : conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                    {/* Context Menu for long press / right click */}
                    <AnimatePresence>
                      {longPressConv === conv.partner_id && (
                        <>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40"
                            onClick={(e) => { e.stopPropagation(); setLongPressConv(null); }}
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className={`absolute z-50 left-16 top-10 w-40 rounded-xl shadow-xl overflow-hidden border ${isDarkMode ? "bg-[#111] border-white/10" : "bg-white border-zinc-200"}`}
                          >
                            <button
                              onClick={(e) => handleMarkAsReadConv(conv.partner_id, e)}
                              className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors cursor-pointer ${isDarkMode ? "text-zinc-200 hover:bg-white/10" : "text-zinc-700 hover:bg-zinc-100"}`}
                            >
                              <Check className="w-3.5 h-3.5" /> Mark as Read
                            </button>
                            <div className={`h-px w-full ${isDarkMode ? "bg-white/10" : "bg-zinc-200"}`} />
                            <button
                              onClick={(e) => handleDeleteConv(conv.partner_id, e)}
                              className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors cursor-pointer text-red-500 hover:bg-red-500/10`}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete Chat
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel: Message Thread ── */}
        <div className={`flex-1 flex flex-col ${panelBg} ${selectedConv ? "flex" : "hidden lg:flex"}`}>
          <AnimatePresence mode="wait">
            {!selectedConv ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center flex-1 gap-4 text-center"
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDarkMode ? "bg-white/5" : "bg-[#22223b]/5"}`}>
                  <MessageSquare className={`w-7 h-7 ${textMuted}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${textPrimary}`}>Select a conversation</p>
                  <p className={`text-[11px] ${textMuted} mt-1`}>Choose from your message threads</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={selectedConv.partner_id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col flex-1 overflow-hidden"
              >
                {/* Thread header */}
                <div className={`px-5 py-4 border-b ${border} flex items-center gap-3 flex-shrink-0`}>
                  <button
                    onClick={() => setSelectedConv(null)}
                    className={`lg:hidden ${textMuted} hover:${textPrimary} p-1 cursor-pointer transition-colors`}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div
                    className="cursor-pointer"
                    onClick={() => selectedConv.partner_username && onOpenUserProfile?.(selectedConv.partner_username)}
                  >
                    <Avatar url={selectedConv.partner_avatar_url} name={selectedConv.partner_full_name || selectedConv.partner_username} size="md" isDarkMode={isDarkMode} />
                  </div>
                  <div 
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => selectedConv.partner_username && onOpenUserProfile?.(selectedConv.partner_username)}
                  >
                    <p className={`text-[13px] font-semibold ${textPrimary} truncate hover:underline underline-offset-2`}>
                      {selectedConv.partner_full_name || selectedConv.partner_username}
                    </p>
                    <p className={`text-[10px] font-mono ${textMuted}`}>@{selectedConv.partner_username}</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                  {msgLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"} gap-2 animate-pulse`}>
                          {i % 2 !== 0 && <div className={`w-7 h-7 rounded-full flex-shrink-0 ${isDarkMode ? "bg-white/10" : "bg-[#22223b]/10"}`} />}
                          <div className={`h-9 rounded-2xl ${i % 2 === 0 ? "w-44" : "w-56"} ${isDarkMode ? "bg-white/10" : "bg-[#22223b]/10"}`} />
                        </div>
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <p className={`text-[11px] font-mono ${textMuted}`}>No messages yet. Say hello! 👋</p>
                    </div>
                  ) : (
                    messages.map(msg => {
                      const isOwn = msg.sender_id === currentUserId;
                      const isEditing = editingId === msg.message_id;
                      return (
                        <div key={msg.message_id} className={`group flex flex-col ${isOwn ? "items-end" : "items-start"} gap-1`}>
                          <div className={`flex items-end gap-2 max-w-[85%]`}>
                            {!isOwn && (
                              <Avatar url={selectedConv.partner_avatar_url} name={selectedConv.partner_full_name || selectedConv.partner_username} size="sm" isDarkMode={isDarkMode} />
                            )}

                            <div className={`flex flex-col gap-1`}>
                              {isEditing ? (
                                <div className={`flex items-center gap-2 w-full px-3 py-2 rounded-2xl border ${isDarkMode ? "bg-white/10 border-white/20" : "bg-[#22223b]/10 border-[#22223b]/20"}`}>
                                  <input
                                    ref={editInputRef}
                                    type="text"
                                    value={editText}
                                    onChange={e => setEditText(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === "Enter" && !e.shiftKey) handleSaveEdit();
                                      if (e.key === "Escape") handleCancelEdit();
                                    }}
                                    className={`flex-1 text-xs bg-transparent outline-none ${textPrimary}`}
                                  />
                                  <button onClick={handleSaveEdit} disabled={editSaving} className="text-emerald-500 hover:text-emerald-400 cursor-pointer transition-colors flex-shrink-0">
                                    {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                  </button>
                                  <button onClick={handleCancelEdit} className={`${textMuted} hover:text-red-400 cursor-pointer transition-colors flex-shrink-0`}>
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed break-words shadow-sm ${isOwn ? `${ownBubble} rounded-br-sm` : `${otherBubble} rounded-bl-sm`}`}>
                                  {renderMessageBody(msg.body, isOwn, isDarkMode, onOpenPost)}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Timestamp and Actions (aligned under the bubble, offset by avatar if present) */}
                          <div className={`flex items-center gap-2 px-1 ${!isOwn ? "ml-9" : "mr-1"} ${isOwn ? "flex-row-reverse" : ""}`}>
                            <span
                              className={`text-[9px] font-mono ${textMuted} cursor-default`}
                              title={new Date(msg.created_at).toLocaleString()}
                            >
                              {messageTimeFormat(msg.created_at)}
                            </span>
                            {msg.is_edited && <span className={`text-[9px] font-mono italic ${textMuted}`}>(edited)</span>}

                            {isOwn && !isEditing && (
                              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleStartEdit(msg)}
                                  className={`${textMuted} hover:text-blue-400 transition-colors cursor-pointer`}
                                  title="Edit message"
                                >
                                  <Pencil className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMsg(msg)}
                                  className={`${textMuted} hover:text-red-400 transition-colors cursor-pointer`}
                                  title="Delete message"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className={`px-4 pt-4 pb-20 lg:pb-4 border-t ${border} flex items-center gap-3 flex-shrink-0`}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder="Type a message…"
                    className={`flex-1 border rounded-full px-4 py-2.5 text-[13px] outline-none transition-all ${inputBg}`}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || sending}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30 cursor-pointer flex-shrink-0 shadow-md ${sendBtn}`}
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
