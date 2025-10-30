'use client';

import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';

interface AutoScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  shouldAutoScroll?: boolean;
  isMobile?: boolean;
  withVerticalMargins?: boolean;
  mobileHeaderHeight?: boolean;
  bottomMargin?: string;
}

export function AutoScrollArea({
  children,
  className,
  shouldAutoScroll = true,
  isMobile,
  withVerticalMargins,
  mobileHeaderHeight,
  bottomMargin,
}: AutoScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (shouldAutoScroll && !isUserScrolling && scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [children, shouldAutoScroll, isUserScrolling]);

  // Handle scroll events
  const handleScroll = () => {
    const scrollElement = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollElement) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollElement;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

    setShowScrollButton(!isAtBottom);
    setIsUserScrolling(!isAtBottom);
  };

  // Scroll to bottom button
  const scrollToBottom = () => {
    const scrollElement = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollElement) {
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: 'smooth',
      });
      setIsUserScrolling(false);
    }
  };

  return (
    <div className="relative h-full">
      <ScrollArea
        ref={scrollRef}
        className={className}
        isMobile={isMobile}
        withVerticalMargins={withVerticalMargins}
        mobileHeaderHeight={mobileHeaderHeight}
        bottomMargin={bottomMargin}
        onScroll={handleScroll}
      >
        {children}
      </ScrollArea>

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className={cn(
            "fixed bottom-24 right-6 z-40 p-3 rounded-full bg-[#0A7CFF] text-white shadow-lg",
            "hover:bg-[#0A7CFF]/90 active:scale-95 transition-all",
            "animate-in slide-in-from-bottom-2 fade-in duration-200"
          )}
          aria-label="Scroll to bottom"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
}

