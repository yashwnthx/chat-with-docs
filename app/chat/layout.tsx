'use client';

import { useMemo, memo } from 'react';
import { usePathname } from 'next/navigation';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ChatInterface } from '@/components/ChatInterface';

// Memoize to prevent re-renders when pathname changes but chatId stays same
const MemoizedChatInterface = memo(ChatInterface);

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Extract chat ID from pathname - memoize to prevent unnecessary re-renders
  const chatId = useMemo(() => {
    const segments = pathname.split('/');
    return segments[segments.length - 1] || 'new';
  }, [pathname]);

  return (
    <ErrorBoundary>
      <MemoizedChatInterface chatId={chatId} />
    </ErrorBoundary>
  );
}
