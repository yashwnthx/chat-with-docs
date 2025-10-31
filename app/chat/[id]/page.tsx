'use client';

import { use } from 'react';
import { SimpleChatInterface } from '@/components/SimpleChatInterface';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ErrorBoundary>
      <SimpleChatInterface chatId={id} />
    </ErrorBoundary>
  );
}
