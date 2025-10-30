'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MessageList } from '@/components/MessageList';
import { Message } from '@/types';

export default function SharePage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatTitle, setChatTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadSharedChat() {
      try {
        const res = await fetch(`/api/share/${sessionId}`);
        if (!res.ok) {
          throw new Error('Chat not found');
        }

        const data = await res.json();
        setMessages(data.messages.map((msg: any) => ({
          id: msg.id,
          sender: msg.role === 'user' ? 'me' : 'bot',
          content: msg.content,
          timestamp: msg.createdAt || new Date().toISOString(),
        })));
        setChatTitle(data.chat.title || 'Shared Chat');
      } catch (err) {
        setError('Failed to load shared chat');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadSharedChat();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-ios-blue border-r-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Chat Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white dark:bg-black">
      <header className="glass-header border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          {chatTitle}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Shared conversation</p>
      </header>

      <MessageList messages={messages} isTyping={false} />

      <div className="border-t border-gray-200 dark:border-gray-800 p-4 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This is a read-only shared conversation
        </p>
      </div>
    </div>
  );
}
