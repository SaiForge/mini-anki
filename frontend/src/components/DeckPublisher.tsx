import React, { useState } from "react";
import { X, ArrowRight, ArrowLeft, Layers, Terminal, Code2, Database, Shield, Microscope, Brain, Tag } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Label } from "./ui/Label";
import { cn } from "../lib/utils";

export interface DeckFormData {
  dTitle: string;
  dIcon: "terminal" | "javascript" | "database" | "security" | "science" | "brain";
  dCategory: string;
  dDescription: string;
  dPrivate: boolean;
  dTagsString: string;
}

interface DeckPublisherProps {
  onClose: () => void;
  onPublish: (data: DeckFormData) => void;
  isDarkMode?: boolean;
}

export function DeckPublisher({ onClose, onPublish, isDarkMode = true }: DeckPublisherProps) {
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState<DeckFormData>({
    dTitle: "",
    dIcon: "terminal",
    dCategory: "PROGRAMMING",
    dDescription: "",
    dPrivate: true,
    dTagsString: ""
  });

  const updateForm = (key: keyof DeckFormData, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      handleNext();
    } else {
      onPublish(formData);
    }
  };

  const ICONS: { id: DeckFormData["dIcon"]; icon: any; label: string }[] = [
    { id: "terminal", icon: Terminal, label: "Terminal" },
    { id: "javascript", icon: Code2, label: "Code" },
    { id: "database", icon: Database, label: "Database" },
    { id: "security", icon: Shield, label: "Security" },
    { id: "science", icon: Microscope, label: "Science" },
    { id: "brain", icon: Brain, label: "Logic" },
  ];

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animated fadeIn">
      <div className={cn(
        "w-full max-w-lg p-6 rounded-lg shadow-md relative transition-all duration-300",
        isDarkMode ? "bg-[#0a0a0a] border border-[#1C1C1C]" : "bg-[#fdfbfb] border border-[#c9ada7]"
      )}>
        
        {/* Close Button Trigger */}
        <button 
          onClick={onClose}
          className={cn(
            "absolute top-4 right-4 p-1.5 rounded-xs transition-colors cursor-pointer border",
            isDarkMode ? "bg-black/35 border-[#1a1a1a] hover:border-white/30 text-zinc-400 hover:text-white" : "bg-[#22223b]/5 border-[#c9ada7] hover:border-zinc-500 text-[#22223b] hover:text-black"
          )}
          title="Close publisher"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header branding */}
        <div className={cn("flex items-center gap-2 pb-3 border-b", isDarkMode ? "border-[#1A1A1A]" : "border-[#c9ada7]")}>
          <div className={cn("p-1.5 rounded", isDarkMode ? "bg-white/5" : "bg-[#22223b]/5")}>
            <Layers className={cn("w-4 h-4", isDarkMode ? "text-white" : "text-[#22223b]")} />
          </div>
          <div>
            <h2 className={cn("text-xs font-mono uppercase tracking-[0.25em] font-black", isDarkMode ? "text-white" : "text-[#22223b]")}>Deck Publisher</h2>
            <p className={cn("text-[9px] font-mono uppercase tracking-widest mt-0.5", isDarkMode ? "text-zinc-500" : "text-[#4a4e69]")}>Create a new research collection</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-0.5 mt-4 overflow-hidden">
          <div className={cn("w-full h-full", isDarkMode ? "bg-[#1C1C1C]" : "bg-[#ebdcd7]")}>
            <div 
              className={cn("h-full transition-all duration-500 ease-out", isDarkMode ? "bg-white" : "bg-[#22223b]")} 
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>
        <div className="mt-2 text-right">
          <span className={cn("text-[9px] font-mono uppercase tracking-widest", isDarkMode ? "text-zinc-500" : "text-[#4a4e69]")}>Step {step} of 3</span>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6 text-xs font-sans">
          
          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <div className="space-y-6 animated fadeIn">
              <div className="space-y-1.5">
                <Label className="text-left block mb-1" isDarkMode={isDarkMode}>Deck Title</Label>
                <Input
                  type="text"
                  value={formData.dTitle}
                  onChange={(e) => updateForm("dTitle", e.target.value)}
                  placeholder="e.g. System Design Patterns"
                  isDarkMode={isDarkMode}
                  className="text-left font-sans"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-left block mb-1" isDarkMode={isDarkMode}>Deck Icon</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ICONS.map(ic => {
                    const IconComp = ic.icon;
                    const isSelected = formData.dIcon === ic.id;
                    return (
                      <button
                        key={ic.id}
                        type="button"
                        onClick={() => updateForm("dIcon", ic.id)}
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-xs border transition-colors cursor-pointer",
                          isSelected 
                            ? (isDarkMode ? "bg-[#161616] border-white text-white" : "bg-[#22223b] border-[#22223b] text-[#fdfbfb]")
                            : (isDarkMode ? "bg-transparent border-[#1A1A1A] hover:border-white/50 text-zinc-400" : "bg-transparent border-[#c9ada7] hover:border-[#22223b] text-[#4a4e69]")
                        )}
                      >
                        <IconComp className="w-5 h-5 mb-1.5" />
                        <span className="text-[10px] font-mono tracking-widest">{ic.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: DETAILS */}
          {step === 2 && (
            <div className="space-y-6 animated fadeIn">
              <div className="space-y-2">
                <Label className="text-left block" isDarkMode={isDarkMode}>Deck Category</Label>
                <div className="relative">
                  <select
                    value={formData.dCategory}
                    onChange={(e) => updateForm("dCategory", e.target.value)}
                    className={cn(
                      "w-full p-2.5 rounded-xs focus:outline-none font-mono text-xs border transition-colors appearance-none cursor-pointer",
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
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-left block mb-1" isDarkMode={isDarkMode}>Description</Label>
                <textarea
                  rows={3}
                  value={formData.dDescription}
                  onChange={(e) => updateForm("dDescription", e.target.value)}
                  placeholder="What is this collection about?"
                  className={cn(
                    "w-full rounded-sm px-3 py-2 text-sm focus:outline-none transition-colors font-sans resize-none",
                    isDarkMode
                      ? "bg-transparent border border-[#1A1A1A] focus:border-white placeholder:text-on-surface-variant/50 text-white"
                      : "bg-transparent border border-[#c9ada7] focus:border-[#22223b] placeholder:text-[#4a4e69]/50 text-[#22223b]"
                  )}
                  required
                />
              </div>
            </div>
          )}

          {/* STEP 3: METADATA & PRIVACY */}
          {step === 3 && (
            <div className="space-y-6 animated fadeIn">
              <div className="space-y-4">
                <Label className="text-left block font-mono tracking-widest text-[10px]" isDarkMode={isDarkMode}>Visibility Settings</Label>
                <div className="flex flex-col gap-2">
                  <label className={cn(
                    "flex items-center gap-3 p-3 rounded-xs border cursor-pointer transition-colors",
                    formData.dPrivate 
                      ? (isDarkMode ? "border-white bg-[#161616]" : "border-[#22223b] bg-[#22223b]/5")
                      : (isDarkMode ? "border-[#1A1A1A]" : "border-[#c9ada7]")
                  )}>
                    <input
                      type="radio"
                      name="privacy"
                      checked={formData.dPrivate}
                      onChange={() => updateForm("dPrivate", true)}
                      className="cursor-pointer"
                    />
                    <div className="flex flex-col text-left">
                      <span className={cn("font-bold text-[11px]", isDarkMode ? "text-white" : "text-[#22223b]")}>Private Collection</span>
                      <span className={cn("text-[10px]", isDarkMode ? "text-zinc-500" : "text-[#4a4e69]")}>Only you can view and study these cards.</span>
                    </div>
                  </label>

                  <label className={cn(
                    "flex items-center gap-3 p-3 rounded-xs border cursor-pointer transition-colors",
                    !formData.dPrivate 
                      ? (isDarkMode ? "border-white bg-[#161616]" : "border-[#22223b] bg-[#22223b]/5")
                      : (isDarkMode ? "border-[#1A1A1A]" : "border-[#c9ada7]")
                  )}>
                    <input
                      type="radio"
                      name="privacy"
                      checked={!formData.dPrivate}
                      onChange={() => updateForm("dPrivate", false)}
                      className="cursor-pointer"
                    />
                    <div className="flex flex-col text-left">
                      <span className={cn("font-bold text-[11px]", isDarkMode ? "text-white" : "text-[#22223b]")}>Public Directory</span>
                      <span className={cn("text-[10px]", isDarkMode ? "text-zinc-500" : "text-[#4a4e69]")}>Discoverable in Explore. Other users can view.</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Tags (Only if Public) */}
              {!formData.dPrivate && (
                <div className="space-y-2 animated fadeIn">
                  <Label className="text-left flex items-center gap-1 mb-1" isDarkMode={isDarkMode}>
                    <Tag className="w-3 h-3" />
                    <span>Tags / Hashtags</span>
                  </Label>
                  <Input
                    type="text"
                    value={formData.dTagsString}
                    onChange={(e) => updateForm("dTagsString", e.target.value)}
                    placeholder="e.g. rust, concurrency, database"
                    isDarkMode={isDarkMode}
                    className="text-left font-sans"
                    required
                  />

                  {/* Parsed Tags Preview */}
                  {formData.dTagsString.trim() && (
                    <div className="flex flex-wrap gap-1 py-2">
                      {formData.dTagsString
                        .split(/[\s,]+/)
                        .map(tag => tag.trim().replace(/^#/, ""))
                        .filter(t => t.length > 0)
                        .map((t, idx) => (
                          <span key={idx} className={cn(
                            "text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-0.5 border",
                            isDarkMode ? "bg-[#161616] border-[#1A1A1A] text-zinc-300" : "bg-[#22223b]/5 border-[#c9ada7] text-[#22223b]"
                          )}>
                            <span>#</span>{t}
                          </span>
                        ))}
                    </div>
                  )}
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
            
            {step < 3 ? (
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
                <span>Publish Deck</span>
                <Layers className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
