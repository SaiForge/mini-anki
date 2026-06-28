import React, { useState } from "react";
import { X, Send, Loader2, GitPullRequest } from "lucide-react";
import { createPullRequest } from "../api/exploreApi";
import { Button } from "./ui/Button";

interface SubmitPRModalProps {
  forkedDeckId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export function SubmitPRModal({ forkedDeckId, onClose, onSubmitted }: SubmitPRModalProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createPullRequest(forkedDeckId, message);
      onSubmitted();
    } catch (err: any) {
      console.error("Failed to submit PR", err);
      setError(err.response?.data?.detail || "Failed to submit Pull Request. Make sure you added new cards.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0f0f11] border border-zinc-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-[#141417]">
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">Submit Contribution</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-zinc-400">
            Submit your new cards to the original deck owner. If approved, they will be merged into the public deck!
          </p>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-mono uppercase text-zinc-500 mb-1.5 ml-1">
              Message (Optional)
            </label>
            <textarea
              className="w-full bg-[#1A1A1A] border border-zinc-800 rounded-lg p-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none h-24"
              placeholder="Briefly describe what you added..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Submit PR
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
