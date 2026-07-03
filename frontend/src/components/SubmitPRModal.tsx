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
      <div className="bg-surface-lowest border border-outline-variant rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-outline-variant bg-surface-low/50">
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-on-surface tracking-wide">Submit Contribution</h2>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-on-surface-variant">
            Submit your new cards to the original deck owner. If approved, they will be merged into the public deck!
          </p>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-mono uppercase text-on-surface-variant mb-1.5 ml-1">
              Message (Optional)
            </label>
            <textarea
              className="w-full bg-surface-low border border-outline-variant rounded-lg p-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary/50 resize-none h-24"
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
              className="bg-primary hover:bg-primary/90 text-on-primary border-none"
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
