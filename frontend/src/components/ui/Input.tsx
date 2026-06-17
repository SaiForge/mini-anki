import React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  isDarkMode?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, isDarkMode = true, ...props }, ref) => {
    
    const baseClasses = "w-full rounded-md px-3 py-2 text-sm focus:outline-none transition-all duration-200 text-center font-mono";
    
    const themeClasses = isDarkMode
      ? "bg-[#111111] border border-outline-variant focus:border-on-surface focus:ring-2 focus:ring-white/30 placeholder:text-on-surface-variant/20 text-white"
      : "bg-[#fdfbfb] border border-[#c9ada7] focus:border-[#22223b] focus:ring-2 focus:ring-[#22223b]/30 placeholder:text-[#4a4e69]/20 text-[#22223b]";

    return (
      <input
        type={type}
        className={cn(baseClasses, themeClasses, className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
