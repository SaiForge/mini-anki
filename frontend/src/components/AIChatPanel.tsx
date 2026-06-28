import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles, Send, X, HelpCircle, FileText, Loader2, Copy, Check,
  Upload, Plus, Trash2, Edit3, ChevronDown, RotateCcw,
  Wand2, MessageSquare, Save, AlertCircle, CheckCircle2, FileUp,
} from "lucide-react";
import {
  sendChat, generateQuiz, generateCards, extractCardsFromText,
  extractCardsFromPdf, ChatMessage, QuizQuestion, AICard,
} from "../api/aiApi";
import { StudyDeck } from "../types";

// ─── Types ─────────────────────────────────────────────────────────────────

type Mode = "CHAT" | "GENERATE" | "EXTRACT_TEXT" | "UPLOAD_PDF" | "QUIZ";

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  decks: StudyDeck[];
  isDarkMode?: boolean;
  onDeckCreated: (name: string) => Promise<string>;
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
    border:   "var(--color-outline-variant)",
    border2:  "var(--color-outline)",
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
  const [showCardPreview, setShowCardPreview] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [newDeckName, setNewDeckName] = useState("");
  const [creatingDeck, setCreatingDeck] = useState(false);
  const [showNewDeckInput, setShowNewDeckInput] = useState(false);
  const [savingCards, setSavingCards] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDragging, setPdfDragging] = useState(false);
  const [quizCount, setQuizCount] = useState(4);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentMode = MODES.find(m => m.id === mode)!;
  const accent = d ? currentMode.accent : currentMode.accentLight;

  const addToast = useCallback((type: "success" | "error", msg: string) => {
    const id = Date.now().toString();
    setToasts(p => [...p, { id, type, message: msg }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, quizQuestions]);

  useEffect(() => {
    if (isOpen && history.length === 0 && mode === "CHAT") {
      setHistory([{ role: "model", text: "Hi! I'm your AI Study Companion 🧠\n\nI can **chat** about any topic, **generate flashcards**, **extract cards from text or PDFs**, and **quiz you** on anything. What would you like to do?" }]);
    }
  }, [isOpen]);

  const switchMode = (m: Mode) => {
    setMode(m); setGeneratedCards([]); setShowCardPreview(false);
    setQuizQuestions([]); setQuizAnswers({}); setQuizSubmitted(false);
    setPdfFile(null); setInputText("");
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
      setQuizQuestions(qs); setQuizAnswers({}); setQuizSubmitted(false);
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
      try { deckId = await onDeckCreated(newDeckName.trim()); setShowNewDeckInput(false); setNewDeckName(""); onDecksRefresh(); }
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
    background: T.surface,
    border: `1px solid ${T.border}`,
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
        style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end", background: T.overlay }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", width: "100%", maxWidth: 500, background: T.bg, borderLeft: `1px solid ${T.border}` }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Toasts ── */}
          <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 60, width: "90%", pointerEvents: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            <AnimatePresence>
              {toasts.map(t => (
                <motion.div key={t.id}
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500,
                    background: t.type === "success" ? (d ? "#052e16" : "#f0fdf4") : (d ? "#2d0808" : "#fef2f2"),
                    border: `1px solid ${t.type === "success" ? (d ? "#166534" : "#bbf7d0") : (d ? "#991b1b" : "#fecaca")}`,
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
              <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--theme-surface-container)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--theme-outline-variant)" }}>
                <Sparkles style={{ width: 16, height: 16, color: "var(--theme-primary)" }} />
              </div>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--theme-primary)", margin: 0, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI Study Companion</h2>
                <div style={{ fontSize: 10, color: "var(--theme-on-surface-variant)", fontFamily: "monospace", marginTop: 2, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <span>POWERED BY GEMINI</span>
                  <span style={{ background: "var(--theme-surface-container)", border: "1px solid var(--theme-outline-variant)", padding: "2px 6px", borderRadius: 4, color: "var(--theme-on-surface-variant)" }}>SECURED</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.textSub }}>
              <X style={{ width: 15, height: 15 }} />
            </button>
          </div>

          {/* ── Mode tabs ── */}
          <div style={{ display: "flex", gap: 4, padding: "10px 12px", borderBottom: `1px solid ${T.border}`, overflowX: "auto", flexShrink: 0 }} className="no-scrollbar">
            {MODES.map(m => (
              <button key={m.id} onClick={() => switchMode(m.id)} style={pill(mode === m.id, d ? m.accent : m.accentLight)}>
                {m.icon}{m.label}
              </button>
            ))}
          </div>

          {/* ── Mode description ── */}
          <div style={{ padding: "6px 16px 2px", flexShrink: 0 }}>
            <p style={{ fontSize: 11, color: T.textMute, margin: 0 }}>{currentMode.desc}</p>
          </div>

          {/* ── Content ── */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>

            {/* ── CHAT ── */}
            {mode === "CHAT" && (
              <>
                {history.map((msg, i) => (
                  <div key={i} className="group" style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                      <div style={{
                        padding: "16px", borderRadius: "6px",
                        fontSize: 13, lineHeight: 1.6, fontFamily: "monospace",
                        background: "var(--theme-surface-lowest)",
                        color: "var(--theme-primary)",
                        border: "1px dashed var(--theme-outline)",
                        width: "100%",
                      }}>
                        {msg.role === "model" && (
                          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center", width: "100%" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--theme-on-surface-variant)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                              &gt;_ [ SYSTEM ANSWER LOCKED ]
                            </span>
                          </div>
                        )}
                        {msg.role === "user" && (
                          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center", width: "100%" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--theme-on-surface-variant)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                              &lt;&gt; [ TECHNICAL QUERY SECURED ]
                            </span>
                          </div>
                        )}
                        {msg.role === "model" ? renderMarkdown(msg.text, d) : msg.text}
                      </div>
                      {msg.role === "model" && (
                        <button onClick={() => handleCopy(msg.text, `${i}`)}
                          style={{ fontSize: 10, color: T.textMute, cursor: "pointer", background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, padding: 0, opacity: 0 }}
                          className="group-hover:opacity-100 transition-opacity">
                          {copied === `${i}` ? <Check style={{ width: 10, height: 10 }} /> : <Copy style={{ width: 10, height: 10 }} />}
                          {copied === `${i}` ? "Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Suggestions */}
                {history.length <= 1 && !loading && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
                    <p style={{ fontSize: 10, color: T.textMute, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace", margin: 0 }}>Try asking</p>
                    {CHAT_SUGGESTIONS.map(s => (
                      <button key={s} onClick={() => setInputText(s)}
                        style={{ ...flat(), padding: "10px 14px", textAlign: "left", fontSize: 13, color: T.textSub, cursor: "pointer", transition: "border-color 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = accent)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}>
                        {s}
                      </button>
                    ))}
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
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px 6px 12px", borderBottom: `1px solid ${T.border}`, background: T.surface2, borderRadius: "9px 9px 0 0" }}>
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
                      <button onClick={() => { setShowNewDeckInput(false); setNewDeckName(""); }}
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
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={flat({ padding: 14, borderColor: `${accent}40` })}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Wand2 style={{ width: 13, height: 13, color: accent }} />
                    <span style={{ fontSize: 11, color: accent, fontFamily: "monospace", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Cards to generate</span>
                  </div>
                  <p style={{ fontSize: 12, color: T.textSub, margin: "0 0 10px" }}>Enter any topic — AI will craft flashcard pairs for spaced repetition.</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: T.textMute }}>Count:</span>
                    {[3, 5, 8, 10, 15].map(n => <button key={n} onClick={() => setCardCount(n)} style={countBtn(cardCount === n)}>{n}</button>)}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <p style={{ fontSize: 10, color: T.textMute, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace", margin: 0 }}>Examples</p>
                  {["Photosynthesis", "JavaScript Closures", "World War II", "Machine Learning Basics"].map(s => (
                    <button key={s} onClick={() => setInputText(s)} style={{ ...flat({ padding: "9px 12px", textAlign: "left", cursor: "pointer", transition: "border-color 0.15s" }), fontSize: 13, color: T.textSub }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = accent)}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* ── EXTRACT TEXT hint ── */}
            {mode === "EXTRACT_TEXT" && !showCardPreview && !loading && (
              <div style={flat({ padding: 14, borderColor: `${accent}40` })}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <FileText style={{ width: 13, height: 13, color: accent }} />
                  <span style={{ fontSize: 11, color: accent, fontFamily: "monospace", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Paste study text below</span>
                </div>
                <p style={{ fontSize: 12, color: T.textSub, margin: "0 0 10px" }}>AI extracts key concepts from notes, articles, or any text.</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: T.textMute }}>Max cards:</span>
                  {[5, 10, 15, 20].map(n => <button key={n} onClick={() => setCardCount(n)} style={countBtn(cardCount === n)}>{n}</button>)}
                </div>
              </div>
            )}

            {/* ── UPLOAD PDF ── */}
            {mode === "UPLOAD_PDF" && !showCardPreview && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div
                  onDragOver={e => { e.preventDefault(); setPdfDragging(true); }}
                  onDragLeave={() => setPdfDragging(false)}
                  onDrop={e => { e.preventDefault(); setPdfDragging(false); const f = e.dataTransfer.files?.[0]; if (f?.type === "application/pdf") setPdfFile(f); }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: `2px dashed ${pdfDragging ? accent : pdfFile ? `${accent}60` : T.border}`, borderRadius: 12, padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: pdfDragging ? `${accent}08` : T.surface, transition: "all 0.2s", textAlign: "center" }}>
                  <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setPdfFile(f); }} />
                  {pdfFile ? (
                    <>
                      <div style={{ width: 42, height: 42, borderRadius: 10, background: `${accent}15`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                        <FileUp style={{ width: 20, height: 20, color: accent }} />
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: "0 0 4px" }}>{pdfFile.name}</p>
                      <p style={{ fontSize: 11, color: T.textSub, margin: "0 0 8px" }}>{(pdfFile.size / 1024).toFixed(0)} KB · PDF</p>
                      <button onClick={e => { e.stopPropagation(); setPdfFile(null); }} style={{ fontSize: 11, color: T.textMute, cursor: "pointer", background: "none", border: "none" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                        onMouseLeave={e => (e.currentTarget.style.color = T.textMute)}>Remove</button>
                    </>
                  ) : (
                    <>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: T.surface2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                        <Upload style={{ width: 22, height: 22, color: T.textSub }} />
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: "0 0 4px" }}>Drop a PDF here</p>
                      <p style={{ fontSize: 12, color: T.textSub, margin: 0 }}>or click to browse · max 10 MB</p>
                    </>
                  )}
                </div>
                {pdfFile && !loading && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: T.textMute }}>Max cards:</span>
                      {[5, 10, 15, 20, 30].map(n => <button key={n} onClick={() => setCardCount(n)} style={countBtn(cardCount === n)}>{n}</button>)}
                    </div>
                    <button onClick={handlePdfExtract} style={{ ...btn("primary"), display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 16px" }}>
                      <Wand2 style={{ width: 14, height: 14 }} />Extract Cards from PDF
                    </button>
                  </div>
                )}
                {loading && (
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
                {quizQuestions.length === 0 && (
                  <div style={flat({ padding: 14, borderColor: `${accent}40` })}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <HelpCircle style={{ width: 13, height: 13, color: accent }} />
                      <span style={{ fontSize: 11, color: accent, fontFamily: "monospace", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Quiz configuration</span>
                    </div>
                    <p style={{ fontSize: 12, color: T.textSub, margin: "0 0 10px" }}>Enter a topic and choose how many questions.</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: T.textMute }}>Questions:</span>
                      {[3, 4, 5, 8, 10].map(n => <button key={n} onClick={() => setQuizCount(n)} style={countBtn(quizCount === n)}>{n}</button>)}
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
                    {quizSubmitted && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        style={{ ...flat({ padding: 14 }), textAlign: "center" }}>
                        <p style={{ fontSize: 28, fontWeight: 800, color: T.text, margin: "0 0 4px" }}>{quizScore}/{quizQuestions.length}</p>
                        <p style={{ fontSize: 12, color: T.textSub, margin: "0 0 10px" }}>
                          {quizScore === quizQuestions.length ? "🎉 Perfect score!" : quizScore >= quizQuestions.length / 2 ? "👍 Good effort!" : "📚 Keep studying!"}
                        </p>
                        <button onClick={() => { setQuizQuestions([]); setQuizAnswers({}); setQuizSubmitted(false); setInputText(""); }}
                          style={{ fontSize: 12, color: accent, cursor: "pointer", background: "none", border: "none", fontWeight: 600 }}>
                          Try another topic →
                        </button>
                      </motion.div>
                    )}
                    {quizQuestions.map((q, qi) => (
                      <motion.div key={qi} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: qi * 0.05 }}
                        style={flat()}>
                        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
                          <span style={{ fontSize: 10, color: T.textMute, fontFamily: "monospace" }}>Q{qi + 1}</span>
                          <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: "3px 0 0", lineHeight: 1.4 }}>{q.question}</p>
                        </div>
                        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                          {Object.entries(q.options).map(([letter, text]) => {
                            const isSelected = quizAnswers[qi] === letter;
                            const isCorrect = quizSubmitted && letter === q.answer;
                            const isWrong = quizSubmitted && isSelected && !isCorrect;
                            return (
                              <button key={letter} onClick={() => !quizSubmitted && setQuizAnswers(p => ({ ...p, [qi]: letter }))}
                                style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 12px", borderRadius: 8, fontSize: 12, textAlign: "left", cursor: quizSubmitted ? "default" : "pointer", transition: "all 0.15s",
                                  background: isCorrect ? (d ? "rgba(52,211,153,0.1)" : "#f0fdf4") : isWrong ? (d ? "rgba(239,68,68,0.1)" : "#fef2f2") : isSelected ? `${accent}12` : T.surface2,
                                  border: `1px solid ${isCorrect ? (d ? "rgba(52,211,153,0.4)" : "#86efac") : isWrong ? (d ? "rgba(239,68,68,0.4)" : "#fca5a5") : isSelected ? `${accent}50` : T.border}`,
                                  color: isCorrect ? (d ? "#4ade80" : "#166534") : isWrong ? (d ? "#f87171" : "#991b1b") : isSelected ? accent : T.textSub }}>
                                <span style={{ fontWeight: 700, flexShrink: 0, fontSize: 11, marginTop: 1 }}>{letter}.</span>
                                <span style={{ flex: 1 }}>{text}</span>
                                {isCorrect && <CheckCircle2 style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />}
                                {isWrong && <X style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    ))}
                    {!quizSubmitted && (
                      <button onClick={() => setQuizSubmitted(true)}
                        disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                        style={{ ...btn("primary"), padding: "11px 16px", opacity: Object.keys(quizAnswers).length < quizQuestions.length ? 0.4 : 1 }}>
                        Submit Answers
                      </button>
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
                  <button onClick={handleExtractFromText} disabled={!inputText.trim() || loading}
                    style={{ ...btn("primary"), display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 16px", opacity: (!inputText.trim() || loading) ? 0.4 : 1 }}>
                    {loading ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Wand2 style={{ width: 14, height: 14 }} />}
                    {loading ? "Extracting…" : "Extract Cards"}
                  </button>
                </div>
              ) : mode === "QUIZ" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" value={inputText} onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleGenerateQuiz()}
                    placeholder="Quiz topic (e.g. World War II)…"
                    style={{ ...flatInput, flex: 1, borderColor: inputText ? `${accent}60` : T.border }} />
                  <button onClick={handleGenerateQuiz} disabled={!inputText.trim() || loading}
                    style={{ ...btn("primary"), flexShrink: 0, display: "flex", alignItems: "center", gap: 6, opacity: (!inputText.trim() || loading) ? 0.4 : 1 }}>
                    {loading ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <HelpCircle style={{ width: 14, height: 14 }} />}
                    Quiz
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" value={inputText} onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (mode === "CHAT" ? handleChat() : handleGenerateCards())}
                    placeholder={mode === "CHAT" ? "Ask anything…" : "Topic to generate cards for…"}
                    style={{ ...flatInput, flex: 1, borderColor: inputText ? `${accent}60` : T.border }} />
                  <button onClick={mode === "CHAT" ? handleChat : handleGenerateCards}
                    disabled={!inputText.trim() || loading}
                    style={{ ...btn("primary"), flexShrink: 0, display: "flex", alignItems: "center", gap: 6, opacity: (!inputText.trim() || loading) ? 0.4 : 1 }}>
                    {loading ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : mode === "GENERATE" ? <Wand2 style={{ width: 14, height: 14 }} /> : <Send style={{ width: 14, height: 14 }} />}
                    {mode === "GENERATE" ? "Generate" : "Send"}
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
