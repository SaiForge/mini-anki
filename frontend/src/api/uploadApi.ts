// frontend/src/api/uploadApi.ts
import { axiosClient } from "./axiosClient";

export const uploadAvatar = async (file: File): Promise<string> => {
  const form = new FormData();
  form.append("file", file);
  const res = await axiosClient.post("/api/uploads/avatar", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.url;
};

export const uploadPostImage = async (file: File): Promise<string> => {
  const form = new FormData();
  form.append("file", file);
  const res = await axiosClient.post("/api/uploads/image", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.url;
};

/** Resolve a URL — if it starts with /uploads/, prefix the API base URL */
export const resolveMediaUrl = (url: string | null | undefined): string => {
  if (!url) return "";
  if (url.startsWith("/uploads/")) {
    // axiosClient.defaults.baseURL is already set from VITE_API_URL
    const base = (axiosClient.defaults.baseURL || "").replace(/\/$/, "");
    return `${base}${url}`;
  }
  return url;
};
