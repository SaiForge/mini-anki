import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "outline";
  isDarkMode?: boolean;
}

function Badge({ className, variant = "default", isDarkMode = true, ...props }: BadgeProps) {
  const baseClasses = "inline-flex items-center rounded-xs px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors border";

  const variantClasses = {
    default: isDarkMode 
      ? "bg-white/10 text-white border-white/20" 
      : "bg-[#eed9d2]/40 text-[#22223b] border-[#ebdcd7]",
    success: isDarkMode
      ? "bg-green-500/10 text-green-400 border-green-500/20"
      : "bg-emerald-50 text-emerald-800 border-emerald-200",
    warning: isDarkMode
      ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
      : "bg-yellow-50 text-yellow-800 border-yellow-200",
    destructive: isDarkMode
      ? "bg-red-950/40 text-red-400 border-red-900/50"
      : "bg-red-50 text-red-700 border-red-200",
    outline: isDarkMode
      ? "border-zinc-800 text-zinc-400 bg-transparent"
      : "border-[#c9ada7] text-[#4a4e69]/70 bg-transparent"
  };

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)} {...props} />
  );
}

export { Badge };
