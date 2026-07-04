import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles, Send, X, HelpCircle, FileText, Loader2, Copy, Check,
  Upload, Plus, Trash2, Edit3, ChevronDown, RotateCcw, History,
  Wand2, MessageSquare, Save, AlertCircle, CheckCircle2, FileUp, CornerDownLeft
} from "lucide-react";
import {
  sendChat, generateQuiz, generateCards, extractCardsFromText,
  extractCardsFromPdf, ChatMessage, QuizQuestion, AICard,
  AISession, getAiSessions, createAiSession, updateAiSession, deleteAiSession
} from "../api/aiApi";
import { StudyDeck } from "../types";

// ─── Types ─────────────────────────────────────────────────────────────────

type Mode = "CHAT" | "GENERATE" | "EXTRACT_TEXT" | "UPLOAD_PDF" | "QUIZ";

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  decks: StudyDeck[];
  isDarkMode?: boolean;
  onDeckCreated: (name: string, description?: string) => Promise<string>;
  onCardsAdded: (deckId: string, cards: AICard[]) => Promise<void>;
  onDecksRefresh: () => void;
}

interface EditableCard extends AICard {
  id: string;
  editing: boolean;
}

interface Toast {
  id: string;
  type: "success" | "error";
  message: string;
}

// ─── Mode config ────────────────────────────────────────────────────────────

const MODES: {
  id: Mode; label: string; icon: React.ReactNode; desc: string;
  accent: string; accentLight: string;
}[] = [
  { id: "CHAT",         label: "Chat",       icon: <MessageSquare className="w-3.5 h-3.5" />, desc: "Ask anything about your studies",    accent: "#6366f1", accentLight: "#4f46e5" },
  { id: "GENERATE",     label: "Generate",   icon: <Wand2 className="w-3.5 h-3.5" />,         desc: "AI creates flashcards from a topic",  accent: "#ef4444", accentLight: "#dc2626" },
  { id: "EXTRACT_TEXT", label: "From Text",  icon: <FileText className="w-3.5 h-3.5" />,      desc: "Extract cards from pasted text",      accent: "#0ea5e9", accentLight: "#0284c7" },
  { id: "UPLOAD_PDF",   label: "From PDF",   icon: <FileUp className="w-3.5 h-3.5" />,        desc: "Upload a PDF and extract cards",      accent: "#10b981", accentLight: "#059669" },
  { id: "QUIZ",         label: "Quiz",       icon: <HelpCircle className="w-3.5 h-3.5" />,    desc: "Test yourself on any topic",          accent: "#f59e0b", accentLight: "#d97706" },
];

const CHAT_SUGGESTIONS = [
  "Explain spaced repetition in simple terms",
  "What is the Feynman technique?",
  "How do I build a study schedule for exams?",
  "Difference between working memory and long-term memory?",
];

const GENERATE_SUGGESTIONS = [
  "Photosynthesis",
  "JavaScript Closures",
  "World War II",
  "Machine Learning Basics",
];

const QUIZ_SUGGESTIONS = [
  "Spanish vocabulary",
  "World capitals",
  "Python programming",
  "Human anatomy",
];

// ─── Minimal markdown renderer ──────────────────────────────────────────────

function renderMarkdown(text: string, dark: boolean): React.ReactNode {
  const codeColor = dark ? "#a5b4fc" : "#4f46e5";
  const bulletColor = dark ? "#6366f1" : "#4f46e5";
  return text.split("\n").map((line, i) => {
    const isBullet = /^[\s]*[-*•]\s/.test(line);
    const raw = isBullet ? line.replace(/^[\s]*[-*•]\s/, "") : line;
    const parts = raw.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, pi) => {
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={pi}>{p.slice(2, -2)}</strong>;
      if (p.startsWith("`") && p.endsWith("`")) return (
        <code key={pi} style={{ color: codeColor, background: dark ? "rgba(99,102,241,0.12)" : "rgba(79,70,229,0.08)", padding: "1px 5px", borderRadius: 4, fontSize: "0.9em", fontFamily: "monospace" }}>{p.slice(1, -1)}</code>
      );
      return p;
    });
    if (isBullet) return <div key={i} className="flex gap-2 items-start my-0.5"><span style={{ color: bulletColor, flexShrink: 0 }}>•</span><span>{parts}</span></div>;
    if (!line.trim()) return <div key={i} className="h-2" />;
    return <div key={i}>{parts}</div>;
  });
}

// ─── AI Neural Animation ────────────────────────────────────────────────────

const NODES = [
  { cx: 50, cy: 30, r: 3.5, delay: 0 },
  { cx: 25, cy: 55, r: 2.8, delay: 0.4 },
  { cx: 75, cy: 55, r: 2.8, delay: 0.8 },
  { cx: 38, cy: 18, r: 2, delay: 1.2 },
  { cx: 62, cy: 18, r: 2, delay: 0.6 },
  { cx: 50, cy: 70, r: 2.5, delay: 1.0 },
  { cx: 15, cy: 35, r: 1.8, delay: 1.4 },
  { cx: 85, cy: 35, r: 1.8, delay: 0.2 },
];

const EDGES: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
  [1, 5], [2, 5], [1, 6], [2, 7], [3, 6], [4, 7],
  [1, 3], [2, 4],
];

