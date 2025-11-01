"use client";

import { useState, useRef, useEffect } from 'react';
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
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

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
          "p-3 rounded-lg transition-all group cursor-pointer relative",
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
                <p className="text-sm font-semibold truncate flex-1">
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

          {/* 3-dot menu */}
          {editingConvId !== conv.id && (
            <div className="relative flex-shrink-0" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  showMenu
                    ? "bg-muted opacity-100"
                    : "opacity-0 group-hover:opacity-100 hover:bg-muted"
                )}
                aria-label="Chat options"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>

              {/* Dropdown menu */}
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-popover border border-border rounded-lg shadow-lg py-1 z-[110]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEditingConversation(conv.id, conv.name || 'New Chat');
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePinChat(conv.id);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" x2="12" y1="17" y2="22"></line>
                      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
                    </svg>
                    {conv.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({ type: 'chat', id: conv.id, name: conv.name || 'New Chat' });
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 text-destructive flex items-center gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
