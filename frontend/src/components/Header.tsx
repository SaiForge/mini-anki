import { useState, useEffect } from "react";
import { Search, Plus, MessageSquare, Sun, Moon, X, Bot, RefreshCw } from "lucide-react";
import { Button } from "./ui/Button";

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onAddNewClick: () => void;
  onOpenAssistant: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  feedSubTab?: "ONLY_FOR_YOU" | "FOLLOWING";
  setFeedSubTab?: (tab: "ONLY_FOR_YOU" | "FOLLOWING") => void;
  onRefresh?: () => void;
}

export default function Header({
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  onAddNewClick,
  onOpenAssistant,
  isDarkMode,
  onToggleDarkMode,
  feedSubTab,
  setFeedSubTab,
  onRefresh
}: HeaderProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
    const handleScroll = () => {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
      if (currentScrollY < 30) {
        setIsVisible(true);
        lastY = currentScrollY;
        return;
      }

      const diff = currentScrollY - lastY;
      if (diff > 10) {
        // Scrolling down
        setIsVisible(false);
        lastY = currentScrollY;
      } else if (diff < -15) {
        // Scrolling up
        setIsVisible(true);
        lastY = currentScrollY;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <>
      {activeTab !== "decks" && (
        <header 
          className={`sticky top-0 z-30 flex justify-between items-center w-full px-4 bg-transparent pointer-events-none ${activeTab === "explore" ? "lg:px-8" : "lg:px-[184px]"}`}
          style={{ paddingTop: "env(safe-area-inset-top, 0px)", height: "calc(80px + env(safe-area-inset-top, 0px))" }}
        >
      {/* Brand & Desktop Quick Filters */}
      <div className="flex items-center gap-8 flex-1 pointer-events-auto min-w-0">
        {activeTab === "feed" && feedSubTab && setFeedSubTab ? (
          <div className={`flex items-center gap-1.5 rounded-full p-1 transition-all duration-300 transform ${isVisible
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 -translate-y-12 scale-90 pointer-events-none"
            } ${isDarkMode
              ? "bg-[#0e0e0e]/95 border border-[#1A1A1A] shadow-[0_4px_20px_rgba(0,0,0,0.6)]"
              : "bg-[#fdfbfb]/95 border border-[#c9ada7] shadow-[0_4px_16px_rgba(34,34,59,0.12)]"
            }`}>
            <button
              onClick={() => setFeedSubTab("ONLY_FOR_YOU")}
              className={`px-4 py-1.5 text-[11px] font-mono tracking-wider uppercase transition-all cursor-pointer rounded-full ${feedSubTab === "ONLY_FOR_YOU"
                  ? isDarkMode
                    ? "bg-white text-[#050b19] font-bold"
                    : "bg-[#22223b] text-[#fdfbfb] font-bold"
                  : isDarkMode
                    ? "text-[#87a2b0] hover:text-white hover:bg-white/5"
                    : "text-[#4a4e69] hover:text-[#22223b] hover:bg-[#22223b]/5"
                }`}
            >
              CARDS
            </button>
            <button
              onClick={() => setFeedSubTab("FOLLOWING")}
              className={`px-4 py-1.5 text-[11px] font-mono tracking-wider uppercase transition-all cursor-pointer rounded-full ${feedSubTab === "FOLLOWING"
                  ? isDarkMode
                    ? "bg-white text-[#050b19] font-bold"
                    : "bg-[#22223b] text-[#fdfbfb] font-bold"
                  : isDarkMode
                    ? "text-[#87a2b0] hover:text-white hover:bg-white/5"
                    : "text-[#4a4e69] hover:text-[#22223b] hover:bg-[#22223b]/5"
                }`}
            >
              DECKS
            </button>
          </div>
        ) : activeTab === "profile" || activeTab === "notifications" || activeTab === "analytics" || activeTab === "user-profile" || activeTab === "study" || activeTab === "messages" || activeTab === "decks" ? null : (
          /* Integrated Search Bar with keyboard indicator */
          <div className={`flex items-center rounded-full px-4 py-2.5 w-full md:w-56 lg:w-72 transition-all duration-300 transform ${isVisible
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 -translate-y-12 scale-90 pointer-events-none"
            } ${isDarkMode
              ? "bg-[#0e0e0e]/95 border border-[#1A1A1A] focus-within:border-white shadow-[0_4px_20px_rgba(0,0,0,0.6)]"
              : "bg-[#fdfbfb]/95 border border-[#c9ada7] focus-within:border-[#22223b] shadow-[0_4px_16px_rgba(34,34,59,0.12)]"
            }`}>
            <Search className={`w-4 h-4 mr-2 transition-opacity ${isDarkMode ? "text-on-surface-variant opacity-50" : "text-[#4a4e69] opacity-70"}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none focus:ring-0 text-xs text-on-surface w-full placeholder:text-on-surface-variant/50 outline-none"
              placeholder={
                activeTab === "decks"
                  ? "Filter study decks..."
                  : "Search tags, topics, cards..."
              }
            />
            {searchQuery ? (
              <Button
                type="button"
                onClick={() => setSearchQuery("")}
                variant="ghost"
                size="icon"
                className={`ml-2 rounded-full ${isDarkMode
                    ? "text-on-surface-variant hover:text-white hover:bg-white/10"
                    : "text-[#4a4e69] hover:text-[#22223b] hover:bg-[#22223b]/10"
                  }`}
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <span className={`hidden sm:inline text-[10px] font-mono ml-2 select-none uppercase ${isDarkMode ? "text-on-surface-variant/40" : "text-[#4a4e69]/60"}`}>
                ⌘K
              </span>
            )}
          </div>
        )}
      </div>

      {/* Extreme Right Actions (Refresh button) */}
      <div className={`flex items-center gap-4 pointer-events-auto transition-all duration-300 transform ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-12 pointer-events-none"}`}>
        {activeTab === "explore" && (
          <Button
            onClick={() => {
              setIsRefreshing(true);
              if (onRefresh) onRefresh();
              else window.dispatchEvent(new CustomEvent("refreshExplore"));
              setTimeout(() => setIsRefreshing(false), 1000);
            }}
            variant="ghost"
            size="icon"
            className={`rounded-full p-2 h-auto hover:bg-transparent border-none ${
              isDarkMode ? "text-zinc-400 hover:text-white" : "text-[#4a4e69] hover:text-[#22223b]"
            }`}
            title="Refresh Explorer"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>

      </header>
      )}

      {/* Control Actions & Workbench (Floating FAB Pill in bottom right) */}
      {["decks", "explore", "feed"].includes(activeTab) && (
        <div 
          className={`fixed right-6 lg:right-8 flex items-center gap-2 rounded-full p-2.5 pointer-events-auto transition-all duration-300 z-40 transform ${isVisible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-16 scale-90 pointer-events-none"
          } ${isDarkMode
            ? "bg-[#0e0e0e]/95 border border-[#1A1A1A] shadow-[0_8px_30px_rgba(0,0,0,0.85)]"
            : "bg-[#fdfbfb]/95 border border-[#c9ada7] shadow-[0_8px_24px_rgba(34,34,59,0.18)]"
          }`}
          style={{ 
            bottom: typeof window !== 'undefined' && window.innerWidth < 1024 
              ? "calc(90px + env(safe-area-inset-bottom, 0px))" 
              : "2rem" 
          }}
        >
        {/* Quick Add Custom Card or Custom Deck */}

        <Button
          onClick={onAddNewClick}
          variant="ghost"
          size="icon"
          title="Insert custom concept card"
          className={`relative group rounded-full p-2.5 ${isDarkMode
              ? "text-on-surface-variant hover:text-white hover:bg-white/10"
              : "text-[#4a4e69] hover:text-[#22223b] hover:bg-[#22223b]/10"
            }`}
        >
          <Plus className="w-5 h-5" />
          <span className={`absolute hidden group-hover:block bottom-14 right-0 border text-[10px] uppercase font-mono tracking-widest p-2 whitespace-nowrap rounded-xs z-50 shadow-xl transition-all ${isDarkMode
              ? "bg-[#131313] border-[#1a1a1a] text-white"
              : "bg-[#fdfbfb] border-[#c9ada7] text-[#22223b]"
            }`}>
            Add Custom Post
          </span>
        </Button>

        {/* AI Workbench chat assistant */}
        <Button
          onClick={onOpenAssistant}
          variant="ghost"
          size="icon"
          title="Open AI Workbench Companion"
          className={`rounded-full p-2.5 ${isDarkMode
              ? "text-on-surface-variant hover:text-white hover:bg-white/10"
              : "text-[#4a4e69] hover:text-[#22223b] hover:bg-[#22223b]/10"
            }`}
        >
          <Bot className="w-5 h-5" />
        </Button>
      </div>
      )}
    </>
  );
}
