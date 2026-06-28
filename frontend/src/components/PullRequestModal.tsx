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
      <div className="border border-[#1A1A1A] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh] bg-black">
        <div className="flex items-center justify-between p-4 border-b border-[#1A1A1A] bg-[#111111]">
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-bold tracking-wide text-white">
              Pending Contributions
            </h2>
          </div>
          <button onClick={onClose} className="transition-colors text-zinc-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-8 text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : prs.length === 0 ? (
            <div className="text-center py-8 font-mono text-sm text-zinc-500">
              No pending contributions for this deck.
            </div>
          ) : (
            <div className="space-y-4">
              {prs.map(pr => {
                const selectedCount = selectedCardsMap[pr.pr_id]?.length || 0;
                const totalCount = pr.new_cards_count;
                const canApprove = selectedCount > 0;

                return (
                  <div key={pr.pr_id} className="border border-[#1A1A1A] rounded-lg p-4 bg-zinc-900">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-sm font-semibold text-white">
                          @{pr.author_username || "Unknown"}
                        </span>
                        <span className="text-xs ml-2 text-zinc-500">
                          wants to merge {totalCount} new cards
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(pr.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {pr.message && (
                      <p className="text-sm italic mb-4 border-l-2 pl-2 text-zinc-400 border-zinc-700">
                        "{pr.message}"
                      </p>
                    )}

                    {pr.new_cards && pr.new_cards.length > 0 && (
                      <div className="mt-4 mb-4 space-y-2 max-h-48 overflow-y-auto pr-2">
                        {pr.new_cards.map(card => {
                          const isSelected = selectedCardsMap[pr.pr_id]?.includes(card.card_id);
                          return (
                            <label key={card.card_id} className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                              isSelected ? "border-indigo-500/50 bg-indigo-500/10" : "border-[#1A1A1A] bg-black hover:border-zinc-700" 
                            }`}>
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleCard(pr.pr_id, card.card_id)}
                                className="mt-1 flex-shrink-0"
                              />
                              <div className="flex-1 text-sm overflow-hidden">
                                <div className="font-medium mb-1 text-white truncate">
                                  {card.front_text}
                                </div>
                                <div className="text-xs text-zinc-400 truncate">
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
                         <span className="text-xs mr-2 text-red-500">
                           Select at least 1 card
                         </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReject(pr.pr_id)}
                        disabled={actioningId === pr.pr_id}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                      >
                        {actioningId === pr.pr_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-1" />}
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(pr.pr_id)}
                        disabled={actioningId === pr.pr_id || !canApprove}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actioningId === pr.pr_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                        Approve & Merge ({selectedCount})
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
