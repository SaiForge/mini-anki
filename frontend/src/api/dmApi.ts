// frontend/src/api/dmApi.ts
import { axiosClient } from "./axiosClient";

export interface DmConversation {
  partner_id: string;
  partner_username: string | null;
  partner_full_name: string | null;
  partner_avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  is_mine: boolean;
}

export interface DmMessage {
  message_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  is_read: boolean;
  is_edited: boolean;
  created_at: string;
  sender_username: string | null;
  sender_full_name: string | null;
  sender_avatar_url: string | null;
}

export const getDmUnreadCount = async (): Promise<number> => {
  const res = await axiosClient.get("/api/dm/unread-count");
  return res.data.unread_count;
};

export const listConversations = async (): Promise<DmConversation[]> => {
  const res = await axiosClient.get("/api/dm/conversations");
  return res.data;
};

export const getThread = async (userId: string, skip = 0, limit = 50): Promise<DmMessage[]> => {
  const res = await axiosClient.get(`/api/dm/${userId}`, { params: { skip, limit } });
  return res.data;
};

export const sendMessage = async (userId: string, body: string): Promise<DmMessage> => {
  const res = await axiosClient.post(`/api/dm/${userId}`, { body });
  return res.data;
};

export const markThreadRead = async (userId: string): Promise<void> => {
  await axiosClient.put(`/api/dm/${userId}/read`);
};

export const deleteMessage = async (messageId: string): Promise<void> => {
  await axiosClient.delete(`/api/dm/${messageId}`);
};

export const updateMessage = async (messageId: string, body: string): Promise<DmMessage> => {
  const res = await axiosClient.put(`/api/dm/message/${messageId}`, { body });
  return res.data;
};

export const deleteConversation = async (userId: string): Promise<void> => {
  await axiosClient.delete(`/api/dm/conversation/${userId}`);
};
