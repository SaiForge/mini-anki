import React from "react";
import { cn } from "../../lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  isDarkMode?: boolean;
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, isDarkMode = true, ...props }, ref) => {
    
    const baseClasses = "block font-mono text-[10px] uppercase tracking-wider text-center";
    
    const themeClasses = isDarkMode
      ? "text-on-surface-variant"
      : "text-[#4a4e69]/80";

    return (
      <label
        ref={ref}
        className={cn(baseClasses, themeClasses, className)}
        {...props}
      />
    );
  }
);
Label.displayName = "Label";

export { Label };
