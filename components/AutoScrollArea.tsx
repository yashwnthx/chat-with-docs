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
  const autoScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollHeightRef = useRef<number>(0);

  // Auto-scroll to bottom when new messages arrive or content changes
  useEffect(() => {
    if (shouldAutoScroll && !isUserScrolling && scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        const currentScrollHeight = scrollElement.scrollHeight;

        // If content height has changed, scroll to bottom
        if (currentScrollHeight !== lastScrollHeightRef.current) {
          lastScrollHeightRef.current = currentScrollHeight;

          // Use requestAnimationFrame for smoother scrolling during streaming
          requestAnimationFrame(() => {
            scrollElement.scrollTo({
              top: scrollElement.scrollHeight,
              behavior: 'smooth'
            });
          });
        }
      }
    }
  }, [children, shouldAutoScroll, isUserScrolling]);

  // Observe content changes for better auto-scroll during streaming
  useEffect(() => {
    if (!scrollRef.current || !shouldAutoScroll || isUserScrolling) return;

    const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollElement) return;

    // Create a MutationObserver to detect content changes
    const observer = new MutationObserver(() => {
      if (!isUserScrolling) {
        requestAnimationFrame(() => {
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        });
      }
    });

    // Observe the scroll container for any DOM changes
    observer.observe(scrollElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [shouldAutoScroll, isUserScrolling]);

  // Handle scroll events
  const handleScroll = () => {
    const scrollElement = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollElement) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollElement;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

    setShowScrollButton(!isAtBottom);

    // Clear any pending auto-scroll timeout
    if (autoScrollTimeoutRef.current) {
      clearTimeout(autoScrollTimeoutRef.current);
    }

    // If user scrolls up, mark as user scrolling
    if (!isAtBottom) {
      setIsUserScrolling(true);
    } else {
      // If user scrolls to bottom, resume auto-scroll after a short delay
      autoScrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false);
      }, 100);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoScrollTimeoutRef.current) {
        clearTimeout(autoScrollTimeoutRef.current);
      }
    };
  }, []);

  // Scroll to bottom button
  const scrollToBottom = () => {
    const scrollElement = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollElement) {
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: 'smooth',
      });
      setIsUserScrolling(false);
      setShowScrollButton(false);
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
            "animate-in slide-in-from-bottom-2 fade-in duration-200",
            "hover:shadow-xl"
          )}
          aria-label="Scroll to bottom"
          title="Scroll to bottom"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
}
