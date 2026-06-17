import { axiosClient } from "./axiosClient";

export interface PublicUserResponse {
  user_id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  profile_picture_url: string | null;
  website_url: string | null;
  location: string | null;
  tags: string[] | null;
  current_streak: number;
  followers_count: number;
  following_count: number;
}

export async function followUser(userId: string): Promise<{ message: string }> {
  const { data } = await axiosClient.post<{ message: string }>(`/api/social/follow/${userId}`);
  return data;
}

export async function unfollowUser(userId: string): Promise<{ message: string }> {
  const { data } = await axiosClient.delete<{ message: string }>(`/api/social/unfollow/${userId}`);
  return data;
}

export async function getFollowers(userId: string): Promise<PublicUserResponse[]> {
  const { data } = await axiosClient.get<PublicUserResponse[]>(`/api/social/${userId}/followers`);
  return data;
}

export async function getFollowing(userId: string): Promise<PublicUserResponse[]> {
  const { data } = await axiosClient.get<PublicUserResponse[]>(`/api/social/${userId}/following`);
  return data;
}

export async function checkIsFollowing(userId: string): Promise<{ is_following: boolean }> {
  const { data } = await axiosClient.get<{ is_following: boolean }>(`/api/social/is-following/${userId}`);
  return data;
}

export async function getPublicProfile(username: string): Promise<PublicUserResponse> {
  const { data } = await axiosClient.get<PublicUserResponse>(`/api/auth/users/${username}`);
  return data;
}

export async function searchUsers(q: string): Promise<PublicUserResponse[]> {
  const { data } = await axiosClient.get<PublicUserResponse[]>(`/api/auth/users/search`, {
    params: { q }
  });
  return data;
}
