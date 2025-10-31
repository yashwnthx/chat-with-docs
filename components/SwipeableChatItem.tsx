"use client";

import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Conversation } from '@/types';

interface SwipeableChatItemProps {
  conv: Conversation;
  swipedChatId: string | null;
  setSwipedChatId: (id: string | null) => void;
  setDeleteConfirm: (value: {type: 'chat' | 'doc', id: string, name: string} | null) => void;
  activeConversationId: string | null;
  editingConvId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  handleSaveConversationName: () => void;
  handleCancelEditing: () => void;
  handleTogglePinChat: (id: string) => void;
  handleStartEditingConversation: (id: string, name: string) => void;
  getLastMessagePreview: (conv: Conversation) => string;
}

export function SwipeableChatItem({
  conv,
  swipedChatId,
  setSwipedChatId,
  setDeleteConfirm,
  activeConversationId,
  editingConvId,
  editingName,
  setEditingName,
  handleSaveConversationName,
  handleCancelEditing,
  handleTogglePinChat,
  handleStartEditingConversation,
  getLastMessagePreview,
}: SwipeableChatItemProps) {
  const router = useRouter();
  const [isSwiping, setIsSwiping] = useState(false);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      setSwipedChatId(conv.id);
      setIsSwiping(false);
    },
    onSwipedRight: () => {
      setSwipedChatId(null);
      setIsSwiping(false);
    },
    onSwiping: () => setIsSwiping(true),
    trackMouse: true,
  });

  return (
    <div className="relative mb-1">
      {/* Delete button (revealed when swiped) */}
      {swipedChatId === conv.id && (
        <div className="absolute inset-0 flex items-center justify-end pr-2 bg-destructive rounded-lg">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirm({ type: 'chat', id: conv.id, name: conv.name || 'New Chat' });
              setSwipedChatId(null);
            }}
            className="text-white font-semibold px-4 py-2"
          >
            Delete
          </button>
        </div>
      )}

      {/* Chat item */}
      <div
        {...swipeHandlers}
        onClick={() => {
          if (editingConvId !== conv.id) {
            setSwipedChatId(null);
            router.push(`/chat/${conv.id}`);
          }
        }}
        className={cn(
          "p-3 rounded-lg transition-all group cursor-pointer relative overflow-hidden",
          swipedChatId === conv.id && "transform -translate-x-20",
          editingConvId === conv.id
            ? "bg-muted"
            : cn(
              conv.id === activeConversationId
                ? "bg-muted"
                : "hover:bg-muted/50"
            )
        )}
        style={{
          transition: swipedChatId === conv.id ? 'transform 0.2s ease-out' : 'transform 0.2s ease-in',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {editingConvId === conv.id ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveConversationName();
                    if (e.key === 'Escape') handleCancelEditing();
                  }}
                  onBlur={handleSaveConversationName}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  className="flex-1 px-2 py-1 text-sm font-semibold bg-background border border-[#0A7CFF] rounded focus:outline-none focus:ring-2 focus:ring-[#0A7CFF]"
                />
              ) : (
                <p
                  className="text-sm font-semibold truncate flex-1 cursor-text"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Don't allow editing if we just swiped
                    if (!isSwiping) {
                      handleStartEditingConversation(conv.id, conv.name || 'New Chat');
                    }
                  }}
                  title="Click to edit"
                >
                  {conv.name || 'New Chat'}
                </p>
              )}
            </div>
            {editingConvId !== conv.id && (
              <p className="text-xs text-muted-foreground truncate">
                {getLastMessagePreview(conv)}
              </p>
            )}
          </div>

          {/* Pin button - Apple Notes style */}
          {editingConvId !== conv.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleTogglePinChat(conv.id);
              }}
              className={cn(
                "flex-shrink-0 p-1 rounded transition-all",
                conv.pinned
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              )}
              title={conv.pinned ? "Unpin" : "Pin"}
              aria-label={conv.pinned ? "Unpin chat" : "Pin chat"}
            >
              <svg
                className={cn(
                  "h-5 w-5 transition-colors",
                  conv.pinned ? "text-amber-500" : "text-muted-foreground hover:text-foreground"
                )}
                fill={conv.pinned ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={conv.pinned ? 0 : 1.5}
                viewBox="0 0 24 24"
              >
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
