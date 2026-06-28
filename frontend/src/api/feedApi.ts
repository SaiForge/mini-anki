// frontend/src/api/feedApi.ts
import { axiosClient } from "./axiosClient";

export interface PostResponse {
  post_id: string;
  author_id: string;
  author_username: string | null;
  author_full_name: string | null;
  author_avatar_url: string | null;
  author_streak: number;
  content_type: string;
  title: string | null;
  body: string;
  code_snippet: string | null;
  image_url: string | null;
  category: string | null;
  is_private: boolean;
  created_at: string;
  likes_count: number;
  comments_count: number;
  bookmarks_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  is_followed: boolean;
}

export interface CommentResponse {
  comment_id: string;
  post_id: string;
  author_id: string;
  author_username: string | null;
  author_full_name: string | null;
  author_avatar_url: string | null;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  replies: CommentResponse[];
}

export interface PostCreate {
  content_type?: string;
  title?: string;
  body: string;
  code_snippet?: string;
  image_url?: string;
  category?: string;
  is_private?: boolean;
  deck_id?: string;
}

export async function createPost(payload: PostCreate): Promise<PostResponse> {
  const { data } = await axiosClient.post<PostResponse>("/api/posts", payload);
  return data;
}

export async function getPost(postId: string): Promise<PostResponse> {
  const { data } = await axiosClient.get<PostResponse>(`/api/posts/${postId}`);
  return data;
}

export async function deletePost(postId: string): Promise<void> {
  await axiosClient.delete(`/api/posts/${postId}`);
}

export async function getForYouFeed(skip = 0, limit = 20): Promise<PostResponse[]> {
  const { data } = await axiosClient.get<PostResponse[]>("/api/feed/for-you", {
    params: { skip, limit },
  });
  return data;
}

export async function getFollowingFeed(skip = 0, limit = 20): Promise<PostResponse[]> {
  const { data } = await axiosClient.get<PostResponse[]>("/api/feed/following", {
    params: { skip, limit },
  });
  return data;
}

export async function getUserPosts(userId: string, skip = 0, limit = 20): Promise<PostResponse[]> {
  const { data } = await axiosClient.get<PostResponse[]>(`/api/users/${userId}/posts`, {
    params: { skip, limit },
  });
  return data;
}

export async function likePost(postId: string): Promise<{ message: string; likes_count: number }> {
  const { data } = await axiosClient.post(`/api/posts/${postId}/like`);
  return data;
}

export async function unlikePost(postId: string): Promise<{ message: string; likes_count: number }> {
  const { data } = await axiosClient.delete(`/api/posts/${postId}/like`);
  return data;
}

export async function bookmarkPost(postId: string): Promise<{ message: string }> {
  const { data } = await axiosClient.post(`/api/posts/${postId}/bookmark`);
  return data;
}

export async function removeBookmark(postId: string): Promise<{ message: string }> {
  const { data } = await axiosClient.delete(`/api/posts/${postId}/bookmark`);
  return data;
}

export async function getMyBookmarks(skip = 0, limit = 20): Promise<PostResponse[]> {
  const { data } = await axiosClient.get<PostResponse[]>("/api/bookmarks", {
    params: { skip, limit },
  });
  return data;
}

export async function getComments(postId: string): Promise<CommentResponse[]> {
  const { data } = await axiosClient.get<CommentResponse[]>(`/api/posts/${postId}/comments`);
  return data;
}

export async function addComment(
  postId: string,
  body: string,
  parentCommentId?: string
): Promise<CommentResponse> {
  const { data } = await axiosClient.post<CommentResponse>(`/api/posts/${postId}/comments`, {
    body,
    parent_comment_id: parentCommentId ?? null,
  });
  return data;
}

export async function deleteComment(commentId: string): Promise<void> {
  await axiosClient.delete(`/api/comments/${commentId}`);
}
