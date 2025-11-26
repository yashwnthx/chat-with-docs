'use client';

import { memo } from 'react';
import { MessageBubble } from "./MessageBubble";
import { Message } from "@/types";

interface MessageListProps {
  messages: Message[];
  isTyping: boolean;
  isMobileView?: boolean;
  // When false, suppress the "latest message" animation (useful right after switching chats)
  animateLatest?: boolean;
}

export const MessageList = memo(function MessageList({ messages, isTyping, isMobileView = false, animateLatest = true }: MessageListProps) {
  // Find the last user message
  const lastUserMessageIndex = messages.map((m, idx) => m.sender === 'me' ? idx : -1).filter(idx => idx !== -1).pop();

  return (
    <div
      className="flex-1 flex flex-col"
      style={{ contentVisibility: 'auto', contain: 'layout paint' as any }}
    >
      {messages.map((msg, idx) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isLastUserMessage={idx === lastUserMessageIndex}
          justSent={idx === messages.length - 1 && msg.sender === 'me'}
          isMobileView={isMobileView}
          isFirstMessage={idx === 0}
          // Only animate new messages (last one) to avoid flicker on chat switch
          animate={animateLatest && idx === messages.length - 1}
        />
      ))}
      {isTyping && (
        <MessageBubble
          message={{ id: 'typing', content: '', sender: 'bot', timestamp: new Date().toISOString() }}
          isTyping
          isMobileView={isMobileView}
          animate={animateLatest}
        />
      )}
    </div>
  );
});
