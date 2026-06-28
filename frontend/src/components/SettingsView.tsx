import React, { useState } from "react";
import { 
  Sliders, 
  ChevronRight, 
  LogOut, 
  Lock, 
  Key, 
  Copy, 
  ShieldAlert, 
  Trash2, 
  Check, 
  Database,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { Button } from "./ui/Button";
import { deleteAccount } from "../api/authApi";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";

interface SettingsViewProps {
  userEmail: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => void;
}

export default function SettingsView({ userEmail, isDarkMode, onToggleDarkMode, onLogout }: SettingsViewProps) {
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      "Are you absolutely sure you want to delete your account? This action is permanent and cannot be undone. All your decks, cards, posts, and data will be permanently deleted."
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteAccount();
      // On success, trigger the global logout handler to clear state and redirect to login
      onLogout();
    } catch (err) {
      console.error("Failed to delete account:", err);
      alert("An error occurred while deleting your account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 md:px-0 space-y-16 pb-32">
      
      {/* Section Header */}
      <header className="mb-12">
        <h1 className={`text-xl md:text-2xl font-bold font-sans transition-colors ${
          isDarkMode ? "text-white" : "text-[#22223b]"
        }`}>Settings</h1>
        <p className={`text-[10px] font-mono uppercase tracking-widest mt-1 transition-colors ${
          isDarkMode ? "text-on-surface-variant/50" : "text-[#4a4e69]/75"
        }`}>
          Global Configuration / Preferences
        </p>
      </header>

      {/* Settings Groups */}
      <div className="space-y-16">
        
        {/* Appearance Group */}
        <section className="space-y-4">
          <h3 className={`text-[10px] font-mono tracking-[0.25em] uppercase border-b pb-2 transition-colors ${
            isDarkMode ? "text-on-surface-variant/40 border-[#1A1A1A]" : "text-[#4a4e69]/60 border-[#e5dfdf] font-semibold"
          }`}>
            Appearance
          </h3>
          
          <div 
            onClick={onToggleDarkMode}
            className={`flex items-center justify-between py-4 px-2 transition-all cursor-pointer rounded-xs ${
              isDarkMode ? "hover:bg-neutral-900/35" : "hover:bg-[#22223b]/5"
            }`}
          >
            <div>
              <span className={`text-[11px] font-mono block transition-colors ${
                isDarkMode ? "text-white" : "text-[#22223b] font-semibold"
              }`}>DARK_MODE_OPTIMIZATION</span>
              <p className={`text-[10px] mt-1 uppercase transition-colors ${
                isDarkMode ? "text-on-surface-variant/50" : "text-[#4a4e69]/70"
              }`}>
                Reduce eyestrain in technical study environments
              </p>
            </div>
            {/* Custom styled switch toggle */}
            <div className="relative inline-block w-8 h-4">
              <div className={`absolute inset-0 rounded-full border transition-colors duration-200 ${
                isDarkMode 
                  ? "bg-emerald-500 border-emerald-500" 
                  : "bg-neutral-200 border-neutral-300"
              }`}>
                <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full transition-transform duration-200 ${
                  isDarkMode ? "transform translate-x-4 bg-white" : "bg-neutral-400"
                }`} />
              </div>
            </div>
          </div>

          <div 
            onClick={() => setReduceMotion(!reduceMotion)}
            className={`flex items-center justify-between py-4 px-2 transition-all cursor-pointer rounded-xs ${
              isDarkMode ? "hover:bg-neutral-900/30" : "hover:bg-[#22223b]/5"
            }`}
          >
            <div>
              <span className={`text-[11px] font-mono block transition-colors ${
                isDarkMode ? "text-white" : "text-[#22223b] font-semibold"
              }`}>REDUCE_MOTION</span>
              <p className={`text-[10px] mt-1 uppercase transition-colors ${
                isDarkMode ? "text-on-surface-variant/50" : "text-[#4a4e69]/70"
              }`}>
                Disable non-essential atmospheric shader frames
              </p>
            </div>
            <div className="relative inline-block w-8 h-4">
              <div className={`absolute inset-0 rounded-full border transition-colors duration-200 ${
                reduceMotion 
                  ? isDarkMode ? "bg-white border-white" : "bg-[#22223b] border-[#22223b]" 
                  : isDarkMode ? "bg-[#1C1B1B] border-[#1A1A1A]" : "bg-neutral-200 border-neutral-300"
              }`}>
                <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full transition-transform duration-200 ${
                  reduceMotion 
                    ? isDarkMode ? "transform translate-x-4 bg-black" : "transform translate-x-4 bg-white" 
                    : isDarkMode ? "bg-on-surface-variant" : "bg-neutral-400"
                }`} />
              </div>
            </div>
          </div>
        </section>

        {/* Account Group */}
        <section className="space-y-4">
          <h3 className={`text-[10px] font-mono tracking-[0.25em] uppercase border-b pb-2 transition-colors ${
            isDarkMode ? "text-on-surface-variant/40 border-[#1A1A1A]" : "text-[#4a4e69]/60 border-[#e5dfdf] font-semibold"
          }`}>
            Account Identity
          </h3>

          <div className={`flex items-center justify-between py-4 px-2 transition-all rounded-xs ${
            isDarkMode ? "hover:bg-neutral-900/30" : "hover:bg-[#22223b]/5"
          }`}>
            <span className={`text-[11px] font-mono transition-colors ${
              isDarkMode ? "text-white" : "text-[#22223b] font-semibold"
            }`}>EMAIL_ADDRESS</span>
            <div className="flex items-center gap-3">
              <span className={`text-[11px] font-mono transition-colors ${
                isDarkMode ? "text-on-surface-variant" : "text-[#4a4e69]"
              }`}>{userEmail}</span>
              <ChevronRight className={`w-3.5 h-3.5 ${isDarkMode ? "text-on-surface-variant/45" : "text-[#4a4e69]/50"}`} />
            </div>
          </div>

          <div className="pt-8">
            <Button 
              variant="ghost" 
              onClick={onLogout}
              isDarkMode={isDarkMode}
              className={`w-full flex items-center justify-between py-4 px-2 transition-all rounded-xs text-left cursor-pointer ${
                isDarkMode ? "text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/50" : "text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200"
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-widest">Terminate Session / Log Out</span>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </section>

        {/* Danger Zone Group */}
        <section className="space-y-4 pt-8 border-t border-red-900/20">
          <h3 className={`text-[10px] font-mono tracking-[0.25em] uppercase border-b pb-2 transition-colors ${
            isDarkMode ? "text-red-500/80 border-red-900/30" : "text-red-600/80 border-red-200/50 font-semibold"
          }`}>
            Danger Zone
          </h3>

          <div className="pt-2">
            <Button 
              variant="outline" 
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className={`w-full flex items-center justify-between py-4 px-2 transition-all rounded-xs text-left cursor-pointer ${
                isDarkMode ? "text-red-500 border-red-900/40 hover:bg-red-950/40 hover:border-red-500/50" : "text-red-600 border-red-200 hover:bg-red-50 hover:border-red-400"
              }`}
            >
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest block">Delete Account</span>
                <span className={`text-[9px] uppercase tracking-wider block mt-1 ${isDarkMode ? "text-red-500/60" : "text-red-600/60"}`}>
                  Permanently delete all data
                </span>
              </div>
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            </Button>
          </div>
        </section>

      </div>

      {/* Footer Legal elements */}
      <footer className={`mt-24 pt-8 border-t text-center space-y-3 transition-colors ${
        isDarkMode ? "border-[#1a1a1a]/40" : "border-[#c9ada7]/30"
      }`}>
        <p className={`text-[11px] font-mono tracking-wider transition-colors ${
          isDarkMode ? "text-on-surface-variant/20" : "text-[#4a4e69]/40"
        }`}>
          STUDY_LAB_v2.4.0-STABLE
        </p>
        <div className="flex justify-center gap-6">
          {["Privacy", "Terms", "Documentation"].map((item) => (
            <a 
              key={item}
              href="#" 
              onClick={(e) => e.preventDefault()}
              className={`text-[10px] font-mono uppercase tracking-wider transition-all text-xs ${
                isDarkMode ? "text-on-surface-variant/40 hover:text-white" : "text-[#4a4e69]/50 hover:text-[#22223b]"
              }`}
            >
              {item}
            </a>
          ))}
        </div>
      </footer>

    </div>
  );
}
