import { 
  Home, 
  Compass, 
  Bell, 
  Layers, 
  User, 
  Settings, 
  Terminal,
  Search
} from "lucide-react";
import { Button } from "./ui/Button";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onStudyNowClick: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, onStudyNowClick }: SidebarProps) {
  const navItems = [
    { id: "decks", label: "Decks", icon: Layers },
    { id: "feed", label: "Explore", icon: Compass },
    { id: "explore", label: "Search", icon: Search },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 py-8 bg-surface border-r border-[#1A1A1A] z-40">
      {/* Brand Header */}
      <div className="px-8 mb-12">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-white font-bold" />
          <h1 className="text-sm font-headline-md font-bold text-on-surface tracking-wider">STUDY LAB</h1>
        </div>
        <p className="text-[10px] font-mono tracking-widest text-on-surface-variant mt-1 opacity-50 uppercase">
          Workbench Edition
        </p>
      </div>

      {/* Navigation Ledger */}
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xs text-left transition-all duration-150 group cursor-pointer ${
                isActive
                  ? "text-white bg-white/5 border-r border-white font-bold translate-x-1"
                  : "text-on-surface-variant/80 hover:bg-neutral-900/60 hover:text-white"
              }`}
            >
              <Icon 
                className={`w-5 h-5 transition-colors ${
                  isActive ? "text-white" : "text-on-surface-variant group-hover:text-white"
                }`} 
              />
              <span className="text-[13px] font-sans tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Workspace Footer Settings & Action */}
      <div className="px-4 mt-auto space-y-3">
        <Button
          onClick={onStudyNowClick}
          variant="primary"
          className="w-full shadow-[0_0_15px_rgba(255,255,255,0.1)]"
        >
          Study Now
        </Button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xs text-left transition-all duration-150 cursor-pointer ${
            activeTab === "settings"
              ? "text-white bg-white/5 border-r border-white font-semibold"
              : "text-on-surface-variant/80 hover:bg-neutral-900/60 hover:text-white"
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[13px] font-sans tracking-wide">Settings</span>
        </button>
      </div>
    </aside>
  );
}
