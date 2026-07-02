// frontend/src/api/analyticsApi.ts
import { axiosClient } from "./axiosClient";

export interface StudyStats {
  total_cards: number;
  cards_due_today: number;
  total_decks: number;
  total_posts: number;
  likes_received: number;
  daily_streak: number;
}

export interface DayCount {
  date: string;
  count: number;
}



export const getStudyStats = async (): Promise<StudyStats> => {
  const res = await axiosClient.get("/api/analytics/study-stats");
  return res.data;
};

export const getReviewHistory = async (days = 30): Promise<DayCount[]> => {
  const res = await axiosClient.get("/api/analytics/review-history", { params: { days } });
  return res.data;
};


