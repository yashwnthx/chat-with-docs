'use client';

export function MessageSkeleton() {
  return (
    <div className="flex w-full flex-col relative z-10 animate-pulse">
      <div className="h-1 bg-background" />
      <div className="flex">
        <div className="flex-1 bg-background" />
        <div className="max-w-[75%] flex-none">
          <div className="h-12 bg-muted/50 rounded-2xl"></div>
        </div>
        <div className="flex-1 bg-background" />
      </div>
      <div className="h-1 bg-background" />
    </div>
  );
}