function AIAnimation({ accent, size = 240 }: { accent: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, margin: "0 auto 16px", position: "relative" }}>
      <svg viewBox="0 0 100 85" width={size} height={size} style={{ overflow: "visible" }}>
        {/* Edges with animated opacity */}
        {EDGES.map(([a, b], i) => (
          <motion.line
            key={`e${i}`}
            x1={NODES[a].cx} y1={NODES[a].cy}
            x2={NODES[b].cx} y2={NODES[b].cy}
            stroke={accent}
            strokeWidth={0.6}
            strokeLinecap="round"
            initial={{ opacity: 0.05 }}
            animate={{ opacity: [0.05, 0.25, 0.05] }}
            transition={{ duration: 3.2, repeat: Infinity, delay: i * 0.22, ease: "easeInOut" }}
          />
        ))}
        {/* Nodes with floating + pulse */}
        {NODES.map((n, i) => (
          <motion.circle
            key={`n${i}`}
            cx={n.cx} cy={n.cy} r={n.r}
            fill={accent}
            initial={{ opacity: 0.3 }}
            animate={{
              opacity: [0.3, 0.85, 0.3],
              cy: [n.cy, n.cy - 2.5, n.cy],
              r: [n.r, n.r + 0.6, n.r],
            }}
            transition={{ duration: 3.6, repeat: Infinity, delay: n.delay, ease: "easeInOut" }}
          />
        ))}
        {/* Central glow */}
        <motion.circle
          cx={50} cy={30} r={8}
          fill={accent}
          initial={{ opacity: 0.04 }}
          animate={{ opacity: [0.04, 0.12, 0.04], r: [8, 14, 8] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
}

function BlurryBackground({ accent }: { accent: string }) {
  const orbs = [
    { x: "15%", y: "20%", size: 180, color: accent, delay: 0 },
    { x: "75%", y: "60%", size: 140, color: accent, delay: 1.5 },
    { x: "50%", y: "85%", size: 120, color: "#6366f1", delay: 3 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute",
            left: orb.x,
            top: orb.y,
            width: orb.size,
            height: orb.size,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${orb.color}18 0%, transparent 70%)`,
            filter: "blur(50px)",
            transform: "translate(-50%, -50%)",
          }}
          animate={{
            x: [0, 20, -15, 0],
            y: [0, -18, 12, 0],
            scale: [1, 1.15, 0.9, 1],
            opacity: [0.4, 0.7, 0.35, 0.4],
          }}
          transition={{ duration: 12 + i * 3, repeat: Infinity, delay: orb.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AIChatPanel({
  isOpen, onClose, decks, isDarkMode = true,
  onDeckCreated, onCardsAdded, onDecksRefresh,
}: AIChatPanelProps) {
  const d = isDarkMode; // shorthand

  // ── Theme tokens (flat 2D mapping to app CSS variables) ───────────────────
  const T = {
    bg:       "var(--color-surface-container-lowest)",
    surface:  "var(--color-surface)",
    surface2: "var(--color-surface-container)",
    border:   "transparent",
    border2:  "transparent",
    text:     "var(--color-on-surface)",
    textSub:  "var(--color-on-surface-variant)",
    textMute: "var(--color-on-surface-variant)",
    overlay:  "rgba(0,0,0,0.5)",
    inputBg:  "var(--color-surface-container-low)",
  } as const;

  // ── State ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("CHAT");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [generatedCards, setGeneratedCards] = useState<EditableCard[]>([]);
  const [cardCount, setCardCount] = useState(5);
  const [showCountMenu, setShowCountMenu] = useState(false);
  const [showCardPreview, setShowCardPreview] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckDesc, setNewDeckDesc] = useState("");
  const [creatingDeck, setCreatingDeck] = useState(false);
  const [showNewDeckInput, setShowNewDeckInput] = useState(false);
  const [savingCards, setSavingCards] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDragging, setPdfDragging] = useState(false);
  const [quizCount, setQuizCount] = useState(4);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [showScorePopup, setShowScorePopup] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── Session State ──
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showSessionsMenu, setShowSessionsMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const currentSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentMode = MODES.find(m => m.id === mode)!;
  const accent = d ? currentMode.accent : currentMode.accentLight;

  const addToast = useCallback((type: "success" | "error", msg: string) => {
    const id = Date.now().toString();
    setToasts(p => [...p, { id, type, message: msg }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }, []);

  const [suggestionIndex, setSuggestionIndex] = useState(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, quizQuestions]);

  useEffect(() => {
    if (isOpen) {
      getAiSessions().then(setSessions).catch(console.error);
    }
  }, [isOpen]);

  // Auto-save logic
  useEffect(() => {
    if (!isOpen || (history.length === 0 && generatedCards.length === 0 && quizQuestions.length === 0)) return;
    
    const timeout = setTimeout(async () => {
      try {
        const data = { history, cards: generatedCards, quizQuestions, quizAnswers };
        const titleText = history[0]?.text || inputText || `${mode} Session`;
        const title = titleText.substring(0, 40) + (titleText.length > 40 ? "..." : "");
        
        if (currentSessionIdRef.current) {
          await updateAiSession(currentSessionIdRef.current, title, data);
          setSessions(prev => prev.map(s => s.session_id === currentSessionIdRef.current ? { ...s, title, data, updated_at: new Date().toISOString() } : s));
        } else {
          const newSession = await createAiSession(mode, title, data);
          setCurrentSessionId(newSession.session_id);
          setSessions(prev => [newSession, ...prev]);
        }
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, 1500);
    return () => clearTimeout(timeout);
  }, [history, generatedCards, quizQuestions, quizAnswers, mode, isOpen, inputText]);

  useEffect(() => {
    if ((mode === "CHAT" || mode === "GENERATE" || mode === "QUIZ") && history.length === 0 && quizQuestions.length === 0 && !loading) {
      const suggestionsArray = mode === "CHAT" ? CHAT_SUGGESTIONS : mode === "GENERATE" ? GENERATE_SUGGESTIONS : QUIZ_SUGGESTIONS;
      const interval = setInterval(() => {
        setSuggestionIndex((prev) => (prev + 1) % suggestionsArray.length);
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [mode, history.length, loading, quizQuestions.length]);

  const switchMode = (m: Mode) => {
    setMode(m); setGeneratedCards([]); setShowCardPreview(false);
    setQuizQuestions([]); setQuizAnswers({}); setQuizSubmitted(false); setShowScorePopup(false);
    setPdfFile(null); setInputText(""); setHistory([]);
    setCurrentSessionId(null);
  };

  const loadSession = (s: AISession) => {
    setMode(s.mode);
    setCurrentSessionId(s.session_id);
    setGeneratedCards(s.data?.cards || []);
    setShowCardPreview(s.mode === "GENERATE" || s.mode === "EXTRACT_TEXT" || s.mode === "UPLOAD_PDF" ? !!(s.data?.cards && s.data.cards.length > 0) : false);
    setQuizQuestions(s.data?.quizQuestions || []);
    setQuizAnswers(s.data?.quizAnswers || {});
    setQuizSubmitted(Object.keys(s.data?.quizAnswers || {}).length === (s.data?.quizQuestions || []).length && (s.data?.quizQuestions || []).length > 0);
    setHistory(s.data?.history || []);
    setPdfFile(null); setInputText("");
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await deleteAiSession(id);
      setSessions(prev => prev.filter(s => s.session_id !== id));
      if (currentSessionId === id) {
        setCurrentSessionId(null);
        setHistory([]); setGeneratedCards([]); setQuizQuestions([]); setQuizAnswers({}); setShowCardPreview(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── Error parser ───────────────────────────────────────────────────────────
  const parseError = (e: any): string => {
    const status = e?.response?.status;
    const detail = e?.response?.data?.detail || "";
    if (status === 429 || detail.includes("rate limit")) return "⏳ Rate limit reached. Wait a moment and try again.";
    if (status === 403) return "🔑 API key issue — check your Gemini key.";
    if (status === 401) return "🔒 Session expired. Please log in again.";
    if (detail) return detail;
    return "Something went wrong. Please try again.";
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleChat = async () => {
    if (!inputText.trim() || loading) return;
    const text = inputText.trim(); setInputText(""); setLoading(true);
    const newHistory = [...history, { role: "user" as const, text }];
    setHistory(newHistory);
    try {
      const reply = await sendChat(text, history.slice(-8));
      setHistory([...newHistory, { role: "model", text: reply }]);
    } catch (e: any) {
      const msg = parseError(e);
      setHistory(p => [...p, { role: "model", text: `⚠️ ${msg}` }]);
    }
    finally { setLoading(false); }
  };

  const handleGenerateCards = async () => {
    if (!inputText.trim() || loading) return;
    const topic = inputText.trim(); setInputText(""); setLoading(true);
    try {
      const cards = await generateCards(topic, cardCount);
      setGeneratedCards(cards.map((c, i) => ({ ...c, id: `g${i}${Date.now()}`, editing: false })));
      setShowCardPreview(true);
    } catch (e: any) { addToast("error", parseError(e)); }
    finally { setLoading(false); }
  };

  const handleExtractFromText = async () => {
    if (!inputText.trim() || loading) return;
    const text = inputText.trim(); setInputText(""); setLoading(true);
    try {
      const cards = await extractCardsFromText(text, cardCount);
      setGeneratedCards(cards.map((c, i) => ({ ...c, id: `e${i}${Date.now()}`, editing: false })));
      setShowCardPreview(true);
    } catch (e: any) { addToast("error", parseError(e)); }
    finally { setLoading(false); }
  };

  const handlePdfExtract = async () => {
    if (!pdfFile || loading) return;
    setLoading(true);
    try {
      const cards = await extractCardsFromPdf(pdfFile, cardCount);
      setGeneratedCards(cards.map((c, i) => ({ ...c, id: `p${i}${Date.now()}`, editing: false })));
      setShowCardPreview(true);
    } catch (e: any) { addToast("error", parseError(e)); }
    finally { setLoading(false); }
  };

  const handleGenerateQuiz = async () => {
    if (!inputText.trim() || loading) return;
    setLoading(true);
    try {
      const qs = await generateQuiz(inputText.trim(), quizCount);
      setQuizQuestions(qs); setQuizAnswers({}); setQuizSubmitted(false); setShowScorePopup(false);
    } catch (e: any) { addToast("error", parseError(e)); }
    finally { setLoading(false); }
  };

  const handleSaveCards = async () => {
    const valid = generatedCards.filter(c => c.front.trim() && c.back.trim());
    if (!valid.length) { addToast("error", "No valid cards to save."); return; }
    let deckId = selectedDeckId;
    if (showNewDeckInput) {
      if (!newDeckName.trim()) { addToast("error", "Enter a deck name."); return; }
      setCreatingDeck(true);
      try { deckId = await onDeckCreated(newDeckName.trim(), newDeckDesc.trim()); setShowNewDeckInput(false); setNewDeckName(""); setNewDeckDesc(""); onDecksRefresh(); }
      catch { addToast("error", "Failed to create deck."); setCreatingDeck(false); return; }
      setCreatingDeck(false);
    }
    if (!deckId) { addToast("error", "Select a deck first."); return; }
    setSavingCards(true);
    try {
      await onCardsAdded(deckId, valid.map(c => ({ front: c.front, back: c.back })));
      addToast("success", `${valid.length} card${valid.length !== 1 ? "s" : ""} saved!`);
      setGeneratedCards([]); setShowCardPreview(false); onDecksRefresh();
    } catch { addToast("error", "Failed to save cards."); }
    finally { setSavingCards(false); }
  };

  const updateCard = (id: string, f: "front" | "back", v: string) => setGeneratedCards(p => p.map(c => c.id === id ? { ...c, [f]: v } : c));
  const toggleEdit = (id: string) => setGeneratedCards(p => p.map(c => c.id === id ? { ...c, editing: !c.editing } : c));
  const deleteCard = (id: string) => setGeneratedCards(p => p.filter(c => c.id !== id));
  const addBlankCard = () => setGeneratedCards(p => [...p, { id: `m${Date.now()}`, front: "", back: "", editing: true }]);
  const handleCopy = (text: string, id: string) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500); };

  const quizScore = Object.entries(quizAnswers).filter(([qi, ans]) => ans === quizQuestions[+qi]?.answer).length;

  if (!isOpen) return null;

  // ── Shared style helpers ──────────────────────────────────────────────────
  const flat = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: d ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
    border: `1px solid ${d ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
    borderRadius: 10,
    ...extra,
  });

  const flatInput: React.CSSProperties = {
    background: T.inputBg,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    color: T.text,
    fontSize: 13,
    padding: "9px 12px",
    outline: "none",
    width: "100%",
  };

  const pill = (active: boolean, color: string): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 6,
    padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em",
    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.15s",
    background: active ? "var(--theme-primary)" : "transparent",
    color: active ? "var(--theme-on-primary)" : "var(--theme-primary)",
    border: `1px solid ${active ? "transparent" : "var(--theme-outline-variant)"}`,
  });

  const btn = (variant: "primary" | "ghost" | "danger", extra?: React.CSSProperties): React.CSSProperties => {
    const bases = {
      primary: { background: "var(--theme-primary)", color: "var(--theme-on-primary)", border: "none" },
      ghost:   { background: "var(--theme-surface-lowest)", color: "var(--theme-primary)", border: `1px solid var(--theme-outline-variant)` },
      danger:  { background: "transparent", color: "#ef4444", border: "none" },
    };
    return { borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer", transition: "opacity 0.15s", ...bases[variant], ...extra };
  };

  const countBtn = (active: boolean): React.CSSProperties => ({
    width: 34, height: 34, borderRadius: 8, fontSize: 12, fontWeight: 700,
    cursor: "pointer", transition: "all 0.15s",
    background: active ? `${accent}18` : T.surface2,
    color: active ? accent : T.textSub,
    border: `1px solid ${active ? `${accent}50` : T.border}`,
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          display: "flex",
          justifyContent: "flex-end",
          background: typeof window !== "undefined" && window.innerWidth < 1024 ? "transparent" : T.overlay,
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            width: "100%",
            maxWidth: typeof window !== "undefined" && window.innerWidth < 1024 ? "100vw" : 500,
            background: T.bg,
            borderLeft: `1px solid ${T.border}`,
            overflow: "hidden",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Blurry Background ── */}
          <BlurryBackground accent={accent} />

          {/* ── Toasts ── */}
          <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 60, width: "90%", pointerEvents: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            <AnimatePresence>
              {toasts.map(t => (
                <motion.div key={t.id}
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500,
                    background: t.type === "success" ? (d ? "#052e16" : "#f0fdf4") : (d ? "#2d0808" : "#fef2f2"),
                    border: "none",
                    color: t.type === "success" ? (d ? "#4ade80" : "#166534") : (d ? "#f87171" : "#991b1b") }}>
                  {t.type === "success" ? <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} /> : <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />}
                  {t.message}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* ── Header ── */}
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--theme-primary)", margin: 0, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI Study Companion</h2>
                <div style={{ fontSize: 10, color: "var(--theme-on-surface-variant)", fontFamily: "monospace", marginTop: 2, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <span>POWERED BY GEMINI</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.textSub, background: "transparent", border: "none" }}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* ── Mode & Sessions dropdown ── */}
          <div style={{ padding: "10px 16px", position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
            
            {/* Sessions Dropdown */}
            <div style={{ position: "relative", flex: 1, display: "flex" }}>
              <button onClick={() => setShowSessionsMenu(!showSessionsMenu)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "8px 12px", width: "100%", borderRadius: 6, background: "transparent", color: T.text, fontSize: 13, fontWeight: 600, border: `1px solid ${T.border}`, cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.background = T.surface2}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <History style={{ width: 14, height: 14, color: accent }} />
                  Sessions
                </div>
                <ChevronDown style={{ width: 14, height: 14, color: T.textSub }} />
              </button>
              
              <AnimatePresence>
                {showSessionsMenu && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowSessionsMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                      style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, width: 220, background: d ? "#0c0c0c" : "#fdfbfb", border: d ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(201,173,167,0.3)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 4, zIndex: 50, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)", maxHeight: 300, overflowY: "auto" }}>
                      
                      <button onClick={() => { setCurrentSessionId(null); setShowSessionsMenu(false); switchMode(mode); }}
                        style={{ padding: "8px 12px", borderRadius: 4, fontSize: 13, background: "transparent", color: T.text, border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}
                        onMouseEnter={e => e.currentTarget.style.background = d ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <Plus style={{ width: 14, height: 14 }} /> New Session
                      </button>
                      
                      <div style={{ height: 1, background: d ? "rgba(255,255,255,0.1)" : "rgba(201,173,167,0.3)", margin: "4px 0" }} />
                      
                      {sessions.length === 0 && <div style={{ padding: "8px", fontSize: 12, color: T.textMute, textAlign: "center" }}>No past sessions</div>}
                      
                      {sessions.map(s => (
                        <div key={s.session_id} style={{ display: "flex", alignItems: "center", gap: 4, background: currentSessionId === s.session_id ? `${accent}15` : "transparent", borderRadius: 4 }}>
                          <button onClick={() => { loadSession(s); setShowSessionsMenu(false); }}
                            style={{ flex: 1, padding: "8px 12px", borderRadius: 4, fontSize: 12, background: "transparent", color: currentSessionId === s.session_id ? accent : T.text, border: "none", cursor: "pointer", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            onMouseEnter={e => { if (currentSessionId !== s.session_id) e.currentTarget.style.background = d ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"; }}
                            onMouseLeave={e => { if (currentSessionId !== s.session_id) e.currentTarget.style.background = "transparent"; }}>
                            {s.title || `${s.mode} Session`}
                          </button>
                          <button onClick={() => handleDeleteSession(s.session_id)} style={{ padding: "8px", background: "none", border: "none", color: T.textMute, cursor: "pointer" }}
                            onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                            onMouseLeave={e => e.currentTarget.style.color = T.textMute}>
                            <Trash2 style={{ width: 12, height: 12 }} />
                          </button>
                        </div>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Mode Dropdown Container */}
            <div style={{ position: "relative", flex: 1, display: "flex" }}>
              <button onClick={() => setShowModeMenu(!showModeMenu)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "8px 12px", width: "100%", borderRadius: 6, background: "transparent", color: T.text, fontSize: 13, fontWeight: 600, border: `1px solid ${T.border}`, cursor: "pointer", transition: "all 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.background = T.surface2}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: d ? currentMode.accent : currentMode.accentLight }}>
                  {currentMode.icon}
                  <span style={{ color: T.text }}>{currentMode.label}</span>
                </div>
                <ChevronDown style={{ width: 14, height: 14, color: T.textSub }} />
              </button>
              
              <AnimatePresence>
                {showModeMenu && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowModeMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                      style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, width: 220, background: d ? "#0c0c0c" : "#fdfbfb", border: d ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(201,173,167,0.3)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 4, zIndex: 50, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)", maxHeight: 300, overflowY: "auto" }}>
                      
                      {MODES.map(m => {
                        const mAccent = d ? m.accent : m.accentLight;
                        return (
                          <button key={m.id} onClick={() => { switchMode(m.id); setShowModeMenu(false); }}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 4, fontSize: 13, background: mode === m.id ? `${mAccent}15` : "transparent", color: mode === m.id ? mAccent : T.text, border: "none", cursor: "pointer", textAlign: "left", fontWeight: 600 }}
                            onMouseEnter={e => { if (mode !== m.id) e.currentTarget.style.background = d ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"; }}
                            onMouseLeave={e => { if (mode !== m.id) e.currentTarget.style.background = "transparent"; }}>
                            <span style={{ color: mAccent, display: "flex" }}>{m.icon}</span>
                            {m.label}
                            {mode === m.id && <Check style={{ width: 14, height: 14, marginLeft: "auto", color: mAccent }} />}
                          </button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div style={{ height: 1, background: "var(--theme-outline-variant)", margin: "0 16px", opacity: 0.3 }} />

          {/* ── Mode description ── */}
          <div style={{ padding: "6px 16px 2px", flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: T.textMute, margin: 0 }}>{currentMode.desc}</p>
          </div>

          {/* ── Content ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>

            {/* ── CHAT ── */}
            {mode === "CHAT" && (
              <>
                {history.map((msg, i) => {
                  const isUser = msg.role === "user";
                  return (
                    <div key={i} className="group" style={{ display: "flex", width: "100%", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 4 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                        <div className={isUser ? (d ? "bg-white text-[#111]" : "bg-[#22223b] text-[#fdfbfb]") : (d ? "bg-white/[0.07] text-zinc-200" : "bg-[#f2e9e4] text-[#4a4e69]")}
                          style={{
                            padding: "12px 16px", borderRadius: "18px",
                            borderBottomRightRadius: isUser ? "4px" : "18px",
                            borderBottomLeftRadius: !isUser ? "4px" : "18px",
                            fontSize: 14, lineHeight: 1.5, fontFamily: "sans-serif",
                            width: "fit-content",
                          }}>
                          {msg.role === "model" ? renderMarkdown(msg.text, d) : msg.text}
                        </div>
                        {msg.role === "model" && (
                          <button onClick={() => handleCopy(msg.text, `${i}`)}
                            style={{ fontSize: 10, color: T.textMute, cursor: "pointer", background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, padding: 0, opacity: 0, marginTop: 4, marginLeft: 8 }}
                            className="group-hover:opacity-100 transition-opacity">
                            {copied === `${i}` ? <Check style={{ width: 10, height: 10 }} /> : <Copy style={{ width: 10, height: 10 }} />}
                            {copied === `${i}` ? "Copied" : "Copy"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Empty State / Suggestions */}
                {history.length === 0 && !loading && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 0" }}>
                    <AIAnimation accent={accent} />

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, height: 80, width: "100%" }}>
                      <p style={{ fontSize: 10, color: T.textMute, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace", margin: 0 }}>Try asking</p>
                      <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
                        <AnimatePresence mode="wait">
                          <motion.button
                            key={suggestionIndex}
                            onClick={() => setInputText(CHAT_SUGGESTIONS[suggestionIndex])}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.4 }}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", textAlign: "center", fontSize: 13, color: T.textSub, cursor: "pointer", transition: "color 0.2s", maxWidth: 280, position: "absolute", top: 0, border: "none", background: "transparent" }}
                            onMouseEnter={e => { e.currentTarget.style.color = accent; }}
                            onMouseLeave={e => { e.currentTarget.style.color = T.textSub; }}>
                            {CHAT_SUGGESTIONS[suggestionIndex]}
                            <CornerDownLeft style={{ width: 14, height: 14, opacity: 0.5, flexShrink: 0 }} />
                          </motion.button>
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                )}

                {loading && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[0,1,2].map(i => (
                        <motion.div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: accent }}
                          animate={{ opacity: [0.3,1,0.3], scale: [0.8,1.1,0.8] }}
                          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: T.textMute, fontFamily: "monospace" }}>Thinking…</span>
                  </div>
                )}
                <div ref={bottomRef} />
              </>
            )}

            {/* ── CARD PREVIEW (shared) ── */}
            {(mode === "GENERATE" || mode === "EXTRACT_TEXT" || mode === "UPLOAD_PDF") && showCardPreview && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{generatedCards.length} cards</span>
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: `${accent}15`, color: accent, border: `1px solid ${accent}30`, fontFamily: "monospace", fontWeight: 600 }}>PREVIEW</span>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={addBlankCard} style={{ fontSize: 12, color: accent, cursor: "pointer", background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                      <Plus style={{ width: 12, height: 12 }} />Add
                    </button>
                    <button onClick={() => { setShowCardPreview(false); setGeneratedCards([]); }}
                      style={{ fontSize: 12, color: T.textSub, cursor: "pointer", background: "none", border: "none", display: "flex", alignItems: "center", gap: 4 }}>
                      <RotateCcw style={{ width: 12, height: 12 }} />Reset
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {generatedCards.map((card, idx) => (
                    <motion.div key={card.id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -12 }}
                      transition={{ delay: idx * 0.025 }}
                      style={flat()}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px 6px 12px", borderBottom: `1px solid ${d ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`, background: d ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", borderRadius: "9px 9px 0 0" }}>
                        <span style={{ fontSize: 10, color: T.textMute, fontFamily: "monospace" }}>#{idx + 1}</span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => toggleEdit(card.id)} style={{ fontSize: 10, color: card.editing ? accent : T.textSub, cursor: "pointer", background: "none", border: "none", display: "flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
                            <Edit3 style={{ width: 10, height: 10 }} />{card.editing ? "Done" : "Edit"}
                          </button>
                          <button onClick={() => deleteCard(card.id)} style={{ fontSize: 10, color: T.textMute, cursor: "pointer", background: "none", border: "none", display: "flex", alignItems: "center", gap: 3 }}
                            onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                            onMouseLeave={e => (e.currentTarget.style.color = T.textMute)}>
                            <Trash2 style={{ width: 10, height: 10 }} />
                          </button>
                        </div>
                      </div>
                      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                        <div>
                          <p style={{ fontSize: 10, color: accent, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "monospace", margin: "0 0 4px" }}>Front</p>
                          {card.editing
                            ? <textarea value={card.front} onChange={e => updateCard(card.id, "front", e.target.value)} rows={2} style={{ ...flatInput, resize: "none" }} />
                            : <p style={{ fontSize: 13, color: T.text, margin: 0, lineHeight: 1.5 }}>{card.front || <span style={{ color: T.textMute, fontStyle: "italic" }}>Empty</span>}</p>}
                        </div>
                        <div style={{ borderTop: `1px dashed ${T.border}`, paddingTop: 8 }}>
                          <p style={{ fontSize: 10, color: T.textSub, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "monospace", margin: "0 0 4px" }}>Back</p>
                          {card.editing
                            ? <textarea value={card.back} onChange={e => updateCard(card.id, "back", e.target.value)} rows={3} style={{ ...flatInput, resize: "none" }} />
                            : <p style={{ fontSize: 12, color: T.textSub, margin: 0, lineHeight: 1.5 }}>{card.back || <span style={{ color: T.textMute, fontStyle: "italic" }}>Empty</span>}</p>}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Deck selector */}
                <div style={{ ...flat(), padding: 14, display: "flex", flexDirection: "column", gap: 10, position: "sticky", bottom: 0, background: T.bg, border: `1px solid ${T.border}` }}>
                  <p style={{ fontSize: 11, color: T.textMute, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace", margin: 0 }}>Save to deck</p>
                  {!showNewDeckInput ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ position: "relative" }}>
                        <select value={selectedDeckId} onChange={e => setSelectedDeckId(e.target.value)}
                          style={{ ...flatInput, appearance: "none", paddingRight: 32, cursor: "pointer" }}>
                          <option value="">— Select a deck —</option>
                          {decks.map(d => <option key={d.id} value={d.id}>{d.title} ({d.cardCount} cards)</option>)}
                        </select>
                        <ChevronDown style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: T.textSub, pointerEvents: "none" }} />
                      </div>
                      <button onClick={() => setShowNewDeckInput(true)}
                        style={{ fontSize: 12, color: accent, cursor: "pointer", background: "none", padding: "6px 0", border: "none", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                        <Plus style={{ width: 12, height: 12 }} />Create new deck
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <input autoFocus type="text" value={newDeckName} onChange={e => setNewDeckName(e.target.value)}
                        onKeyDown={e => e.key === "Escape" && setShowNewDeckInput(false)}
                        placeholder="New deck name…" style={{ ...flatInput, borderColor: accent }} />
                      <input type="text" value={newDeckDesc} onChange={e => setNewDeckDesc(e.target.value)}
                        onKeyDown={e => e.key === "Escape" && setShowNewDeckInput(false)}
                        placeholder="Description (optional)…" style={{ ...flatInput, fontSize: 12 }} />
                      <button onClick={() => { setShowNewDeckInput(false); setNewDeckName(""); setNewDeckDesc(""); }}
                        style={{ fontSize: 11, color: T.textSub, cursor: "pointer", background: "none", border: "none", textAlign: "left", padding: 0 }}>
                        ← Pick existing deck
                      </button>
                    </div>
                  )}
                  <button onClick={handleSaveCards} disabled={savingCards || creatingDeck || !generatedCards.filter(c => c.front && c.back).length}
                    style={{ ...btn("primary"), display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 16px", opacity: (savingCards || creatingDeck || !generatedCards.filter(c => c.front && c.back).length) ? 0.45 : 1 }}>
                    {savingCards || creatingDeck ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Save style={{ width: 14, height: 14 }} />}
                    {savingCards ? "Saving…" : creatingDeck ? "Creating…" : `Save ${generatedCards.filter(c => c.front && c.back).length} cards`}
                  </button>
                </div>
              </div>
            )}

            {/* ── GENERATE hint ── */}
            {mode === "GENERATE" && !showCardPreview && !loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 0" }}>
                <AIAnimation accent={accent} />

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, height: 80, width: "100%" }}>
                  <p style={{ fontSize: 10, color: T.textMute, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace", margin: 0 }}>Try asking</p>
                  <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
                    <AnimatePresence mode="wait">
                      <motion.button
                        key={suggestionIndex}
                        onClick={() => setInputText(GENERATE_SUGGESTIONS[suggestionIndex])}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.4 }}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", textAlign: "center", fontSize: 13, color: T.textSub, cursor: "pointer", transition: "color 0.2s", maxWidth: 280, position: "absolute", top: 0, border: "none", background: "transparent" }}
                        onMouseEnter={e => { e.currentTarget.style.color = accent; }}
                        onMouseLeave={e => { e.currentTarget.style.color = T.textSub; }}>
                        {GENERATE_SUGGESTIONS[suggestionIndex]}
                        <CornerDownLeft style={{ width: 14, height: 14, opacity: 0.5, flexShrink: 0 }} />
                      </motion.button>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )}

            {/* ── EXTRACT TEXT hint ── */}
            {mode === "EXTRACT_TEXT" && !showCardPreview && !loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 0" }}>
                <AIAnimation accent={accent} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <p style={{ fontSize: 10, color: T.textMute, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace", margin: 0 }}>Paste study text below</p>
                  <p style={{ fontSize: 13, color: T.textSub, margin: 0, textAlign: "center", maxWidth: 280 }}>AI will extract key concepts from your notes, articles, or any text to craft flashcard pairs.</p>
                </div>
              </div>
            )}

            {/* ── UPLOAD PDF ── */}
            {mode === "UPLOAD_PDF" && !showCardPreview && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 0" }}>
                <div
                  onDragOver={e => { e.preventDefault(); setPdfDragging(true); }}
                  onDragLeave={() => setPdfDragging(false)}
                  onDrop={e => { e.preventDefault(); setPdfDragging(false); const f = e.dataTransfer.files?.[0]; if (f?.type === "application/pdf") setPdfFile(f); }}
                  onClick={() => !pdfFile && fileInputRef.current?.click()}
                  style={{ position: "relative", width: "100%", maxWidth: 320, border: pdfFile ? "none" : `2px dashed ${pdfDragging ? accent : "transparent"}`, borderRadius: 12, padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: pdfFile ? "default" : "pointer", background: "transparent", transition: "all 0.2s", textAlign: "center" }}>
                  
                  <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setPdfFile(f); }} />
                  
                  {!pdfFile && (
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                      <AIAnimation accent={accent} />
                    </div>
                  )}

                  <div style={{ zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    {pdfFile ? (
                      <>
                        <div style={{ width: 42, height: 42, borderRadius: 10, background: `${accent}15`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                          <FileUp style={{ width: 20, height: 20, color: accent }} />
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: "0 0 4px" }}>{pdfFile.name}</p>
                        <p style={{ fontSize: 11, color: T.textSub, margin: "0 0 16px" }}>{(pdfFile.size / 1024).toFixed(0)} KB · PDF</p>
                        
                        {!loading && (
                          <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", justifyContent: "center" }}>
                            {/* Card Count Dropdown inline for PDF */}
                            <div style={{ position: "relative" }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowCountMenu(!showCountMenu); }}
                                title="Number of cards to generate"
                                className={d ? "bg-white/5 border border-white/10 text-zinc-100 hover:bg-white/10" : "bg-[#22223b]/5 border border-[#22223b]/15 text-[#22223b] hover:bg-[#22223b]/10"}
                                style={{ padding: "0 12px", height: 36, borderRadius: 9999, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s", border: "none" }}
                              >
                                {cardCount} Cards <ChevronDown style={{ width: 14, height: 14, marginLeft: 4, opacity: 0.7 }} />
                              </button>

                              {showCountMenu && (
                                <>
                                  <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={(e) => { e.stopPropagation(); setShowCountMenu(false); }} />
                                  <div style={{ position: "absolute", bottom: "100%", right: "50%", transform: "translateX(50%)", marginBottom: 8, background: d ? "#0c0c0c" : "#fdfbfb", border: d ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(201,173,167,0.3)", borderRadius: 6, padding: 8, display: "flex", flexDirection: "column", gap: 4, zIndex: 50, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)" }}>
                                    {[3, 5, 8, 10, 15].map(n => (
                                      <button key={n} onClick={(e) => { e.stopPropagation(); setCardCount(n); setShowCountMenu(false); }}
                                        style={{ padding: "8px 12px", borderRadius: 4, fontSize: 13, background: cardCount === n ? `${accent}15` : "transparent", color: cardCount === n ? accent : T.text, border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.2s" }}
                                        onMouseEnter={ev => { if (cardCount !== n) ev.currentTarget.style.background = d ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"; }}
                                        onMouseLeave={ev => { if (cardCount !== n) ev.currentTarget.style.background = "transparent"; }}>
                                        {n} Cards
                                      </button>
                                    ))}
                                    <div style={{ height: 1, background: d ? "rgba(255,255,255,0.1)" : "rgba(201,173,167,0.3)", margin: "4px 0" }} />
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px" }}>
                                      <span style={{ fontSize: 12, color: T.textSub, fontWeight: 500 }}>Custom</span>
                                      <input type="number" min={1} max={15} value={cardCount}
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => {
                                          let v = parseInt(e.target.value);
                                          if (isNaN(v)) return;
                                          if (v > 15) v = 15;
                                          if (v < 1) v = 1;
                                          setCardCount(v);
                                        }}
                                        style={{ width: 48, padding: "4px", borderRadius: 4, background: d ? "rgba(255,255,255,0.05)" : "#ffffff", border: d ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(201,173,167,0.5)", color: T.text, fontSize: 13, outline: "none", textAlign: "center" }}
                                      />
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>

                            <button onClick={(e) => { e.stopPropagation(); handlePdfExtract(); }} style={{ ...btn("primary"), display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "0 16px", height: 36, borderRadius: 9999 }}>
                              <Wand2 style={{ width: 14, height: 14 }} />Extract Cards
                            </button>
                          </div>
                        )}
                        
                        <button onClick={e => { e.stopPropagation(); setPdfFile(null); }} style={{ fontSize: 11, color: T.textMute, cursor: "pointer", background: "none", border: "none", marginTop: 12 }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                          onMouseLeave={e => (e.currentTarget.style.color = T.textMute)}>Remove PDF</button>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: 10, color: T.textMute, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace", margin: "40px 0 0" }}>Drop a PDF here</p>
                        <p style={{ fontSize: 13, color: T.textSub, margin: "12px 0 0" }}>or click to browse · max 10 MB</p>
                      </>
                    )}
                  </div>
                </div>

                {loading && pdfFile && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 0" }}>
                    <div style={{ display: "flex", gap: 5 }}>
                      {[0,1,2,3].map(i => (
                        <motion.div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: accent }}
                          animate={{ opacity: [0.2,1,0.2], scale: [0.7,1.2,0.7] }}
                          transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.17 }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: T.textMute, fontFamily: "monospace" }}>Parsing PDF and generating cards…</span>
                  </div>
                )}
              </div>
            )}

            {/* ── QUIZ ── */}
            {mode === "QUIZ" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {quizQuestions.length === 0 && !loading && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "40px 0" }}>
                    <AIAnimation accent={accent} />

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, height: 80, width: "100%" }}>
                      <p style={{ fontSize: 10, color: T.textMute, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace", margin: 0 }}>Try asking</p>
                      <div style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}>
                        <AnimatePresence mode="wait">
                          <motion.button
                            key={suggestionIndex}
                            onClick={() => setInputText(QUIZ_SUGGESTIONS[suggestionIndex])}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.4 }}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", textAlign: "center", fontSize: 13, color: T.textSub, cursor: "pointer", transition: "color 0.2s", maxWidth: 280, position: "absolute", top: 0, border: "none", background: "transparent" }}
                            onMouseEnter={e => { e.currentTarget.style.color = accent; }}
                            onMouseLeave={e => { e.currentTarget.style.color = T.textSub; }}>
                            {QUIZ_SUGGESTIONS[suggestionIndex]}
                            <CornerDownLeft style={{ width: 14, height: 14, opacity: 0.5, flexShrink: 0 }} />
                          </motion.button>
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                )}
                {loading && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[0,1,2].map(i => (
                        <motion.div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: accent }}
                          animate={{ opacity: [0.3,1,0.3] }} transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: T.textMute, fontFamily: "monospace" }}>Generating quiz…</span>
                  </div>
                )}

                {quizQuestions.length > 0 && (
                  <>

                    {quizQuestions.map((q, qi) => (
                      <motion.div key={qi} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: qi * 0.05 }}
                        style={{ padding: "12px 0", borderBottom: qi === quizQuestions.length - 1 ? "none" : `1px solid ${T.border}` }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                          <span style={{ fontSize: 11, color: accent, fontFamily: "monospace", fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${accent}15`, marginTop: 2 }}>Q{qi + 1}</span>
                          <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0, lineHeight: 1.5 }}>{q.question}</p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 38 }}>
                          {Object.entries(q.options).map(([letter, text]) => {
                            const isSelected = quizAnswers[qi] === letter;
                            const isCorrect = quizSubmitted && letter === q.answer;
                            const isWrong = quizSubmitted && isSelected && !isCorrect;
                            return (
                              <button key={letter} onClick={() => !quizSubmitted && setQuizAnswers(p => ({ ...p, [qi]: letter }))}
                                style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 8, fontSize: 13, textAlign: "left", cursor: quizSubmitted ? "default" : "pointer", transition: "all 0.15s",
                                  background: isCorrect ? (d ? "rgba(52,211,153,0.15)" : "#dcfce7") : isWrong ? (d ? "rgba(239,68,68,0.15)" : "#fee2e2") : isSelected ? `${accent}15` : (d ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"),
                                  border: `1px solid ${isCorrect ? (d ? "rgba(52,211,153,0.4)" : "#86efac") : isWrong ? (d ? "rgba(239,68,68,0.4)" : "#fca5a5") : isSelected ? `${accent}50` : "transparent"}`,
                                  color: isCorrect ? (d ? "#4ade80" : "#166534") : isWrong ? (d ? "#f87171" : "#991b1b") : isSelected ? T.text : T.textSub }}>
                                <span style={{ fontWeight: 700, flexShrink: 0, color: isSelected || isCorrect || isWrong ? "inherit" : T.textMute }}>{letter}.</span>
                                <span style={{ flex: 1 }}>{text}</span>
                                {isCorrect && <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />}
                                {isWrong && <X style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    ))}
                    {!quizSubmitted ? (
                      <button onClick={() => { setQuizSubmitted(true); setShowScorePopup(true); }}
                        disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                        style={{ ...btn("primary"), padding: "11px 16px", opacity: Object.keys(quizAnswers).length < quizQuestions.length ? 0.4 : 1 }}>
                        Submit Answers
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={() => { setQuizQuestions([]); setQuizAnswers({}); setQuizSubmitted(false); setShowScorePopup(false); setInputText(""); }}
                          style={{ ...btn("primary"), padding: "11px 16px", flex: 1 }}>
                          Try Another Topic
                        </button>
                        <button onClick={() => setShowScorePopup(true)}
                          style={{ ...btn("ghost"), padding: "11px 16px" }}>
                          View Score
                        </button>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>
            )}

            {/* Loading spinners for generate/extract */}
            {loading && (mode === "GENERATE" || mode === "EXTRACT_TEXT") && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "30px 0" }}>
                <div style={{ display: "flex", gap: 5 }}>
                  {[0,1,2,3].map(i => (
                    <motion.div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: accent }}
                      animate={{ opacity: [0.2,1,0.2], scale: [0.7,1.2,0.7] }}
                      transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.17 }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, color: T.textMute, fontFamily: "monospace" }}>
                  {mode === "GENERATE" ? "Generating flashcards…" : "Extracting cards from text…"}
                </span>
              </div>
            )}
          </div>

          {/* ── Input footer ── */}
          {(mode === "CHAT" || mode === "GENERATE" || mode === "EXTRACT_TEXT" || (mode === "QUIZ" && quizQuestions.length === 0)) && !showCardPreview && (
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, flexShrink: 0, background: T.bg }}>
              {mode === "EXTRACT_TEXT" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Paste your study notes or article here…" rows={5}
                    style={{ ...flatInput, resize: "none", lineHeight: 1.5 }} />
                  
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    {/* Count Dropdown */}
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => setShowCountMenu(!showCountMenu)}
                        title="Number of cards to extract"
                        className={d ? "bg-white/5 border border-white/10 text-zinc-100 hover:bg-white/10" : "bg-[#22223b]/5 border border-[#22223b]/15 text-[#22223b] hover:bg-[#22223b]/10"}
                        style={{ padding: "0 12px", height: 36, borderRadius: 9999, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s", border: "none" }}
                      >
                        {cardCount} Cards <ChevronDown style={{ width: 14, height: 14, marginLeft: 4, opacity: 0.7 }} />
                      </button>

                      {showCountMenu && (
                        <>
                          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowCountMenu(false)} />
                          <div style={{ position: "absolute", bottom: "100%", left: 0, marginBottom: 8, background: d ? "#0c0c0c" : "#fdfbfb", border: d ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(201,173,167,0.3)", borderRadius: 6, padding: 8, display: "flex", flexDirection: "column", gap: 4, zIndex: 50, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)" }}>
                            {[3, 5, 8, 10, 15].map(n => (
                              <button key={n} onClick={() => { setCardCount(n); setShowCountMenu(false); }}
                                style={{ padding: "8px 12px", borderRadius: 4, fontSize: 13, background: cardCount === n ? `${accent}15` : "transparent", color: cardCount === n ? accent : T.text, border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.2s" }}
                                onMouseEnter={e => { if (cardCount !== n) e.currentTarget.style.background = d ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"; }}
                                onMouseLeave={e => { if (cardCount !== n) e.currentTarget.style.background = "transparent"; }}>
                                {n} Cards
                              </button>
                            ))}
                            <div style={{ height: 1, background: d ? "rgba(255,255,255,0.1)" : "rgba(201,173,167,0.3)", margin: "4px 0" }} />
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px" }}>
                              <span style={{ fontSize: 12, color: T.textSub, fontWeight: 500 }}>Custom</span>
                              <input type="number" min={1} max={40} value={cardCount}
                                onChange={e => {
                                  let v = parseInt(e.target.value);
                                  if (isNaN(v)) return;
                                  if (v > 40) v = 40;
                                  if (v < 1) v = 1;
                                  setCardCount(v);
                                }}
                                style={{ width: 48, padding: "4px", borderRadius: 4, background: d ? "rgba(255,255,255,0.05)" : "#ffffff", border: d ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(201,173,167,0.5)", color: T.text, fontSize: 13, outline: "none", textAlign: "center" }}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <button onClick={handleExtractFromText} disabled={!inputText.trim() || loading}
                      style={{ ...btn("primary"), display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "0 16px", height: 36, borderRadius: 9999, opacity: (!inputText.trim() || loading) ? 0.4 : 1, flex: 1 }}>
                      {loading ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Wand2 style={{ width: 14, height: 14 }} />}
                      {loading ? "Extracting…" : "Extract Cards"}
                    </button>
                  </div>
                </div>
              ) : mode === "QUIZ" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input type="text" value={inputText} onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleGenerateQuiz()}
                    placeholder="Quiz topic (e.g. World War II)…"
                    className={d ? "bg-white/5 border border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-white/25" : "bg-[#22223b]/5 border border-[#22223b]/15 text-[#22223b] placeholder:text-[#9a8c98] focus:border-[#22223b]/30"}
                    style={{ flex: 1, borderRadius: 9999, padding: "10px 16px", fontSize: 13, outline: "none", transition: "all 0.2s" }} />
                  
                  {/* Quiz Count Dropdown */}
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => setShowCountMenu(!showCountMenu)}
                      title="Number of quiz questions"
                      className={d ? "bg-white/5 border border-white/10 text-zinc-100 hover:bg-white/10" : "bg-[#22223b]/5 border border-[#22223b]/15 text-[#22223b] hover:bg-[#22223b]/10"}
                      style={{ padding: "0 12px", height: 36, borderRadius: 9999, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s", border: "none" }}
                    >
                      {quizCount} Qs <ChevronDown style={{ width: 14, height: 14, marginLeft: 4, opacity: 0.7 }} />
                    </button>

                    {showCountMenu && (
                      <>
                        <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowCountMenu(false)} />
                        <div style={{ position: "absolute", bottom: "100%", right: 0, marginBottom: 8, background: d ? "#0c0c0c" : "#fdfbfb", border: d ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(201,173,167,0.3)", borderRadius: 6, padding: 8, display: "flex", flexDirection: "column", gap: 4, zIndex: 50, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)" }}>
                          {[3, 4, 5, 8, 10].map(n => (
                            <button key={n} onClick={() => { setQuizCount(n); setShowCountMenu(false); }}
                              style={{ padding: "8px 12px", borderRadius: 4, fontSize: 13, background: quizCount === n ? `${accent}15` : "transparent", color: quizCount === n ? accent : T.text, border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.2s" }}
                              onMouseEnter={e => { if (quizCount !== n) e.currentTarget.style.background = d ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"; }}
                              onMouseLeave={e => { if (quizCount !== n) e.currentTarget.style.background = "transparent"; }}>
                              {n} Questions
                            </button>
                          ))}
                          <div style={{ height: 1, background: d ? "rgba(255,255,255,0.1)" : "rgba(201,173,167,0.3)", margin: "4px 0" }} />
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px" }}>
                            <span style={{ fontSize: 12, color: T.textSub, fontWeight: 500 }}>Custom</span>
                            <input type="number" min={1} max={40} value={quizCount}
                              onChange={e => {
                                let v = parseInt(e.target.value);
                                if (isNaN(v)) return;
                                if (v > 40) v = 40;
                                if (v < 1) v = 1;
                                setQuizCount(v);
                              }}
                              style={{ width: 48, padding: "4px", borderRadius: 4, background: d ? "rgba(255,255,255,0.05)" : "#ffffff", border: d ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(201,173,167,0.5)", color: T.text, fontSize: 13, outline: "none", textAlign: "center" }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button onClick={handleGenerateQuiz} disabled={!inputText.trim() || loading}
                    className={d ? "bg-white text-black hover:bg-zinc-200" : "bg-[#22223b] text-[#f2e9e4] hover:bg-[#1a1a2e]"}
                    style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", opacity: (!inputText.trim() || loading) ? 0.3 : 1, cursor: (!inputText.trim() || loading) ? "default" : "pointer", flexShrink: 0, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", border: "none" }}>
                    {loading ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : <HelpCircle style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input type="text" value={inputText} onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (mode === "CHAT" ? handleChat() : handleGenerateCards())}
                    placeholder={mode === "CHAT" ? "Ask anything…" : "Topic to generate cards for…"}
                    className={d ? "bg-white/5 border border-white/10 text-zinc-100 placeholder:text-zinc-600 focus:border-white/25" : "bg-[#22223b]/5 border border-[#22223b]/15 text-[#22223b] placeholder:text-[#9a8c98] focus:border-[#22223b]/30"}
                    style={{ flex: 1, borderRadius: 9999, padding: "10px 16px", fontSize: 13, outline: "none", transition: "all 0.2s" }} />
                  
                  {mode === "GENERATE" && (
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => setShowCountMenu(!showCountMenu)}
                        title="Number of cards to generate"
                        className={d ? "bg-white/5 border border-white/10 text-zinc-100 hover:bg-white/10" : "bg-[#22223b]/5 border border-[#22223b]/15 text-[#22223b] hover:bg-[#22223b]/10"}
                        style={{ padding: "0 12px", height: 36, borderRadius: 9999, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s", border: "none" }}
                      >
                        {cardCount} Cards <ChevronDown style={{ width: 14, height: 14, marginLeft: 4, opacity: 0.7 }} />
                      </button>

                      {showCountMenu && (
                        <>
                          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowCountMenu(false)} />
                          <div style={{ position: "absolute", bottom: "100%", right: 0, marginBottom: 8, background: d ? "#0c0c0c" : "#fdfbfb", border: d ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(201,173,167,0.3)", borderRadius: 6, padding: 8, display: "flex", flexDirection: "column", gap: 4, zIndex: 50, boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)" }}>
                            {[3, 5, 8, 10, 15].map(n => (
                              <button key={n} onClick={() => { setCardCount(n); setShowCountMenu(false); }}
                                style={{ padding: "8px 12px", borderRadius: 4, fontSize: 13, background: cardCount === n ? `${accent}15` : "transparent", color: cardCount === n ? accent : T.text, border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.2s" }}
                                onMouseEnter={e => { if (cardCount !== n) e.currentTarget.style.background = d ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"; }}
                                onMouseLeave={e => { if (cardCount !== n) e.currentTarget.style.background = "transparent"; }}>
                                {n} Cards
                              </button>
                            ))}
                            <div style={{ height: 1, background: d ? "rgba(255,255,255,0.1)" : "rgba(201,173,167,0.3)", margin: "4px 0" }} />
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px" }}>
                              <span style={{ fontSize: 12, color: T.textSub, fontWeight: 500 }}>Custom</span>
                              <input type="number" min={1} max={40} value={cardCount}
                                onChange={e => {
                                  let v = parseInt(e.target.value);
                                  if (isNaN(v)) return;
                                  if (v > 40) v = 40;
                                  if (v < 1) v = 1;
                                  setCardCount(v);
                                }}
                                style={{ width: 48, padding: "4px", borderRadius: 4, background: d ? "rgba(255,255,255,0.05)" : "#ffffff", border: d ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(201,173,167,0.5)", color: T.text, fontSize: 13, outline: "none", textAlign: "center" }}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <button onClick={mode === "CHAT" ? handleChat : handleGenerateCards}
                    disabled={!inputText.trim() || loading}
                    className={d ? "bg-white text-black hover:bg-zinc-200" : "bg-[#22223b] text-[#f2e9e4] hover:bg-[#1a1a2e]"}
                    style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", opacity: (!inputText.trim() || loading) ? 0.3 : 1, cursor: (!inputText.trim() || loading) ? "default" : "pointer", flexShrink: 0, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)", border: "none" }}>
                    {loading ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : mode === "GENERATE" ? <Wand2 style={{ width: 16, height: 16 }} /> : <Send style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
              )}
            </div>
          )}
          <AnimatePresence>
            {showScorePopup && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  style={{ ...flat({ padding: 24 }), textAlign: "center", width: "80%", maxWidth: 320, background: T.bg, border: `1px solid ${accent}50`, boxShadow: `0 20px 40px -10px rgba(0,0,0,0.5)` }}
                >
                  <div style={{ width: 60, height: 60, margin: "0 auto 16px", borderRadius: "50%", background: `${accent}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                     <span style={{ fontSize: 24 }}>{quizScore === quizQuestions.length ? "🎉" : quizScore >= quizQuestions.length / 2 ? "👍" : "📚"}</span>
                  </div>
                  <p style={{ fontSize: 36, fontWeight: 800, color: T.text, margin: "0 0 8px", fontFamily: "sans-serif" }}>{quizScore}<span style={{ fontSize: 20, color: T.textMute }}>/{quizQuestions.length}</span></p>
                  <p style={{ fontSize: 14, color: T.textSub, margin: "0 0 24px" }}>
                    {quizScore === quizQuestions.length ? "Perfect score!" : quizScore >= quizQuestions.length / 2 ? "Good effort!" : "Keep studying!"}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button onClick={() => { setShowScorePopup(false); }}
                      style={{ ...btn("ghost"), width: "100%" }}>
                      Review Answers
                    </button>
                    <button onClick={() => { setQuizQuestions([]); setQuizAnswers({}); setQuizSubmitted(false); setShowScorePopup(false); setInputText(""); }}
                      style={{ ...btn("primary"), width: "100%" }}>
                      Try Another Topic
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
