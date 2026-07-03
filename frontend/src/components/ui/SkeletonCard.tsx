// frontend/src/components/ui/SkeletonCard.tsx
// Instagram-style shimmer skeleton for feed loading states

export function SkeletonCard({ isDarkMode = true }: { isDarkMode?: boolean }) {
  return (
    <div
      className="w-full rounded-sm border border-[#1A1A1A] bg-[#0D0D0D] overflow-hidden"
      aria-hidden="true"
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="skeleton-shimmer w-8 h-8 rounded-full flex-shrink-0" />
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="skeleton-shimmer h-3 w-28 rounded-xs" />
          <div className="skeleton-shimmer h-2.5 w-16 rounded-xs" />
        </div>
        <div className="skeleton-shimmer h-5 w-16 rounded-xs ml-auto" />
      </div>

      <div className="h-px bg-[#1A1A1A] mx-4" />

      <div className="px-4 py-4 space-y-2.5">
        <div className="skeleton-shimmer h-4 w-3/4 rounded-xs" />
        <div className="skeleton-shimmer h-3 w-full rounded-xs" />
        <div className="skeleton-shimmer h-3 w-5/6 rounded-xs" />
        <div className="skeleton-shimmer h-3 w-2/3 rounded-xs" />
      </div>

      <div className="mx-4 mb-4 rounded-xs bg-[#0A0A0A] border border-[#1A1A1A] p-3 space-y-1.5">
        <div className="skeleton-shimmer h-2.5 w-full rounded-xs opacity-60" />
        <div className="skeleton-shimmer h-2.5 w-4/5 rounded-xs opacity-60" />
        <div className="skeleton-shimmer h-2.5 w-3/5 rounded-xs opacity-60" />
      </div>

      <div className="flex items-center gap-4 px-4 pb-4">
        <div className="skeleton-shimmer h-5 w-12 rounded-xs" />
        <div className="skeleton-shimmer h-5 w-12 rounded-xs" />
        <div className="skeleton-shimmer h-5 w-12 rounded-xs ml-auto" />
      </div>
    </div>
  );
}

export function SkeletonFeed({ count = 3, isDarkMode = true }: { count?: number; isDarkMode?: boolean }) {
  return (
    <div className="w-full max-w-[640px] mx-auto py-8 px-4 md:px-0 space-y-8 pb-32">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} isDarkMode={isDarkMode} />
      ))}
    </div>
  );
}
