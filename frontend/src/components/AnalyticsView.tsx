import React, { useState, useEffect, useCallback } from "react";
import {
  Trophy, Flame, Layers, Sparkles,
  BarChart2, Loader2, RefreshCw, Heart
} from "lucide-react";
import {
  getStudyStats, getReviewHistory,
  StudyStats, DayCount
} from "../api/analyticsApi";

function ReviewHeatmap({ data, isDarkMode }: { data: DayCount[], isDarkMode: boolean }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex gap-1 flex-wrap">
      {data.map(d => {
        const intensity = d.count / max;
        const opacity = d.count === 0 ? 0.08 : 0.2 + intensity * 0.8;
        return (
          <div
            key={d.date}
            title={`${d.date}: ${d.count} cards`}
            className={`w-3.5 h-3.5 rounded-sm cursor-default transition-opacity ${isDarkMode ? "bg-white" : "bg-[#22223b]"}`}
            style={{ opacity }}
          />
        );
      })}
    </div>
  );
}

export default function AnalyticsView({ isDarkMode }: { isDarkMode: boolean }) {
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [history, setHistory] = useState<DayCount[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const [s, h] = await Promise.all([
        getStudyStats(),
        getReviewHistory(30),
      ]);
      setStats(s);
      setHistory(h);
    } catch (e) {
      console.warn("Failed to load analytics", e);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return (
    <div className="max-w-[860px] mx-auto px-4 lg:px-8 py-8 pb-32 space-y-8">
      {/* ── Header ── */}
      <div className={`flex items-start justify-between border-b pb-5 ${isDarkMode ? "border-zinc-900" : "border-[#ebdcd7]"}`}>
        <div>
          <h1 className={`text-xl font-bold font-sans flex items-center gap-2.5 ${isDarkMode ? "text-white" : "text-[#22223b]"}`}>
            <BarChart2 className="w-5 h-5" />
            Insights
          </h1>
          <p className={`text-[9px] font-mono uppercase tracking-widest mt-0.5 ${isDarkMode ? "text-zinc-500" : "text-[#4a4e69]"}`}>
            Study stats · Heatmap
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {analyticsLoading ? (
          <div className={`flex items-center gap-2 justify-center py-16 ${isDarkMode ? "text-zinc-500" : "text-[#4a4e69]"}`}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[10px] font-mono uppercase tracking-widest">Loading insights…</span>
          </div>
        ) : (
          <>
            {/* ── Stats Grid ── */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {[
                  { label: "Total Cards", value: stats.total_cards, icon: <Layers className={`w-4 h-4 ${isDarkMode ? "text-white" : "text-[#22223b]"}`} /> },
                  { label: "Due Today", value: stats.cards_due_today, icon: <RefreshCw className={`w-4 h-4 ${isDarkMode ? "text-white" : "text-[#22223b]"}`} /> },
                  { label: "Total Decks", value: stats.total_decks, icon: <BarChart2 className={`w-4 h-4 ${isDarkMode ? "text-white" : "text-[#22223b]"}`} /> },
                  { label: "Concepts Posted", value: stats.total_posts, icon: <Sparkles className={`w-4 h-4 ${isDarkMode ? "text-white" : "text-[#22223b]"}`} /> },
                  { label: "Likes Received", value: stats.likes_received, icon: <Heart className={`w-4 h-4 ${isDarkMode ? "text-white" : "text-[#22223b]"}`} /> },
                  { label: "Day Streak", value: stats.daily_streak, icon: <Flame className={`w-4 h-4 ${isDarkMode ? "text-white" : "text-[#22223b]"}`} /> },
                ].map(s => (
                  <div key={s.label} className={`border rounded-lg p-4 flex items-center gap-4 transition-all hover:shadow-[0_4px_16px_rgba(34,34,59,0.08)] ${
                    isDarkMode ? "bg-[#0b0b0b] border-zinc-800" : "bg-[#fdfbfb] border-[#ebdcd7]"
                  }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-zinc-900" : "bg-[#eed9d2]/30"}`}>
                      {s.icon}
                    </div>
                    <div>
                      <p className={`text-xl font-bold leading-none ${isDarkMode ? "text-white" : "text-[#22223b]"}`}>{s.value.toLocaleString()}</p>
                      <p className={`text-[10px] font-medium uppercase tracking-wider mt-1 ${isDarkMode ? "text-zinc-500" : "text-[#4a4e69]"}`}>{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── 30-day Review Heatmap ── */}
            {history.length > 0 && (
              <div className={`border rounded-lg p-6 space-y-4 ${isDarkMode ? "bg-[#0b0b0b] border-zinc-800" : "bg-[#fdfbfb] border-[#ebdcd7]"}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? "text-white" : "text-[#22223b]"}`}>30-Day Activity</h3>
                  <span className={`text-xs font-medium ${isDarkMode ? "text-zinc-500" : "text-[#4a4e69]"}`}>
                    {history.reduce((s, d) => s + d.count, 0)} total cards
                  </span>
                </div>
                <ReviewHeatmap data={history} isDarkMode={isDarkMode} />
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[10px] font-medium ${isDarkMode ? "text-zinc-500" : "text-[#4a4e69]"}`}>Less</span>
                  {[0.08, 0.3, 0.55, 0.8, 1].map((o, i) => (
                    <div key={i} className={`w-3 h-3 rounded-sm ${isDarkMode ? "bg-white" : "bg-[#22223b]"}`} style={{ opacity: o }} />
                  ))}
                  <span className="text-[10px] font-medium text-zinc-500">More</span>
                </div>
              </div>
            )}

            {!stats && !analyticsLoading && (
              <div className={`py-16 text-center text-xs ${isDarkMode ? "text-zinc-500" : "text-[#4a4e69]"}`}>
                No analytics data yet. Start studying to generate stats!
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
