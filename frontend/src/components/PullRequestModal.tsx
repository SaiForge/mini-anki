import React, { useState, useEffect } from "react";
import { X, Check, Loader2, GitPullRequest } from "lucide-react";
import { getPullRequests, approvePullRequest, rejectPullRequest, PullRequestResponse } from "../api/exploreApi";
import { Button } from "./ui/Button";

interface PullRequestModalProps {
  deckId: string;
  isDarkMode?: boolean;
  onClose: () => void;
  onApproved: () => void;
}

export function PullRequestModal({ deckId, onClose, onApproved }: PullRequestModalProps) {
  const [prs, setPrs] = useState<PullRequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [selectedCardsMap, setSelectedCardsMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let active = true;
    getPullRequests(deckId)
      .then(data => {
        if (active) {
          setPrs(data);
          
          // Initialize selected cards to all by default
          const initialMap: Record<string, string[]> = {};
          data.forEach(pr => {
            if (pr.new_cards) {
              initialMap[pr.pr_id] = pr.new_cards.map(c => c.card_id);
            }
          });
          setSelectedCardsMap(initialMap);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Failed to load pull requests", err);
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [deckId]);

  const handleToggleCard = (prId: string, cardId: string) => {
    setSelectedCardsMap(prev => {
      const selected = prev[prId] || [];
      if (selected.includes(cardId)) {
        return { ...prev, [prId]: selected.filter(id => id !== cardId) };
      } else {
        return { ...prev, [prId]: [...selected, cardId] };
      }
    });
  };

  const handleApprove = async (prId: string) => {
    setActioningId(prId);
    try {
      const selectedCards = selectedCardsMap[prId] || [];
      await approvePullRequest(prId, selectedCards);
      setPrs(prev => prev.filter(p => p.pr_id !== prId));
      onApproved();
    } catch (e) {
      console.error("Failed to approve", e);
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (prId: string) => {
    setActioningId(prId);
    try {
      await rejectPullRequest(prId);
      setPrs(prev => prev.filter(p => p.pr_id !== prId));
    } catch (e) {
      console.error("Failed to reject", e);
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="border border-[#1A1A1A] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh] bg-[#0c0c0c]">
        <div className="flex items-center justify-between p-4 border-b border-[#1A1A1A]">
          <div className="flex items-center gap-2 text-[var(--theme-on-surface)]">
            <GitPullRequest className="w-5 h-5" />
            <h2 className="text-sm font-bold uppercase tracking-wide">
              Pending Contributions
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-on-surface-variant hover:bg-[#131313] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-8 text-on-surface-variant">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : prs.length === 0 ? (
            <div className="text-center py-12 font-mono text-[11px] text-on-surface-variant tracking-wider uppercase">
              No pending contributions for this deck.
            </div>
          ) : (
            <div className="space-y-4">
              {prs.map(pr => {
                const selectedCount = selectedCardsMap[pr.pr_id]?.length || 0;
                const totalCount = pr.new_cards_count;
                const canApprove = selectedCount > 0;

                return (
                  <div key={pr.pr_id} className="border border-[#1A1A1A] rounded-lg p-4 bg-[#111111]">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-sm font-bold font-sans text-white">
                          @{pr.author_username || "Unknown"}
                        </span>
                        <span className="text-[11px] ml-2 text-on-surface-variant">
                          wants to merge {totalCount} new cards
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-on-surface-variant/60">
                        {new Date(pr.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {pr.message && (
                      <p className="text-[11px] font-mono italic mb-4 border-l pl-3 text-on-surface-variant border-[#1A1A1A]">
                        "{pr.message}"
                      </p>
                    )}

                    {pr.new_cards && pr.new_cards.length > 0 && (
                      <div className="mt-4 mb-4 space-y-2 max-h-48 overflow-y-auto pr-2">
                        {pr.new_cards.map(card => {
                          const isSelected = selectedCardsMap[pr.pr_id]?.includes(card.card_id);
                          return (
                            <label key={card.card_id} className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                              isSelected ? "border-[var(--theme-primary)] bg-[var(--theme-primary)]/10" : "border-[#1A1A1A] bg-[#0c0c0c] hover:border-white/20" 
                            }`}>
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleCard(pr.pr_id, card.card_id)}
                                className="mt-1 flex-shrink-0"
                              />
                              <div className="flex-1 text-sm overflow-hidden">
                                <div className="font-mono text-[11px] mb-1 text-white truncate">
                                  {card.front_text}
                                </div>
                                <div className="text-[11px] font-sans text-on-surface-variant truncate">
                                  {card.back_text}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex gap-2 justify-end mt-4 items-center">
                      {!canApprove && (
                         <span className="text-[10px] uppercase tracking-wider font-mono mr-2 text-red-500">
                           Select at least 1 card
                         </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReject(pr.pr_id)}
                        disabled={actioningId === pr.pr_id}
                        className="text-red-500 hover:text-red-400 font-mono text-[11px] tracking-wider"
                      >
                        {actioningId === pr.pr_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
                        REJECT
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(pr.pr_id)}
                        disabled={actioningId === pr.pr_id || !canApprove}
                        className="bg-[var(--theme-primary)] text-[var(--theme-on-primary)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-[11px] tracking-wider border-none"
                      >
                        {actioningId === pr.pr_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                        APPROVE ({selectedCount})
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
