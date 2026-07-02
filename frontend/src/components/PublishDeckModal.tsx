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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/60">
      <div className="w-full max-w-md border border-[#1A1A1A] bg-[#0c0c0c] rounded-xl overflow-hidden shadow-2xl relative text-white">
        <div className="flex items-center justify-between p-4 border-b border-[#1A1A1A]">
          <div className="flex items-center gap-2 text-[var(--theme-on-surface)]">
            <Globe className="w-5 h-5" />
            <h3 className="font-bold tracking-wide uppercase text-sm">Publish Deck</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-on-surface-variant hover:bg-[#131313] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-[#1A1A1A] text-sm flex items-start gap-3 bg-amber-500/10 text-amber-500/90">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed font-mono text-[11px]">
            Making this deck public will list it in the Explore feed for anyone to study and fork. Make sure it has proper tags!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <Label className="text-xs tracking-wider text-on-surface-variant uppercase font-mono">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this deck about?"
              className="w-full px-3 py-2.5 border border-[#1A1A1A] rounded-md font-mono text-sm tracking-wide transition-colors bg-[#111111] text-white focus:border-white focus:ring-0"
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs tracking-wider text-on-surface-variant uppercase font-mono">Category</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#1A1A1A] rounded-md font-mono text-sm tracking-wide transition-colors appearance-none focus:outline-none focus:border-white bg-[#111111] text-white"
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
            <Label className="text-xs tracking-wider text-on-surface-variant uppercase font-mono">Tags</Label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Tag className="w-4 h-4 text-on-surface-variant" />
              </div>
              <Input
                value={tagsString}
                onChange={(e) => setTagsString(e.target.value)}
                placeholder="react, typescript, frontend..."
                className="pl-9 text-left w-full px-3 py-2.5 border border-[#1A1A1A] rounded-md font-mono text-sm tracking-wide transition-colors bg-[#111111] text-white focus:border-white focus:ring-0"
              />
            </div>
            <p className="text-[10px] font-mono tracking-wider text-on-surface-variant/60">Comma separated list of tags</p>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPublishing} className="text-on-surface-variant hover:text-white rounded font-mono text-xs tracking-wider px-5 py-2.5 h-auto">
              CANCEL
            </Button>
            <Button type="submit" disabled={isPublishing} className="bg-[var(--theme-primary)] text-[var(--theme-on-primary)] hover:opacity-90 active:scale-95 whitespace-nowrap rounded font-mono text-xs tracking-wider px-5 py-2.5 h-auto border-none flex items-center gap-2">
              {isPublishing && <Loader2 className="w-4 h-4 animate-spin" />}
              PUBLISH DECK
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
