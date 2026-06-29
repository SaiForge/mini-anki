// frontend/src/api/authApi.ts
import { axiosClient } from "./axiosClient";

export interface UserResponse {
  user_id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  profile_picture_url: string | null;
  website_url?: string | null;
  location?: string | null;
  is_public?: boolean;
  tags?: string[] | null;
  created_at: string;
  is_verified: boolean;
  current_streak: number;
  last_review_date: string | null;
  gender: string | null;
  dob: string | null;
  role: string | null;
  followers_count?: number;
  following_count?: number;
}

export interface UserUpdatePayload {
  username?: string | null;
  full_name?: string | null;
  bio?: string | null;
  profile_picture_url?: string | null;
  website_url?: string | null;
  location?: string | null;
  is_public?: boolean;
  tags?: string[] | null;
  gender?: string | null;
  dob?: string | null;
  role?: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface MessageResponse {
  message: string;
}

export async function login(
  email: string,
  password: string
): Promise<TokenResponse> {
  const { data } = await axiosClient.post<TokenResponse>("/api/auth/login", {
    email,
    password,
  });
  return data;
}

export async function googleLogin(token: string): Promise<TokenResponse> {
  const { data } = await axiosClient.post<TokenResponse>("/api/auth/google", {
    token,
  });
  return data;
}

export async function register(payload: {
  email: string;
  password: string;
  username: string;
  full_name: string;
  bio?: string;
  profile_picture_url?: string | null;
  gender?: string | null;
  dob?: string | null;
  role?: string | null;
}): Promise<MessageResponse> {
  const { data } = await axiosClient.post<MessageResponse>(
    "/api/auth/register",
    payload
  );
  return data;
}

export async function checkUsername(username: string): Promise<{ available: boolean }> {
  const { data } = await axiosClient.get<{ available: boolean }>(
    `/api/auth/check-username?username=${encodeURIComponent(username)}`
  );
  return data;
}

export async function getMe(): Promise<UserResponse> {
  const { data } = await axiosClient.get<UserResponse>("/api/auth/me");
  return data;
}

export async function updateMe(payload: UserUpdatePayload): Promise<UserResponse> {
  const { data } = await axiosClient.put<UserResponse>("/api/auth/me", payload);
  return data;
}

export async function deleteAccount(): Promise<MessageResponse> {
  const { data } = await axiosClient.delete<MessageResponse>("/api/auth/users/me");
  return data;
}

export async function forgotPassword(email: string): Promise<MessageResponse> {
  const { data } = await axiosClient.post<MessageResponse>(
    "/api/auth/forgot-password",
    { email }
  );
  return data;
}

export async function resetPassword(
  token: string,
  new_password: string
): Promise<MessageResponse> {
  const { data } = await axiosClient.post<MessageResponse>(
    "/api/auth/reset-password",
    { token, new_password }
  );
  return data;
}
