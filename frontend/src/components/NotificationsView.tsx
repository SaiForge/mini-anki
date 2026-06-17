import { useState } from "react";
import { Bell, Sparkles, Terminal, Trash2, Check, RefreshCw, ChevronDown } from "lucide-react";
import { SystemLog } from "../types";

interface NotificationsViewProps {
  logs: SystemLog[];
  onToggleRead: (id: string) => void;
  onClearLog: (id: string) => void;
  onMarkAllRead: () => void;
  onFetchOlderLogs: () => void;
  searchQuery: string;
}

export default function NotificationsView({
  logs,
  onToggleRead,
  onClearLog,
  onMarkAllRead,
  onFetchOlderLogs,
  searchQuery
}: NotificationsViewProps) {
  const [filterType, setFilterType] = useState<string>("ALL");
  const [fetching, setFetching] = useState<boolean>(false);

  const handleFetchClick = () => {
    setFetching(true);
    setTimeout(() => {
      onFetchOlderLogs();
      setFetching(false);
    }, 800);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesFilter = filterType === "ALL" || log.type === filterType;
    const matchesSearch = 
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.logId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="max-w-[800px] mx-auto px-4 md:px-0 py-8 space-y-10 pb-32">
      
      {/* Header Ledger Toolbar */}
      <div className="flex items-baseline justify-between mb-8 border-b border-[#1A1A1A] pb-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
            <Bell className="w-5 h-5 text-white" />
            <span>System Logs</span>
          </h1>
          <p className="text-[9px] font-mono text-on-surface-variant/40 uppercase tracking-widest">
            Audit Trails / Node Alerts
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-xs font-mono">
          <div className="flex items-center gap-1 sm:gap-1.5 text-on-surface-variant/60 uppercase text-[9px] tracking-wide">
            <span>Filter:</span>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-black border border-[#1a1a1a] text-[10px] uppercase font-mono px-2 py-0.5 rounded-xs text-white focus:outline-none focus:border-white"
            >
              <option value="ALL">All Events</option>
              <option value="REQUEST_INCOMING">Requests</option>
              <option value="SYSTEM_ALERT">Alerts</option>
              <option value="SYNC_SUCCESS">Sync Info</option>
              <option value="SOCIAL_INTERACTION">Replies</option>
            </select>
          </div>

          <button 
            onClick={onMarkAllRead}
            className="text-[10px] uppercase tracking-wider text-white hover:underline transition-colors cursor-pointer font-bold"
          >
            Mark All Read
          </button>
        </div>
      </div>

      {/* Ledger Container */}
      <div className="flex flex-col border border-[#1A1A1A] rounded-xs overflow-hidden bg-surface-container-lowest/40">
        {filteredLogs.length === 0 ? (
          <div className="p-16 text-center">
            <Terminal className="w-8 h-8 text-on-surface-variant/20 mx-auto mb-4" />
            <p className="text-[10px] font-mono text-on-surface-variant/50 uppercase tracking-widest">
              --- AUDIT LOG VACUUM COMPLETE (0 EVENTS) ---
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            return (
              <div
                key={log.id}
                onClick={() => onToggleRead(log.id)}
                className={`group flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A]/50 hover:bg-[#111111]/30 transition-all cursor-pointer ${
                  log.read ? "opacity-60" : "opacity-100 bg-[#0e0e0e]/10"
                }`}
              >
                <div className="flex items-start md:items-center gap-4 flex-1">
                  
                  {/* Ledger Blue Dot indicator */}
                  <div className="pt-2 md:pt-0">
                    <div 
                      className={`w-1.5 h-1.5 rounded-full transition-transform duration-200 ${
                        !log.read ? "bg-white scale-110 border border-white" : "bg-transparent"
                      }`}
                    />
                  </div>

                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-light text-on-surface leading-normal max-w-xl">
                      {log.message.includes("'") ? (
                        /* Gracefully highlight string literals to fit developer-aesthetic */
                        <>
                          {log.message.split("'")[0]}
                          <span className="text-white font-bold">'{log.message.split("'")[1]}'</span>
                          {log.message.split("'")[2]}
                        </>
                      ) : (
                        log.message
                      )}
                    </p>

                    <span className="text-[10px] font-mono text-on-surface-variant/40">
                      ID: {log.logId} • <span className="font-semibold text-on-surface-variant/60">{log.type}</span>
                    </span>
                  </div>
                </div>

                {/* Right hand metadata & manual clear handles */}
                <div className="flex items-center gap-4 ml-3">
                  <span className="text-[10px] font-mono text-on-surface-variant/40 whitespace-nowrap uppercase">
                    {log.timeLabel}
                  </span>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearLog(log.id);
                    }}
                    title="Vacuum log node event"
                    className="opacity-0 group-hover:opacity-100 p-1 text-on-surface-variant/30 hover:text-red-400 rounded-sm transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Fetch Older Logs / Bottom indicator trigger */}
      <div className="flex justify-center mt-12 bg-transparent">
        <button
          onClick={handleFetchClick}
          disabled={fetching}
          className="group flex items-center gap-2 text-[10px] font-mono text-on-surface-variant/55 hover:text-white transition-colors uppercase tracking-widest cursor-pointer disabled:opacity-40"
        >
          {fetching ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>vacuuming older node clusters...</span>
            </>
          ) : (
            <>
              <span>Fetch Older Logs</span>
              <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
            </>
          )}
        </button>
      </div>

    </div>
  );
}
