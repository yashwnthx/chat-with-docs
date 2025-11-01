'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Dynamic import for better code splitting
const SimpleChatInterface = dynamic(
  () => import('@/components/SimpleChatInterface').then(mod => ({ default: mod.SimpleChatInterface })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    ),
    ssr: false,
  }
);

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ErrorBoundary>
      <SimpleChatInterface chatId={id} />
    </ErrorBoundary>
  );
}
