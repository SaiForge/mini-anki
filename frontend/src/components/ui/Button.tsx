import React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  isDarkMode?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", isDarkMode = true, ...props }, ref) => {
    
    // Core base classes that almost all buttons share
    const baseClasses = "inline-flex items-center justify-center font-mono uppercase tracking-wider rounded-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-bold";

    // Size variants
    const sizeClasses = {
      sm: "px-3 py-1.5 text-[10px]",
      md: "px-4 py-2 text-[11px]",
      lg: "px-5 py-2.5 text-xs",
      icon: "p-1.5",
    };

    // Style variants (adjusted for dark mode toggle if provided)
    const variantClasses = {
      primary: isDarkMode
        ? "bg-white hover:bg-neutral-200 text-black border border-white"
        : "bg-[#22223b] hover:bg-[#3d3f58] text-[#fdfbfb] border border-[#22223b]",
      secondary: isDarkMode
        ? "bg-black border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-[#070707]"
        : "bg-[#eed9d2]/40 border border-[#c9ada7] text-[#22223b] hover:bg-[#eed9d2]/60 hover:border-[#22223b]",
      outline: isDarkMode
        ? "bg-transparent border border-[#1a1a1a] text-on-surface-variant hover:text-white hover:border-white/30"
        : "bg-transparent border border-[#c9ada7] text-[#4a4e69] hover:text-[#22223b] hover:border-[#22223b]",
      ghost: isDarkMode
        ? "bg-transparent text-on-surface-variant hover:text-white hover:bg-zinc-900/30"
        : "bg-transparent text-[#4a4e69] hover:text-[#22223b] hover:bg-[#22223b]/5",
      destructive: isDarkMode
        ? "bg-red-500/10 border border-red-500/45 text-red-500 hover:bg-red-500/20"
        : "bg-red-50 border border-red-200 text-red-700 hover:bg-red-100",
    };

    return (
      <button
        ref={ref}
        className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
