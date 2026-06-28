// frontend/src/components/CommentThread.tsx
import React, { useState, useEffect } from "react";
import { MessageSquare, Send, X, Loader2, Trash2 } from "lucide-react";
import { getComments, addComment, deleteComment, CommentResponse } from "../api/feedApi";

interface CommentThreadProps {
  postId: string;
  initialCount?: number;
  currentUserId?: string;
  isDarkMode?: boolean;
  autoOpen?: boolean;
}

function CommentNode({
  comment,
  currentUserId,
  postId,
  onReplyAdded,
  onDelete,
  isDarkMode,
}: {
  comment: CommentResponse;
  currentUserId?: string;
  postId: string;
  onReplyAdded: (parentId: string, reply: CommentResponse) => void;
  onDelete: (commentId: string) => void;
  isDarkMode?: boolean;
}) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const reply = await addComment(postId, replyText.trim(), comment.comment_id);
      onReplyAdded(comment.comment_id, reply);
      setReplyText("");
      setShowReplyBox(false);
    } catch (err) {
      console.error("Failed to post reply", err);
    } finally {
      setSubmitting(false);
    }
  };

  const ago = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="flex gap-2.5 group/comment">
      <div className="w-6 h-6 rounded-full bg-[#131313] border border-[#1A1A1A] flex items-center justify-center text-[9px] font-mono text-white flex-shrink-0 mt-0.5">
        {(comment.author_full_name || comment.author_username || "?").substring(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-sans font-semibold text-white">
            {comment.author_full_name || comment.author_username || "Unknown"}
          </span>
          <span className="text-[10px] text-zinc-600 font-mono">{ago(comment.created_at)}</span>
          {comment.author_id === currentUserId && (
            <button
              onClick={() => onDelete(comment.comment_id)}
              className="opacity-0 group-hover/comment:opacity-100 transition-opacity text-zinc-600 hover:text-red-400 ml-auto cursor-pointer"
              title="Delete comment"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-300 font-light leading-relaxed mt-0.5">{comment.body}</p>
        <button
          onClick={() => setShowReplyBox(v => !v)}
          className="text-[10px] font-mono text-zinc-600 hover:text-zinc-300 transition-colors mt-1 cursor-pointer uppercase tracking-wider"
        >
          Reply
        </button>

        {showReplyBox && (
          <form onSubmit={handleReply} className="flex gap-2 mt-2">
            <input
              autoFocus
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              className="flex-1 bg-transparent border border-[#1A1A1A] focus:border-zinc-600 rounded px-2 py-1 text-xs text-white outline-none font-sans placeholder:text-zinc-600"
            />
            <button
              type="submit"
              disabled={submitting || !replyText.trim()}
              className="text-zinc-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        )}

        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 pl-3 border-l border-[#1A1A1A] space-y-3">
            {comment.replies.map(reply => (
              <CommentNode
                key={reply.comment_id}
                comment={reply}
                currentUserId={currentUserId}
                postId={postId}
                onReplyAdded={onReplyAdded}
                onDelete={onDelete}
                isDarkMode={isDarkMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentThread({
  postId,
  initialCount = 0,
  currentUserId,
  isDarkMode = true,
  autoOpen = false,
}: CommentThreadProps) {
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    getComments(postId)
      .then(data => { if (active) setComments(data); })
      .catch(err => console.error("Failed to load comments", err))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const c = await addComment(postId, commentText.trim());
      setComments(prev => [...prev, c]);
      setCount(v => v + 1);
      setCommentText("");
    } catch (err) {
      console.error("Failed to post comment", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplyAdded = (_parentId: string, reply: CommentResponse) => {
    // Recursively add reply inside parent
    const addReply = (list: CommentResponse[]): CommentResponse[] =>
      list.map(c =>
        c.comment_id === _parentId
          ? { ...c, replies: [...(c.replies || []), reply] }
          : { ...c, replies: addReply(c.replies || []) }
      );
    setComments(prev => addReply(prev));
    setCount(v => v + 1);
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      const remove = (list: CommentResponse[]): CommentResponse[] =>
        list.filter(c => c.comment_id !== commentId).map(c => ({
          ...c,
          replies: remove(c.replies || [])
        }));
      setComments(prev => remove(prev));
      setCount(v => Math.max(0, v - 1));
    } catch (err) {
      console.error("Failed to delete comment", err);
    }
  };

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={e => { e.stopPropagation(); setIsOpen(v => !v); }}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors group/btn cursor-pointer"
        title="View comments"
      >
        <MessageSquare
          className={`w-4 h-4 transition-transform group-hover/btn:scale-110 ${isOpen ? "text-white" : ""}`}
        />
        <span className="text-[11px] font-mono">{count}</span>
      </button>

      {/* Comment panel */}
      {isOpen && (
        <div
          className="absolute bottom-8 left-0 z-50 w-80 sm:w-96 bg-black border border-[#1A1A1A] rounded-lg shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A1A1A]">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
              Comments · {count}
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-600 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* List */}
          <div className="max-h-60 overflow-y-auto px-4 py-3 space-y-4 scrollbar-thin">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-zinc-600 italic font-sans text-center py-4">
                No comments yet. Be the first!
              </p>
            ) : (
              comments.map(c => (
                <CommentNode
                  key={c.comment_id}
                  comment={c}
                  currentUserId={currentUserId}
                  postId={postId}
                  onReplyAdded={handleReplyAdded}
                  onDelete={handleDelete}
                  isDarkMode={isDarkMode}
                />
              ))
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 border-t border-[#1A1A1A]">
            <input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-transparent border border-[#1A1A1A] focus:border-zinc-600 rounded px-3 py-2 text-xs text-white outline-none font-sans placeholder:text-zinc-600"
            />
            <button
              type="submit"
              disabled={submitting || !commentText.trim()}
              className="text-zinc-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
