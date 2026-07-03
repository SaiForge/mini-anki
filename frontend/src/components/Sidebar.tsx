import { useEffect, useState } from "react";
import { 
  Compass, 
  Bell, 
  Layers, 
  User, 
  Settings, 
  Terminal,
  Search,
  MessageSquare,
  BarChart2,
  BookOpen
} from "lucide-react";
import { Button } from "./ui/Button";
import { getUnreadCount } from "../api/notificationsApi";
import { getDmUnreadCount } from "../api/dmApi";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onStudyNowClick: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, onStudyNowClick }: SidebarProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const isCollapsed = !isHovered;

  // Poll unread counts every 30s
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [c, d] = await Promise.all([getUnreadCount(), getDmUnreadCount()]);
        if (mounted) { setUnreadCount(c); setDmUnreadCount(d); }
      } catch {}
    };
    load();
    const interval = setInterval(load, 30000);
    
    window.addEventListener('fetch_unread_counts', load);
    
    return () => { 
      mounted = false; 
      clearInterval(interval); 
      window.removeEventListener('fetch_unread_counts', load);
    };
  }, []);

  const navItems = [
    { id: "decks", label: "Decks", icon: Layers },
    { id: "feed", label: "Explore", icon: Compass },
    { id: "explore", label: "Search", icon: Search },
    { id: "messages", label: "Messages", icon: MessageSquare, badge: dmUnreadCount },
    { id: "analytics", label: "Analytics", icon: BarChart2 },
    { id: "notifications", label: "Notifications", icon: Bell, badge: unreadCount },
    { id: "profile", label: "Profile", icon: User },
  ];

  return (
    <aside 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`hidden lg:flex flex-col fixed left-0 top-0 h-full py-8 bg-black z-50 transition-all duration-300 ease-in-out ${isCollapsed ? "w-[72px]" : "w-64"}`}
    >
      {/* Brand Header */}
      <div 
        className="flex flex-col px-3 overflow-hidden cursor-pointer group"
        onClick={() => setActiveTab("feed")}
        title="Go to Home"
      >
        <div className="flex items-center gap-3 pl-3 h-6">
          <Terminal className="w-6 h-6 text-white font-bold flex-shrink-0 group-hover:text-blue-400 transition-colors" />
          <h1 className={`text-sm font-headline-md font-bold text-on-surface tracking-wider whitespace-nowrap overflow-hidden transition-all duration-300 group-hover:text-white ${isCollapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-[200px]"}`}>STUDY LAB</h1>
        </div>
        <p className={`text-[10px] pl-3 font-mono tracking-widest text-on-surface-variant mt-1 uppercase whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? "opacity-0 max-w-0" : "opacity-50 max-w-[200px]"}`}>
          Workbench Edition
        </p>
      </div>

      {/* Navigation Ledger */}
      <nav className="flex-1 flex flex-col justify-center space-y-1 px-3 overflow-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
              }}
              className={`w-full flex items-center gap-4 pl-[14px] pr-4 py-3 rounded-md text-left transition-colors duration-150 group cursor-pointer ${
                isActive
                  ? "text-white bg-white/5 font-bold"
                  : "text-on-surface-variant/80 hover:bg-neutral-900/60 hover:text-white"
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <div className="relative flex-shrink-0">
                <Icon 
                  className={`w-5 h-5 transition-colors ${
                    isActive ? "text-white" : "text-on-surface-variant group-hover:text-white"
                  }`} 
                />
                {/* Unread badge */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white text-black text-[8px] font-bold font-mono flex items-center justify-center">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[13px] font-sans tracking-wide whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-[200px]"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Workspace Footer Settings & Action */}
      <div className="space-y-2 px-3 overflow-hidden">
        <Button
          onClick={onStudyNowClick}
          variant="primary"
          className="w-full shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center justify-start gap-4 pl-[14px] pr-4 py-3 rounded-md overflow-hidden"
          title={isCollapsed ? "Study Now" : undefined}
        >
          <BookOpen className="w-5 h-5 text-black flex-shrink-0" />
          <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-[200px]"}`}>
            Study Now
          </span>
        </Button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`w-full flex items-center gap-4 pl-[14px] pr-4 py-3 rounded-md text-left transition-colors duration-150 cursor-pointer ${
            activeTab === "settings"
              ? "text-white bg-white/5 font-semibold"
              : "text-on-surface-variant/80 hover:bg-neutral-900/60 hover:text-white"
          }`}
          title={isCollapsed ? "Settings" : undefined}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          <span className={`text-[13px] font-sans tracking-wide whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-[200px]"}`}>
            Settings
          </span>
        </button>
      </div>
    </aside>
  );
}
