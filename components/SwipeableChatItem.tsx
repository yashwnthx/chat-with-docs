"use client";

import { useState, useRef, startTransition } from 'react';
import { useSwipeable } from 'react-swipeable';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Conversation } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerTrigger, DrawerClose } from '@/components/ui/drawer';

interface SwipeableChatItemProps {
  conv: Conversation;
  swipedChatId: string | null;
  setSwipedChatId: (id: string | null) => void;
  setDeleteConfirm: (value: {type: 'chat' | 'doc', id: string, name: string} | null) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
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
  setActiveConversationId,
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
  // Use Radix Popover for the 3-dot menu to avoid clipping by overflow containers
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // No manual outside-click handling needed; Popover handles it via a portal

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
    <div className="relative">
      {/* Delete button (revealed when swiped) */}
      {swipedChatId === conv.id && (
        <div className="absolute inset-0 flex items-center justify-end pr-2 bg-destructive rounded-lg">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirm({ type: 'chat', id: conv.id, name: conv.name || 'New Chat' });
              setSwipedChatId(null);
            }}
            className="text-white font-semibold px-4 py-2 rounded-md hover:bg-destructive/90 transition-colors duration-150"
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
            // Instant UI update
            setActiveConversationId(conv.id);
            // Background URL update
            startTransition(() => {
              router.replace(`/chat/${conv.id}`, { scroll: false });
            });
          }
        }}
        className={cn(
          "px-3 py-2.5 rounded-lg transition-all duration-150 group cursor-pointer relative",
          swipedChatId === conv.id && "transform -translate-x-20",
          editingConvId === conv.id
            ? "bg-muted"
            : cn(
              conv.id === activeConversationId
                ? "bg-muted"
                : "hover:bg-muted/60 active:bg-muted"
            )
        )}
        style={{
          transition: swipedChatId === conv.id ? 'transform 0.2s ease-out' : 'transform 0.2s ease-in',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
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
                  className="flex-1 px-2 py-1 text-sm font-medium bg-background border border-[#0A7CFF] rounded focus:outline-none focus:ring-2 focus:ring-[#0A7CFF]"
                />
              ) : (
                <p className="text-sm font-medium truncate flex-1">
                  {conv.name || 'New Chat'}
                </p>
              )}
            </div>
            {editingConvId !== conv.id && (
              <p className="text-xs text-muted-foreground/70 truncate">
                {getLastMessagePreview(conv)}
              </p>
            )}
          </div>

          {/* 3-dot menu: Drawer on mobile, Popover on desktop */}
          {editingConvId !== conv.id && (
            <>
              {/* Mobile: Drawer action sheet */}
              <div className="relative flex-shrink-0 md:hidden" ref={menuRef}>
                <Drawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <DrawerTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Blur trigger to avoid aria-hidden focus warning when drawer opens
                        (e.currentTarget as HTMLElement).blur();
                        setMobileMenuOpen((v) => !v);
                      }}
                      className={cn(
                        "p-1.5 rounded-md transition-all duration-150",
                        mobileMenuOpen
                          ? "bg-muted opacity-100"
                          : "opacity-60 group-hover:opacity-100 hover:bg-muted/60 active:bg-muted"
                      )}
                      aria-label="Chat options"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground/70">
                        <path d="M15.498 8.50159C16.3254 8.50159 16.9959 9.17228 16.9961 9.99963C16.9961 10.8271 16.3256 11.4987 15.498 11.4987C14.6705 11.4987 14 10.8271 14 9.99963C14.0002 9.17228 14.6706 8.50159 15.498 8.50159Z"></path>
                        <path d="M4.49805 8.50159C5.32544 8.50159 5.99689 9.17228 5.99707 9.99963C5.99707 10.8271 5.32555 11.4987 4.49805 11.4987C3.67069 11.4985 3 10.827 3 9.99963C3.00018 9.17239 3.6708 8.50176 4.49805 8.50159Z"></path>
                        <path d="M10.0003 8.50159C10.8276 8.50176 11.4982 9.17239 11.4984 9.99963C11.4984 10.827 10.8277 11.4985 10.0003 11.4987C9.17283 11.4987 8.50131 10.8271 8.50131 9.99963C8.50149 9.17228 9.17294 8.50159 10.0003 8.50159Z"></path>
                      </svg>
                    </button>
                  </DrawerTrigger>
                  <DrawerContent className="pb-4">
                    <div className="p-2">
                      <div className="space-y-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditingConversation(conv.id, conv.name || 'New Chat');
                            setMobileMenuOpen(false);
                          }}
                          className="w-full px-4 py-3 text-base text-left hover:bg-muted/60 active:bg-muted flex items-center gap-3 transition-colors duration-150 rounded-md"
                        >
                          <svg className="h-5 w-5 text-muted-foreground/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span className="font-medium">Rename</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePinChat(conv.id);
                            setMobileMenuOpen(false);
                          }}
                          className="w-full px-4 py-3 text-base text-left hover:bg-muted/60 active:bg-muted flex items-center gap-3 transition-colors duration-150 rounded-md"
                        >
                          <svg className="h-5 w-5 text-muted-foreground/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" x2="12" y1="17" y2="22"></line>
                            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
                          </svg>
                          <span className="font-medium">{conv.pinned ? 'Unpin' : 'Pin'}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm({ type: 'chat', id: conv.id, name: conv.name || 'New Chat' });
                            setMobileMenuOpen(false);
                          }}
                          className="w-full px-4 py-3 text-base text-left hover:bg-destructive/10 text-destructive flex items-center gap-3 transition-colors duration-150 rounded-md"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="font-medium">Delete</span>
                        </button>
                        <DrawerClose asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            className="mt-1 w-full px-4 py-3 text-base text-center bg-muted/60 hover:bg-muted rounded-md"
                          >
                            Close
                          </button>
                        </DrawerClose>
                      </div>
                    </div>
                  </DrawerContent>
                </Drawer>
              </div>

              {/* Desktop: Popover */}
              <div className="relative flex-shrink-0 hidden md:block" ref={menuRef}>
                <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                  <PopoverTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen((v) => !v);
                      }}
                      className={cn(
                        "p-1.5 rounded-md transition-all duration-150",
                        menuOpen
                          ? "bg-muted opacity-100"
                          : "opacity-60 group-hover:opacity-100 hover:bg-muted/60 active:bg-muted"
                      )}
                      aria-label="Chat options"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground/70">
                        <path d="M15.498 8.50159C16.3254 8.50159 16.9959 9.17228 16.9961 9.99963C16.9961 10.8271 16.3256 11.4987 15.498 11.4987C14.6705 11.4987 14 10.8271 14 9.99963C14.0002 9.17228 14.6706 8.50159 15.498 8.50159Z"></path>
                        <path d="M4.49805 8.50159C5.32544 8.50159 5.99689 9.17228 5.99707 9.99963C5.99707 10.8271 5.32555 11.4987 4.49805 11.4987C3.67069 11.4985 3 10.827 3 9.99963C3.00018 9.17239 3.6708 8.50176 4.49805 8.50159Z"></path>
                        <path d="M10.0003 8.50159C10.8276 8.50176 11.4982 9.17239 11.4984 9.99963C11.4984 10.827 10.8277 11.4985 10.0003 11.4987C9.17283 11.4987 8.50131 10.8271 8.50131 9.99963C8.50149 9.17228 9.17294 8.50159 10.0003 8.50159Z"></path>
                      </svg>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" side="bottom" sideOffset={6} className="w-44 p-1 border border-border rounded-lg shadow-xl z-[110] dark:bg-[#1a1a1a] bg-white">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEditingConversation(conv.id, conv.name || 'New Chat');
                        setMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-muted/60 active:bg-muted flex items-center gap-2.5 transition-colors duration-150 rounded-md"
                    >
                      <svg className="h-4 w-4 text-muted-foreground/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span className="font-medium">Rename</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePinChat(conv.id);
                        setMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-muted/60 active:bg-muted flex items-center gap-2.5 transition-colors duration-150 rounded-md"
                    >
                      <svg className="h-4 w-4 text-muted-foreground/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" x2="12" y1="17" y2="22"></line>
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
                      </svg>
                      <span className="font-medium">{conv.pinned ? 'Unpin' : 'Pin'}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm({ type: 'chat', id: conv.id, name: conv.name || 'New Chat' });
                        setMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 text-destructive flex items-center gap-2.5 transition-colors duration-150 rounded-md"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span className="font-medium">Delete</span>
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
