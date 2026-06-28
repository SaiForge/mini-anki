import React, { useState } from "react";
import { X, Globe, AlertTriangle, Loader2, Tag } from "lucide-react";
import { StudyDeck } from "../types";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Label } from "./ui/Label";

interface PublishDeckModalProps {
  deck: StudyDeck;
  onClose: () => void;
  onConfirm: (payload: { description: string; category: string; tags: string[] }) => Promise<void>;
  isDarkMode?: boolean;
}

export function PublishDeckModal({ deck, onClose, onConfirm, isDarkMode = true }: PublishDeckModalProps) {
  const [description, setDescription] = useState(deck.description || "");
  const [category, setCategory] = useState(deck.category || "PROGRAMMING");
  const [tagsString, setTagsString] = useState((deck.tags || []).join(", "));
  const [isPublishing, setIsPublishing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);
    const tagsArray = tagsString
      .split(/[\s,]+/)
      .map(t => t.trim().replace(/^#/, ""))
      .filter(t => t.length > 0);

    try {
      await onConfirm({ description, category, tags: tagsArray });
    } catch (err) {
      console.error("Publish failed:", err);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${
      isDarkMode ? "bg-black/60" : "bg-black/20"
    }`}>
      <div className={`w-full max-w-md border rounded-xl overflow-hidden shadow-2xl relative ${
        isDarkMode ? "bg-[#0b0b0b] border-[#1c1c1c] text-white" : "bg-white border-[#ebdcd7] text-[#22223b]"
      }`}>
        <div className="flex items-center justify-between p-4 border-b border-inherit">
          <div className="flex items-center gap-2 text-emerald-500">
            <Globe className="w-5 h-5" />
            <h3 className="font-bold tracking-wide uppercase">Publish Deck</h3>
          </div>
          <button onClick={onClose} className={`p-1 rounded-md transition-colors ${
            isDarkMode ? "hover:bg-white/10" : "hover:bg-black/5"
          }`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`p-4 border-b text-sm flex items-start gap-3 ${
          isDarkMode ? "bg-amber-950/20 border-[#1c1c1c] text-amber-500/90" : "bg-amber-50 border-[#ebdcd7] text-amber-700"
        }`}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed font-mono">
            Making this deck public will list it in the Explore feed for anyone to study and fork. Make sure it has proper tags!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <Label isDarkMode={isDarkMode}>Description</Label>
            <Input
              isDarkMode={isDarkMode}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this deck about?"
              required
            />
          </div>

          <div className="space-y-2">
            <Label isDarkMode={isDarkMode}>Category</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`w-full px-3 py-3 border rounded-xs font-mono text-xs uppercase tracking-wider transition-colors appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50 ${
                isDarkMode 
                  ? "bg-black border-[#222] text-white" 
                  : "bg-[#fcf8f6] border-[#ebdcd7] text-[#22223b]"
              }`}
              required
            >
              <option value="PROGRAMMING">Programming</option>
              <option value="COMPUTER SCIENCE">Computer Science</option>
              <option value="MATHEMATICS">Mathematics</option>
              <option value="LANGUAGE">Language</option>
              <option value="MEDICINE">Medicine</option>
              <option value="LAW">Law</option>
              <option value="GENERAL">General Knowledge</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label isDarkMode={isDarkMode}>Tags</Label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Tag className={`w-4 h-4 ${isDarkMode ? "text-zinc-600" : "text-zinc-400"}`} />
              </div>
              <Input
                isDarkMode={isDarkMode}
                value={tagsString}
                onChange={(e) => setTagsString(e.target.value)}
                placeholder="react, typescript, frontend..."
                className="pl-9"
              />
            </div>
            <p className={`text-[10px] font-mono tracking-wider ${
              isDarkMode ? "text-zinc-500" : "text-zinc-400"
            }`}>Comma separated list of tags</p>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" isDarkMode={isDarkMode} onClick={onClose} disabled={isPublishing}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isDarkMode={isDarkMode} disabled={isPublishing} className="gap-2">
              {isPublishing && <Loader2 className="w-4 h-4 animate-spin" />}
              Publish to Explore
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
