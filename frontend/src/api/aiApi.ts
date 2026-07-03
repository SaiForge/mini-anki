// frontend/src/api/aiApi.ts
import { axiosClient } from "./axiosClient";

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface QuizQuestion {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  answer: string;
}

export interface AICard {
  front: string;
  back: string;
}

// ─── Existing Endpoints ────────────────────────────────────────────────────

export const sendChat = async (message: string, history: ChatMessage[] = []): Promise<string> => {
  const res = await axiosClient.post("/api/ai/chat", { message, history });
  return res.data.reply;
};

export const explainConcept = async (concept: string, context?: string): Promise<string> => {
  const res = await axiosClient.post("/api/ai/explain", { concept, context });
  return res.data.explanation;
};

export const generateQuiz = async (topic: string, count = 3): Promise<QuizQuestion[]> => {
  const res = await axiosClient.post("/api/ai/quiz", { topic, count });
  return res.data.questions;
};

export const summarizeText = async (text: string): Promise<string> => {
  const res = await axiosClient.post("/api/ai/summarize", { text });
  return res.data.summary;
};

// ─── New Card Endpoints ────────────────────────────────────────────────────

/** Generate flashcard pairs for a topic using AI */
export const generateCards = async (topic: string, count = 5): Promise<AICard[]> => {
  const res = await axiosClient.post("/api/ai/generate-cards", { topic, count });
  return res.data.cards;
};

/** Extract flashcard pairs from pasted text using AI */
export const extractCardsFromText = async (text: string, count = 10): Promise<AICard[]> => {
  const res = await axiosClient.post("/api/ai/extract-cards", { text, count });
  return res.data.cards;
};

/** Upload a PDF and extract flashcard pairs from it using AI */
export const extractCardsFromPdf = async (file: File, count = 15): Promise<AICard[]> => {
  const form = new FormData();
  form.append("file", file);
  const res = await axiosClient.post(`/api/ai/extract-cards-pdf?count=${count}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.cards;
};

// ─── AI Sessions ───────────────────────────────────────────────────────────

export interface AISession {
  session_id: string;
  user_id: string;
  mode: "CHAT" | "GENERATE" | "EXTRACT_TEXT" | "UPLOAD_PDF" | "QUIZ";
  title?: string;
  data: any;
  created_at: string;
  updated_at: string;
}

export const getAiSessions = async (): Promise<AISession[]> => {
  const res = await axiosClient.get("/api/ai/sessions");
  return res.data;
};

export const getAiSession = async (sessionId: string): Promise<AISession> => {
  const res = await axiosClient.get(`/api/ai/sessions/${sessionId}`);
  return res.data;
};

export const createAiSession = async (mode: string, title?: string, data?: any): Promise<AISession> => {
  const res = await axiosClient.post("/api/ai/sessions", { mode, title, data });
  return res.data;
};

export const updateAiSession = async (sessionId: string, title?: string, data?: any): Promise<AISession> => {
  const res = await axiosClient.put(`/api/ai/sessions/${sessionId}`, { title, data });
  return res.data;
};

export const deleteAiSession = async (sessionId: string): Promise<void> => {
  await axiosClient.delete(`/api/ai/sessions/${sessionId}`);
};
