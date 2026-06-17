import React, { useState } from "react";
import { Zap, Tag, TerminalIcon, X, Check, ArrowRight, ArrowLeft, ChevronDown } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Label } from "./ui/Label";
import { cn } from "../lib/utils";

export interface ConceptFormData {
  qContentType: "CONCEPT" | "FLASHCARD" | "RIDDLE" | "JOKE";
  qTitle: string;
  qContent: string;
  qCode: string;
  qCategory: string;
  qTagsString: string;
  qPrivate: boolean;
  qDeckId?: string;
}

interface ConceptPublisherProps {
  onClose: () => void;
  onPublish: (data: ConceptFormData) => void;
  isDarkMode?: boolean;
  userDecks?: { id: string, title: string }[];
  mode?: "publish" | "deck-only";
}

export function ConceptPublisher({ onClose, onPublish, isDarkMode = true, userDecks = [], mode = "publish" }: ConceptPublisherProps) {
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState<ConceptFormData>({
    qContentType: "CONCEPT",
    qTitle: "",
    qContent: "",
    qCode: "",
    qCategory: "PROGRAMMING",
    qTagsString: "",
    qPrivate: false,
    qDeckId: ""
  });

  const updateForm = (key: keyof ConceptFormData, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) {
      handleNext();
    } else {
      onPublish(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animated fadeIn">
      <div className={cn(
        "w-full max-w-lg p-6 rounded-sm shadow-2xl relative transition-all duration-300",
        isDarkMode ? "bg-[#0a0a0a] border border-[#1C1C1C]" : "bg-[#fdfbfb] border border-[#c9ada7]"
      )}>
        
        {/* Close Button Trigger */}
        <button 
          onClick={onClose}
          className={cn(
            "absolute top-4 right-4 p-1.5 rounded-xs transition-colors cursor-pointer border",
            isDarkMode ? "bg-black/35 border-[#1a1a1a] hover:border-white/30 text-zinc-400 hover:text-white" : "bg-zinc-100 border-[#c9ada7] hover:border-zinc-500 text-zinc-600 hover:text-black"
          )}
          title="Close publisher"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header branding */}
        <div className={cn("flex items-center gap-2 pb-3 border-b", isDarkMode ? "border-[#1A1A1A]" : "border-[#c9ada7]")}>
          <div className={cn("p-1.5 rounded", isDarkMode ? "bg-white/5" : "bg-[#22223b]/5")}>
            <TerminalIcon className={cn("w-4 h-4", isDarkMode ? "text-white" : "text-[#22223b]")} />
          </div>
          <div>
            <h2 className={cn("text-xs font-mono uppercase tracking-[0.25em] font-black", isDarkMode ? "text-white" : "text-[#22223b]")}>
              {mode === "deck-only" ? "Add New Card" : "Concept Publisher"}
            </h2>
            <p className={cn("text-[9px] font-mono uppercase tracking-widest mt-0.5", isDarkMode ? "text-zinc-500" : "text-[#4a4e69]")}>
              {mode === "deck-only" ? "Add a direct card to your deck" : "Publish new cards, rules, or debug traps"}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-0.5 mt-4 overflow-hidden">
          <div className={cn("w-full h-full", isDarkMode ? "bg-[#1C1C1C]" : "bg-[#ebdcd7]")}>
            <div 
              className={cn("h-full transition-all duration-500 ease-out", isDarkMode ? "bg-white" : "bg-[#22223b]")} 
              style={{ width: `${(step / 2) * 100}%` }}
            />
          </div>
        </div>
        <div className="mt-2 text-right">
          <span className={cn("text-[9px] font-mono uppercase tracking-widest", isDarkMode ? "text-zinc-500" : "text-[#4a4e69]")}>Step {step} of 2</span>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6 text-xs font-sans">
          
          {/* STEP 1: CLASSIFICATION */}
          {step === 1 && (
            <div className="space-y-6 animated fadeIn">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <Label className="flex items-center gap-1.5" isDarkMode={isDarkMode}>
                    <Zap className={cn("w-3.5 h-3.5", isDarkMode ? "text-white" : "text-[#22223b]")} />
                    <span>Select Content Kind</span>
                  </Label>
                </div>
                <div className="relative">
                  <select
                    value={formData.qContentType}
                    onChange={(e) => {
                      const nextVal = e.target.value as any;
                      let nextCat = formData.qCategory;
                      if (nextVal === "JOKE") nextCat = "JOKES";
                      else if (nextVal === "RIDDLE") nextCat = "RIDDLES";
                      else if (nextVal === "CONCEPT" || nextVal === "FLASHCARD") nextCat = "SYSTEMS";
                      
                      setFormData(prev => ({ ...prev, qContentType: nextVal, qCategory: nextCat }));
                    }}
                    className={cn(
                      "w-full p-2.5 pr-8 rounded-xs focus:outline-none font-mono text-xs border transition-colors appearance-none cursor-pointer",
                      isDarkMode ? "bg-[#0a0a0a] text-white border-[#1C1C1C] focus:border-white" : "bg-transparent text-[#22223b] border-[#c9ada7] focus:border-[#22223b]"
                    )}
                  >
                    <option value="CONCEPT">General Concept / Article</option>
                    <option value="FLASHCARD">Study Flashcard (Front & Back)</option>
                    <option value="RIDDLE">Logic Riddle / Puzzle Trap</option>
                    <option value="JOKE">Developer Humor / CS Joke</option>
                  </select>
                  <div className={cn("absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50", isDarkMode ? "text-white" : "text-[#22223b]")}>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-left block" isDarkMode={isDarkMode}>Stream Tag Category</Label>
                <div className="relative">
                  <select
                    value={formData.qCategory}
                    onChange={(e) => updateForm("qCategory", e.target.value)}
                    className={cn(
                      "w-full p-2.5 pr-8 rounded-xs focus:outline-none font-mono text-xs border transition-colors appearance-none cursor-pointer",
                      isDarkMode ? "bg-[#0a0a0a] text-white border-[#1C1C1C] focus:border-white" : "bg-transparent text-[#22223b] border-[#c9ada7] focus:border-[#22223b]"
                    )}
                  >
                    <option value="PROGRAMMING">PROGRAMMING & DESIGN</option>
                    <option value="SYSTEMS">SYSTEMS ARCHITECTURE</option>
                    <option value="DATABASE">DATABASE INTERNALS</option>
                    <option value="PHILOSOPHY">PHILOSOPHY OF LOGIC</option>
                    <option value="JOKES">DEVELOPER JOKES</option>
                    <option value="RIDDLES">LOGIC RIDDLES</option>
                  </select>
                  <div className={cn("absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50", isDarkMode ? "text-white" : "text-[#22223b]")}>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CORE CONTENT */}
          {step === 2 && (
            <div className="space-y-6 animated fadeIn">
              <div className="space-y-1.5">
                <Label className="text-left block mb-1" isDarkMode={isDarkMode}>
                  {formData.qContentType === "CONCEPT" && "Concept Title / Header"}
                  {formData.qContentType === "FLASHCARD" && "Flashcard Question (Front)"}
                  {formData.qContentType === "RIDDLE" && "Riddle Code Title"}
                  {formData.qContentType === "JOKE" && "Joke Setup / Premise"}
                </Label>
                <Input
                  type="text"
                  value={formData.qTitle}
                  onChange={(e) => updateForm("qTitle", e.target.value)}
                  placeholder={
                    formData.qContentType === "CONCEPT" ? "e.g. Memory caching locks" :
                    formData.qContentType === "FLASHCARD" ? "e.g. Sync vs Async execution?" :
                    formData.qContentType === "RIDDLE" ? "e.g. The Silent Sentinel" :
                    "e.g. Why did the admin leave the restaurant?"
                  }
                  isDarkMode={isDarkMode}
                  className="text-left font-sans"
                  required={formData.qContentType === "FLASHCARD" || formData.qContentType === "JOKE"}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-left block mb-1" isDarkMode={isDarkMode}>
                  {formData.qContentType === "CONCEPT" && "Concept Technical Summary"}
                  {formData.qContentType === "FLASHCARD" && "Flashcard Correction / Answer (Back)"}
                  {formData.qContentType === "RIDDLE" && "Riddle Puzzle / Clue Setup"}
                  {formData.qContentType === "JOKE" && "Joke Punchline"}
                </Label>
                <textarea
                  rows={formData.qContentType === "CONCEPT" ? 3 : 2}
                  value={formData.qContent}
                  onChange={(e) => updateForm("qContent", e.target.value)}
                  placeholder={
                    formData.qContentType === "CONCEPT" ? "Explain the technical concept in clear, concise bullet points..." :
                    formData.qContentType === "FLASHCARD" ? "State the correct answer, definition..." :
                    formData.qContentType === "RIDDLE" ? "What is so fragile that saying its name breaks it?" :
                    "Because there were too many table joins!"
                  }
                  className={cn(
                    "w-full rounded-sm px-3 py-2 text-sm focus:outline-none transition-colors font-sans resize-none",
                    isDarkMode
                      ? "bg-transparent border border-[#1A1A1A] focus:border-white placeholder:text-on-surface-variant/50 text-white"
                      : "bg-transparent border border-[#c9ada7] focus:border-[#22223b] placeholder:text-[#4a4e69]/50 text-[#22223b]"
                  )}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-left block" isDarkMode={isDarkMode}>
                    {formData.qContentType === "CONCEPT" && "Code Block snippet (Optional)"}
                    {formData.qContentType === "FLASHCARD" && "Source code context / Details (Optional)"}
                    {formData.qContentType === "RIDDLE" && "Hidden riddle solution"}
                    {formData.qContentType === "JOKE" && "Punchline reference hint (Optional)"}
                  </Label>
                  {formData.qContentType === "RIDDLE" && (
                    <span className="text-[8px] font-mono text-amber-500 uppercase">Required</span>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={formData.qCode}
                  onChange={(e) => updateForm("qCode", e.target.value)}
                  placeholder={
                    formData.qContentType === "CONCEPT" ? "fn init_cache<T>() -> Result<(), Error>;" :
                    formData.qContentType === "FLASHCARD" ? "const value = await fetchAsyncNode();" :
                    formData.qContentType === "RIDDLE" ? "Silence" :
                    "e.g. relational queries jokes"
                  }
                  className={cn(
                    "w-full rounded-sm px-3 py-2 text-sm focus:outline-none transition-colors font-mono resize-none",
                    isDarkMode
                      ? "bg-transparent border border-[#1A1A1A] focus:border-white placeholder:text-on-surface-variant/50 text-white"
                      : "bg-transparent border border-[#c9ada7] focus:border-[#22223b] placeholder:text-[#4a4e69]/50 text-[#22223b]"
                  )}
                  required={formData.qContentType === "RIDDLE"}
                />
              </div>
              {/* Deck Selector */}
              {userDecks && userDecks.length > 0 && (
                <div className="space-y-2 pt-2">
                  <Label className="text-left flex items-center gap-1 mb-1" isDarkMode={isDarkMode}>
                    <Zap className="w-3 h-3" />
                    <span>Add to Deck (Optional)</span>
                  </Label>
                  <div className="relative">
                    <select
                      value={formData.qDeckId || ""}
                      onChange={(e) => updateForm("qDeckId", e.target.value)}
                      required={mode === "deck-only"}
                      className={cn(
                        "w-full p-2.5 pr-8 rounded-xs focus:outline-none font-mono text-xs border transition-colors appearance-none cursor-pointer",
                        isDarkMode ? "bg-[#0a0a0a] text-white border-[#1C1C1C] focus:border-white" : "bg-transparent text-[#22223b] border-[#c9ada7] focus:border-[#22223b]"
                      )}
                    >
                      <option value="" disabled={mode === "deck-only"}>-- Select a deck --</option>
                      {userDecks.map(deck => (
                        <option key={deck.id} value={deck.id}>{deck.title}</option>
                      ))}
                    </select>
                    <div className={cn("absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50", isDarkMode ? "text-white" : "text-[#22223b]")}>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              )}

              {/* Privacy Checkbox */}
              {mode !== "deck-only" && (
                <div className="pt-2 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="private-checkbox"
                    checked={formData.qPrivate}
                    onChange={(e) => updateForm("qPrivate", e.target.checked)}
                    className="w-4 h-4 rounded-sm border-gray-300 cursor-pointer"
                  />
                  <label htmlFor="private-checkbox" className={cn("text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5 cursor-pointer", isDarkMode ? "text-zinc-400" : "text-[#4a4e69]")}>
                    <span role="img" aria-label="lock">🔒</span> Only for you (Private Concept Card)
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Navigation Footer */}
          <div className="pt-6 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              isDarkMode={isDarkMode}
              onClick={step === 1 ? onClose : handleBack}
              className="flex items-center gap-1.5"
            >
              {step > 1 && <ArrowLeft className="w-3.5 h-3.5" />}
              <span>{step === 1 ? "Cancel" : "Back"}</span>
            </Button>
            
            {step < 2 ? (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isDarkMode={isDarkMode}
                className="flex items-center gap-1.5"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isDarkMode={isDarkMode}
                className="flex items-center gap-1.5 px-6"
              >
                <span>{mode === "deck-only" ? "Add Card" : "Publish"}</span>
                <Zap className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
