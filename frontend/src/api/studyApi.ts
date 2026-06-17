// frontend/src/api/studyApi.ts
import { axiosClient } from "./axiosClient";
import { Flashcard } from "../types";

// ─── API Response Types ────────────────────────────────────────────────────

export interface DueCardResponse {
  card_id: string;
  front_text: string;
  back_text: string;
  current_interval_days: number;
}

export type SrsGrade = "Again" | "Hard" | "Good" | "Easy";

export interface GradeResponse {
  success: boolean;
  next_review_date: string; // ISO date string e.g. "2026-06-12"
  new_interval_days: number;
}

// ─── Map API → Flashcard ───────────────────────────────────────────────────

export function mapDueCardToFlashcard(card: DueCardResponse): Flashcard {
  return {
    id: card.card_id, // store real UUID so we can grade it
    question: card.front_text,
    answer: card.back_text,
    details:
      card.current_interval_days > 0
        ? `Last reviewed ${card.current_interval_days} day(s) ago`
        : undefined,
  };
}

// ─── API Calls ─────────────────────────────────────────────────────────────

export async function getDueCards(deckId: string): Promise<DueCardResponse[]> {
  const { data } = await axiosClient.get<DueCardResponse[]>(
    `/api/study/${deckId}/due`
  );
  return data;
}

export async function gradeCard(
  card_id: string,
  grade: SrsGrade
): Promise<GradeResponse> {
  const { data } = await axiosClient.post<GradeResponse>("/api/study/grade", {
    card_id,
    grade,
  });
  return data;
}
