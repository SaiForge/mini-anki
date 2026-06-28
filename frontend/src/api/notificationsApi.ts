// frontend/src/api/notificationsApi.ts
import { axiosClient } from "./axiosClient";

export interface NotificationItem {
  notification_id: string;
  type: "LIKE" | "COMMENT" | "FOLLOW" | "DECK_FORK" | "REPLY" | "BOOKMARK" | "SYSTEM";
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
  actor: {
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export const getUnreadCount = async (): Promise<number> => {
  const res = await axiosClient.get("/api/notifications/unread-count");
  return res.data.unread_count;
};

export const getNotifications = async (skip = 0, limit = 30): Promise<NotificationItem[]> => {
  const res = await axiosClient.get("/api/notifications", { params: { skip, limit } });
  return res.data;
};

export const markOneRead = async (id: string): Promise<void> => {
  await axiosClient.put(`/api/notifications/${id}/read`);
};

export const markAllRead = async (): Promise<void> => {
  await axiosClient.put("/api/notifications/read-all");
};

export const deleteNotification = async (id: string): Promise<void> => {
  await axiosClient.delete(`/api/notifications/${id}`);
};
