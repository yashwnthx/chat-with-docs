"use client";

import { useState, useEffect, useCallback, useRef, useMemo, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageInput } from './ChatInput';
import { MessageList } from './MessageList';
import { ChatHeader } from './ChatHeader';
import { ScrollArea } from './ui/scroll-area';
import { ConfirmDialog } from './ConfirmDialog';
import { SwipeableChatItem } from './SwipeableChatItem';
import { cn } from '@/lib/utils';
import { nanoid } from 'nanoid';
import { Message, Conversation, KnowledgeBase } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getDeviceId } from '@/lib/device-id';
import { Drawer, DrawerContent, DrawerTrigger, DrawerClose } from './ui/drawer';

interface ChatInterfaceProps {
  chatId: string;
}

export function ChatInterface({ chatId }: ChatInterfaceProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(chatId);
  const [isTyping, setIsTyping] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKnowledge, setSelectedKnowledge] = useState<string[]>([]);
  const [showKnowledgePanel, setShowKnowledgePanel] = useState(false);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocName, setEditingDocName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{type: 'chat' | 'doc', id: string, name: string} | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false); // Start as false to prevent flash
  // Start with true on both server and client to avoid SSR hydration mismatch;
  // then read saved preference after mount.
  const [showSidebar, setShowSidebar] = useState(true);
  const [swipedChatId, setSwipedChatId] = useState<string | null>(null);
  const [mobileMenuChatId, setMobileMenuChatId] = useState<string | null>(null);
  const [mobileMenuDocId, setMobileMenuDocId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const hasLoadedInitialData = useRef(false); // Track if we've loaded data to prevent blinking
  const lastChatIdRef = useRef<string | null>(chatId);

  const { toast } = useToast();

  // Persist sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar-visible', String(showSidebar));
  }, [showSidebar]);

  // Read sidebar preference after mount to prevent hydration mismatch
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-visible');
      if (saved !== null) {
        setShowSidebar(saved === 'true');
      }
    } catch {}
  }, []);

  // Get active conversation
  const activeConversation = conversations.find(c => c.id === activeConversationId);

  // Memoize sorted conversations to prevent unnecessary re-renders
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      // Pinned chats first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      // Then sort by time
      const timeA = new Date(a.lastMessageTime || 0).getTime();
      const timeB = new Date(b.lastMessageTime || 0).getTime();
      return timeB - timeA; // Most recent first
    });
  }, [conversations]);

  // Helper to get last message preview
  const getLastMessagePreview = (conv: Conversation): string => {
    if (conv.messages.length === 0) return 'No messages yet';
    const lastMsg = conv.messages[conv.messages.length - 1];
    const preview = lastMsg.content.substring(0, 50);
    return preview.length < lastMsg.content.length ? `${preview}...` : preview;
  };

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N for new conversation
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleNewConversation();
      }
      // Cmd/Ctrl + K for search chats
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
        if (!showSearch) {
          setSearchQuery('');
        }
      }
      // Cmd/Ctrl + B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setShowSidebar(prev => !prev);
      }
      // Escape to close panels and search
      if (e.key === 'Escape') {
        setShowKnowledgePanel(false);
        setShowMobileSidebar(false);
        if (showSearch) {
          setShowSearch(false);
          setSearchQuery('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  // Load sidebar chats and knowledge bases on initial mount - SILENT BACKGROUND LOADING
  useEffect(() => {
    // Load data silently in background without blocking UI
    (async () => {
      try {
        // Get device ID for filtering
        const deviceId = getDeviceId();

        // Load all data in parallel
        const [chatsResponse, kbResponse] = await Promise.all([
          fetch(`/api/chats?deviceId=${deviceId}`),
          fetch(`/api/knowledge?deviceId=${deviceId}`),
        ]);

        if (chatsResponse.ok) {
          const { chats } = await chatsResponse.json();

          // Convert ALL chats with ALL their messages
          const allChats: Conversation[] = chats
            .filter((chat: any) => chat.messages && chat.messages.length > 0)
            .map((chat: any) => ({
              id: chat.id,
              name: chat.title || 'New Chat',
              recipients: [{ id: 'ai', name: 'AI Assistant' }],
              messages: chat.messages.map((msg: any) => ({
                id: msg.id.toString(),
                content: msg.content,
                sender: msg.role === 'user' ? 'me' : 'bot',
                timestamp: msg.timestamp,
                sources: msg.sources,
              })),
              lastMessageTime: chat.updatedAt,
              unreadCount: 0,
              pinned: chat.isPinned || false,
            }));

          // Update UI immediately when data arrives
          setConversations(allChats);
          hasLoadedInitialData.current = true; // Mark as loaded

          // If current chat exists, load its knowledge
          if (chatId) {
            const currentChat = chats.find((c: any) => c.id === chatId);
            if (currentChat?.knowledge && currentChat.knowledge.length > 0) {
              const linkedKnowledgeIds = currentChat.knowledge.map((k: any) => k.knowledgeId);
              setSelectedKnowledge(linkedKnowledgeIds);
            }
          }
        }

        // Load knowledge bases
        if (kbResponse.ok) {
          const { knowledge } = await kbResponse.json();
          const convertedKB: KnowledgeBase[] = knowledge.map((kb: any) => ({
            id: kb.id,
            name: kb.name,
            documentCount: kb.documentCount || 1,
            uploadedAt: kb.uploadedAt,
          }));
          setKnowledgeBases(convertedKB);
        }
      } catch (error) {
        // Silent error - don't show toast on initial load
        console.error('Error loading initial data:', error);
        hasLoadedInitialData.current = true; // Mark as loaded even on error
      }
    })();
  }, []); // Only run once on mount, no dependencies to avoid re-fetching

  // Update active conversation when chatId changes from URL
  useEffect(() => {
    // Synchronize activeConversationId with chatId prop
    if (chatId !== activeConversationId) {
      startTransition(() => {
        setActiveConversationId(chatId);

        // Reset knowledge selection for new chats
        if (chatId && !conversations.find(c => c.id === chatId)) {
          setSelectedKnowledge([]);
        }
      });
    }
  }, [chatId, activeConversationId, conversations]);

  // Track the last chatId to detect a chat switch (used to suppress initial animations)
  const switchedChat = lastChatIdRef.current !== chatId;
  useEffect(() => {
    lastChatIdRef.current = chatId;
  }, [chatId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current && activeConversation) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        // Use requestAnimationFrame for smooth scrolling
        requestAnimationFrame(() => {
          try {
            scrollElement.scrollTo({
              top: scrollElement.scrollHeight,
              behavior: (switchedChat ? 'auto' : 'smooth') as ScrollBehavior,
            });
          } catch {
            // Fallback for older browsers
            scrollElement.scrollTop = scrollElement.scrollHeight;
          }
        });
      }
    }
  }, [activeConversation?.messages.length, switchedChat]);

  // Cleanup invalid knowledge IDs and corrupted data
  useEffect(() => {
    // Filter out knowledge bases with invalid IDs (must be cuid format or numeric timestamp is invalid)
    const validKBs = knowledgeBases.filter(kb => {
      // Check if kb exists and has an id
      if (!kb || !kb.id) return false;
      // Timestamp IDs are invalid (they're not in the database)
      if (/^\d+$/.test(kb.id)) {
        console.warn('Removing invalid timestamp ID:', kb.id, kb.name);
        return false;
      }
      return true;
    });

    // If we filtered out any invalid ones, update the state
    if (validKBs.length !== knowledgeBases.length) {
      console.log('Cleaning up invalid knowledge bases');
      setKnowledgeBases(validKBs);
    }

    // Clean up selected knowledge to only include valid IDs
    const validIds = validKBs.map(kb => kb.id);
    setSelectedKnowledge(prev => prev.filter(id => id != null && validIds.includes(id)));
  }, [knowledgeBases]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize virtual keyboard for mobile
  useEffect(() => {
    if ('virtualKeyboard' in navigator) {
      // @ts-expect-error VirtualKeyboard API is not yet in TypeScript types
      navigator.virtualKeyboard.overlaysContent = true;
    }
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuChatId) {
        const target = event.target as HTMLElement;
        const menuElement = target.closest('[data-menu-id]');
        if (!menuElement || menuElement.getAttribute('data-menu-id') !== mobileMenuChatId) {
          setMobileMenuChatId(null);
        }
      }
    };

    if (mobileMenuChatId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [mobileMenuChatId]);

  // Close document menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuDocId) {
        const target = event.target as HTMLElement;
        const menuElement = target.closest('[data-menu-id]');
        if (!menuElement || menuElement.getAttribute('data-menu-id') !== mobileMenuDocId) {
          setMobileMenuDocId(null);
        }
      }
    };

    if (mobileMenuDocId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [mobileMenuDocId]);

  // Close knowledge panel on desktop when clicking outside (excluding the button that opens it)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showKnowledgePanel && !isMobile) {
        const target = event.target as HTMLElement;

        // Check if click is inside the knowledge panel
        const isInsidePanel = target.closest('[data-knowledge-panel="true"]');

        // Check if click is on the knowledge button (to allow toggle)
        const isKnowledgeButton = target.closest('[data-knowledge-button="true"]');

        // Close panel if clicked outside and not on the button
        if (!isInsidePanel && !isKnowledgeButton) {
          setShowKnowledgePanel(false);
        }
      }
    };

    if (showKnowledgePanel && !isMobile) {
      // Use a slight delay to prevent the opening click from immediately closing
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 150);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showKnowledgePanel, isMobile]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !activeConversationId) return;

    const newMessage: Message = {
      id: nanoid(),
      content: text,
      sender: 'me',
      timestamp: new Date().toISOString()
    };

    // Store the bot message ID to avoid creating duplicates
    const botMessageId = nanoid();

    // Optimistically update UI - create conversation if it doesn't exist
    setConversations(prev => {
      const existingConv = prev.find(c => c.id === activeConversationId);

      if (existingConv) {
        // Update existing conversation
        return prev.map(conv =>
          conv.id === activeConversationId
            ? {
                ...conv,
                messages: [...conv.messages, newMessage],
                lastMessageTime: new Date().toISOString(),
              }
            : conv
        );
      } else {
        // Create new conversation for new chat
        return [
          {
            id: activeConversationId,
            name: 'New Chat',
            recipients: [{ id: 'ai', name: 'AI Assistant' }],
            messages: [newMessage],
            lastMessageTime: new Date().toISOString(),
            unreadCount: 0,
          },
          ...prev,
        ];
      }
    });

    setMessageDraft('');
    setIsTyping(true);

    // Get current conversation or create messages array for new chat
    const currentConv = conversations.find(c => c.id === activeConversationId);

    // If conversation doesn't exist yet, we need to build the message history manually
    const allMessages = currentConv
      ? [...currentConv.messages, newMessage]
      : [newMessage];

    const apiMessages = allMessages.map(m => ({
      role: m.sender === 'me' ? 'user' : 'assistant',
      content: m.content
    }));

    // Call API with knowledge base if selected
    try {
      // Filter out any null/undefined knowledge IDs
      const validKnowledgeIds = selectedKnowledge.filter(id => id != null);

      // Get device ID for this request
      const deviceId = getDeviceId();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          chatId: activeConversationId, // Pass the chatId
          knowledgeIds: validKnowledgeIds,
          deviceId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Check if backend created a new chat and get the actual chat ID
      const actualChatId = response.headers.get('X-Chat-Id');
      const chatIdToUse = actualChatId || activeConversationId;

      // Get sources from response headers (Base64 encoded to handle non-ASCII)
      const sourcesHeader = response.headers.get('X-Sources');
      let messageSources: string[] = [];
      if (sourcesHeader) {
        try {
          const decoded = atob(sourcesHeader);
          messageSources = JSON.parse(decoded);
        } catch (e) {
          console.error('Failed to parse sources:', e);
        }
      }

      if (actualChatId && actualChatId !== activeConversationId) {
        // Backend created a new chat, update our state and URL
        setActiveConversationId(actualChatId);

        // Update conversations to use the correct ID
        setConversations(prev => prev.map(conv =>
          conv.id === activeConversationId
            ? { ...conv, id: actualChatId }
            : conv
        ));

        // Update URL without reload - use replace to avoid history entry and remounting
        router.replace(`/chat/${actualChatId}`, { scroll: false });
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let botMessageText = '';
      let hasCreatedBotMessage = false;

      if (reader) {
        // Batch updates to reduce re-renders - only update every 100ms
        let lastUpdateTime = Date.now();
        const UPDATE_INTERVAL = 100; // milliseconds

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('0:')) {
              try {
                const jsonStr = line.slice(2);
                const data = JSON.parse(jsonStr);
                if (data) {
                  botMessageText += data;

                  // Only update UI if enough time has passed OR if this is the first chunk
                  const now = Date.now();
                  const shouldUpdate = !hasCreatedBotMessage || (now - lastUpdateTime >= UPDATE_INTERVAL);

                  if (shouldUpdate) {
                    lastUpdateTime = now;

                    // Update message in real-time using the correct chat ID
                    setConversations(prev => prev.map(conv => {
                      if (conv.id !== chatIdToUse) return conv;

                      const lastMsg = conv.messages[conv.messages.length - 1];
                      if (lastMsg && lastMsg.sender === 'bot') {
                        // Update existing bot message
                        hasCreatedBotMessage = true;
                        return {
                          ...conv,
                          messages: [
                            ...conv.messages.slice(0, -1),
                            { ...lastMsg, content: botMessageText }
                          ]
                        };
                      } else {
                        // Add new bot message
                        hasCreatedBotMessage = true;
                        return {
                          ...conv,
                          messages: [...conv.messages, {
                            id: botMessageId,
                            content: botMessageText,
                            sender: 'bot',
                            timestamp: new Date().toISOString(),
                            sources: messageSources.length > 0 ? JSON.stringify(messageSources) : undefined,
                          }]
                        };
                      }
                    }));
                  }
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }

        // Final update with complete message
        if (botMessageText) {
          setConversations(prev => prev.map(conv => {
            if (conv.id !== chatIdToUse) return conv;

            const lastMsg = conv.messages[conv.messages.length - 1];
            if (lastMsg && lastMsg.sender === 'bot' && lastMsg.id === botMessageId) {
              // Update existing bot message with final content
              return {
                ...conv,
                messages: [
                  ...conv.messages.slice(0, -1),
                  { ...lastMsg, content: botMessageText }
                ],
                lastMessageTime: new Date().toISOString(),
              };
            }
            return conv;
          }));
        }
      }

      // Ensure there's a message if stream was empty
      if (!botMessageText) {
        const fallbackMessage: Message = {
          id: botMessageId,
          content: 'I received your message!',
          sender: 'bot',
          timestamp: new Date().toISOString(),
          sources: messageSources.length > 0 ? JSON.stringify(messageSources) : undefined,
        };

        setConversations(prev => prev.map(conv =>
          conv.id === chatIdToUse
            ? {
                ...conv,
                messages: [...conv.messages, fallbackMessage],
                lastMessageTime: new Date().toISOString(),
              }
            : conv
        ));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Fallback response
      const botMessage: Message = {
        id: botMessageId,
        content: `I understand you said: "${text}". How can I help you with that?`,
        sender: 'bot',
        timestamp: new Date().toISOString(),
        sources: undefined,
      };

      setConversations(prev => prev.map(conv =>
        conv.id === activeConversationId
          ? {
              ...conv,
              messages: [...conv.messages, botMessage],
              lastMessageTime: new Date().toISOString(),
            }
          : conv
      ));
    } finally {
      setIsTyping(false);
    }
  };

  const handleNewConversation = useCallback(() => {
    // Create new chat ID
    const newChatId = nanoid();

    // Instant UI update - user sees immediate feedback
    setActiveConversationId(newChatId);
    setSelectedKnowledge([]);

    // Background URL update - use replace for seamless transition
    startTransition(() => {
      router.replace(`/chat/${newChatId}`, { scroll: false });
    });
  }, [router]);

  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/chats/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete chat');
      }

      // Determine where to navigate BEFORE updating state
      let shouldNavigate = false;
      let navigateTo = '';

      setConversations(prev => {
        const filtered = prev.filter(c => c.id !== id);

        // If we deleted the active chat, we need to navigate
        if (id === activeConversationId) {
          shouldNavigate = true;
          if (filtered.length > 0) {
            navigateTo = `/chat/${filtered[0].id}`;
          } else {
            navigateTo = `/chat/${nanoid()}`;
          }
        }

        return filtered;
      });

      // Navigate AFTER state update completes
      if (shouldNavigate) {
        router.push(navigateTo);
      }

      toast({
        title: "Chat deleted",
      });
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: "Could not delete chat",
        variant: "destructive",
      });
    }
  }, [activeConversationId, router, toast]);

  const handleTogglePinChat = useCallback(async (id: string) => {
    try {
      const conv = conversations.find(c => c.id === id);
      if (!conv) return;

      const newPinnedState = !conv.pinned;

      const response = await fetch(`/api/chats/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: newPinnedState }),
      });

      if (!response.ok) {
        throw new Error('Failed to update chat');
      }

      setConversations(prev => prev.map(c =>
        c.id === id ? { ...c, pinned: newPinnedState } : c
      ));

      toast({
        title: newPinnedState ? "Chat pinned" : "Chat unpinned",
      });
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast({
        title: "Could not update chat",
        variant: "destructive",
      });
    }
  }, [conversations, toast]);

  const handleToggleKnowledge = useCallback((id: string) => {
    if (!id) return; // Prevent null/undefined IDs
    setSelectedKnowledge(prev =>
      prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
    );
  }, []);

  const handleStartEditingConversation = (id: string, currentName: string) => {
    setEditingConvId(id);
    setEditingName(currentName || 'New Chat');
  };

  const handleSaveConversationName = async () => {
    if (!editingConvId || !editingName.trim()) return;

    try {
      const response = await fetch(`/api/chats/${editingConvId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingName.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to update chat name');
      }

      setConversations(prev => prev.map(conv =>
        conv.id === editingConvId
          ? { ...conv, name: editingName.trim() }
          : conv
      ));

      setEditingConvId(null);
      setEditingName('');

      toast({
        title: "Chat renamed",
      });
    } catch (error) {
      console.error('Error updating chat name:', error);
      toast({
        title: "Could not rename chat",
        variant: "destructive",
      });
    }
  };

  const handleCancelEditing = () => {
    setEditingConvId(null);
    setEditingName('');
  };

  const handleStartEditingDoc = (id: string, currentName: string) => {
    setEditingDocId(id);
    setEditingDocName(currentName);
  };

  const handleSaveDocName = useCallback(() => {
    if (!editingDocId || !editingDocName.trim()) return;

    setKnowledgeBases(prev => prev.map(kb =>
      kb.id === editingDocId
        ? { ...kb, name: editingDocName.trim() }
        : kb
    ));

    toast({
      title: "Document renamed",
    });

    setEditingDocId(null);
    setEditingDocName('');
  }, [editingDocId, editingDocName, toast]);

  const handleCancelDocEditing = () => {
    setEditingDocId(null);
    setEditingDocName('');
  };

  // Filter conversations based on search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) {
      return sortedConversations;
    }

    const query = searchQuery.toLowerCase();
    return sortedConversations.filter(conv => {
      // Search in conversation name
      if (conv.name?.toLowerCase().includes(query)) {
        return true;
      }

      // Search in message content
      return conv.messages.some(msg =>
        msg.content.toLowerCase().includes(query)
      );
    });
  }, [sortedConversations, searchQuery]);

  return (
    <>
      {/* Search Modal */}
      {showSearch && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[70] animate-in fade-in duration-200"
            onClick={() => setShowSearch(false)}
          />
          <div className="fixed left-1/2 top-[10%] -translate-x-1/2 w-full max-w-2xl mx-4 bg-background rounded-xl shadow-2xl border border-border/40 z-[70] animate-in slide-in-from-top-4 duration-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-4">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-muted-foreground flex-shrink-0" aria-hidden="true">
                <path d="M14.0857 8.74999C14.0857 5.80355 11.6972 3.41503 8.75073 3.41503C5.80429 3.41503 3.41577 5.80355 3.41577 8.74999C3.41577 11.6964 5.80429 14.085 8.75073 14.085C11.6972 14.085 14.0857 11.6964 14.0857 8.74999ZM15.4158 8.74999C15.4158 10.3539 14.848 11.8245 13.9041 12.9746L13.9705 13.0303L16.9705 16.0303L17.0564 16.1338C17.2269 16.3919 17.1977 16.7434 16.9705 16.9707C16.7432 17.1975 16.3925 17.226 16.1345 17.0557L16.03 16.9707L13.03 13.9707L12.9753 13.9033C11.8253 14.8472 10.3547 15.415 8.75073 15.415C5.06975 15.415 2.08569 12.431 2.08569 8.74999C2.08569 5.06901 5.06975 2.08495 8.75073 2.08495C12.4317 2.08495 15.4158 5.06901 15.4158 8.74999Z"></path>
              </svg>
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground/50"
                autoFocus
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                className="p-1.5 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground flex-shrink-0"
                aria-label="Close search"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="icon">
                  <path d="M14.2548 4.75488C14.5282 4.48152 14.9717 4.48152 15.2451 4.75488C15.5184 5.02825 15.5184 5.47175 15.2451 5.74512L10.9902 10L15.2451 14.2549L15.3349 14.3652C15.514 14.6369 15.4841 15.006 15.2451 15.2451C15.006 15.4842 14.6368 15.5141 14.3652 15.335L14.2548 15.2451L9.99995 10.9902L5.74506 15.2451C5.4717 15.5185 5.0282 15.5185 4.75483 15.2451C4.48146 14.9718 4.48146 14.5282 4.75483 14.2549L9.00971 10L4.75483 5.74512L4.66499 5.63477C4.48589 5.3631 4.51575 4.99396 4.75483 4.75488C4.99391 4.51581 5.36305 4.48594 5.63471 4.66504L5.74506 4.75488L9.99995 9.00977L14.2548 4.75488Z"></path>
                </svg>
              </button>
            </div>
            <hr className="border-border/40" />

            <div className="max-h-[440px] min-h-[440px] overflow-y-auto">
              {/* Always show New chat option */}
              <button
                onClick={() => {
                  handleNewConversation();
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/60 active:bg-muted transition-all duration-150"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-muted-foreground/70 flex-shrink-0">
                  <path d="M2.6687 11.333V8.66699C2.6687 7.74455 2.66841 7.01205 2.71655 6.42285C2.76533 5.82612 2.86699 5.31731 3.10425 4.85156L3.25854 4.57617C3.64272 3.94975 4.19392 3.43995 4.85229 3.10449L5.02905 3.02149C5.44666 2.84233 5.90133 2.75849 6.42358 2.71582C7.01272 2.66769 7.74445 2.66797 8.66675 2.66797H9.16675C9.53393 2.66797 9.83165 2.96586 9.83179 3.33301C9.83179 3.70028 9.53402 3.99805 9.16675 3.99805H8.66675C7.7226 3.99805 7.05438 3.99834 6.53198 4.04102C6.14611 4.07254 5.87277 4.12568 5.65601 4.20313L5.45581 4.28906C5.01645 4.51293 4.64872 4.85345 4.39233 5.27149L4.28979 5.45508C4.16388 5.7022 4.08381 6.01663 4.04175 6.53125C3.99906 7.05373 3.99878 7.7226 3.99878 8.66699V11.333C3.99878 12.2774 3.99906 12.9463 4.04175 13.4688C4.08381 13.9833 4.16389 14.2978 4.28979 14.5449L4.39233 14.7285C4.64871 15.1465 5.01648 15.4871 5.45581 15.7109L5.65601 15.7969C5.87276 15.8743 6.14614 15.9265 6.53198 15.958C7.05439 16.0007 7.72256 16.002 8.66675 16.002H11.3337C12.2779 16.002 12.9461 16.0007 13.4685 15.958C13.9829 15.916 14.2976 15.8367 14.5447 15.7109L14.7292 15.6074C15.147 15.3511 15.4879 14.9841 15.7117 14.5449L15.7976 14.3447C15.8751 14.128 15.9272 13.8546 15.9587 13.4688C16.0014 12.9463 16.0017 12.2774 16.0017 11.333V10.833C16.0018 10.466 16.2997 10.1681 16.6667 10.168C17.0339 10.168 17.3316 10.4659 17.3318 10.833V11.333C17.3318 12.2555 17.3331 12.9879 17.2849 13.5771C17.2422 14.0993 17.1584 14.5541 16.9792 14.9717L16.8962 15.1484C16.5609 15.8066 16.0507 16.3571 15.4246 16.7412L15.1492 16.8955C14.6833 17.1329 14.1739 17.2354 13.5769 17.2842C12.9878 17.3323 12.256 17.332 11.3337 17.332H8.66675C7.74446 17.332 7.01271 17.3323 6.42358 17.2842C5.90135 17.2415 5.44665 17.1577 5.02905 16.9785L4.85229 16.8955C4.19396 16.5601 3.64271 16.0502 3.25854 15.4238L3.10425 15.1484C2.86697 14.6827 2.76534 14.1739 2.71655 13.5771C2.66841 12.9879 2.6687 12.2555 2.6687 11.333ZM13.4646 3.11328C14.4201 2.334 15.8288 2.38969 16.7195 3.28027L16.8865 3.46485C17.6141 4.35685 17.6143 5.64423 16.8865 6.53613L16.7195 6.7207L11.6726 11.7686C11.1373 12.3039 10.4624 12.6746 9.72827 12.8408L9.41089 12.8994L7.59351 13.1582C7.38637 13.1877 7.17701 13.1187 7.02905 12.9707C6.88112 12.8227 6.81199 12.6134 6.84155 12.4063L7.10132 10.5898L7.15991 10.2715C7.3262 9.53749 7.69692 8.86241 8.23218 8.32715L13.2791 3.28027L13.4646 3.11328ZM15.7791 4.2207C15.3753 3.81702 14.7366 3.79124 14.3035 4.14453L14.2195 4.2207L9.17261 9.26856C8.81541 9.62578 8.56774 10.0756 8.45679 10.5654L8.41772 10.7773L8.28296 11.7158L9.22241 11.582L9.43433 11.543C9.92426 11.432 10.3749 11.1844 10.7322 10.8271L15.7791 5.78027L15.8552 5.69629C16.185 5.29194 16.1852 4.708 15.8552 4.30371L15.7791 4.2207Z"/>
                </svg>
                <div className="flex-1 text-left text-sm font-medium">
                  New chat
                </div>
              </button>

              {filteredConversations.length > 0 && (
                <>
                  <div className="my-2">
                    {/* Today section header */}
                    <div className="px-4 py-2.5 text-xs font-semibold text-muted-foreground/70">
                      Chats
                    </div>
                    <div className="space-y-1 px-2">
                      {filteredConversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => {
                            // Instant UI update
                            setActiveConversationId(conv.id);
                            setShowSearch(false);
                            setSearchQuery('');
                            // Background URL update
                            startTransition(() => {
                              router.replace(`/chat/${conv.id}`, { scroll: false });
                            });
                          }}
                          className="group relative flex items-center w-full rounded-lg px-3 py-2.5 hover:bg-muted/60 active:bg-muted transition-all duration-150 text-left"
                        >
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground/70 flex-shrink-0">
                            <path d="M16.835 9.99968C16.8348 6.49038 13.8111 3.58171 10 3.58171C6.18893 3.58171 3.16523 6.49038 3.16504 9.99968C3.16504 11.4535 3.67943 12.7965 4.55273 13.8766C4.67524 14.0281 4.72534 14.2262 4.68945 14.4176C4.59391 14.9254 4.45927 15.4197 4.30469 15.904C4.93198 15.8203 5.5368 15.6959 6.12793 15.528L6.25391 15.5055C6.38088 15.4949 6.5091 15.5208 6.62305 15.5817C7.61731 16.1135 8.76917 16.4186 10 16.4186C13.8112 16.4186 16.835 13.5091 16.835 9.99968ZM18.165 9.99968C18.165 14.3143 14.4731 17.7487 10 17.7487C8.64395 17.7487 7.36288 17.4332 6.23438 16.8757C5.31485 17.118 4.36919 17.2694 3.37402 17.3307C3.14827 17.3446 2.93067 17.2426 2.79688 17.0602C2.66303 16.8778 2.63177 16.6396 2.71289 16.4284L2.91992 15.863C3.08238 15.3953 3.21908 14.9297 3.32227 14.4606C2.38719 13.2019 1.83496 11.6626 1.83496 9.99968C1.83515 5.68525 5.52703 2.25163 10 2.25163C14.473 2.25163 18.1649 5.68525 18.165 9.99968Z"></path>
                          </svg>
                          <div className="flex-1 ml-3 overflow-hidden">
                            <div className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
                              {conv.name}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {filteredConversations.length === 0 && searchQuery.trim() && (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <svg width="56" height="56" viewBox="0 0 20 20" fill="currentColor" className="text-muted-foreground/30 mb-4">
                    <path d="M14.0857 8.74999C14.0857 5.80355 11.6972 3.41503 8.75073 3.41503C5.80429 3.41503 3.41577 5.80355 3.41577 8.74999C3.41577 11.6964 5.80429 14.085 8.75073 14.085C11.6972 14.085 14.0857 11.6964 14.0857 8.74999ZM15.4158 8.74999C15.4158 10.3539 14.848 11.8245 13.9041 12.9746L13.9705 13.0303L16.9705 16.0303L17.0564 16.1338C17.2269 16.3919 17.1977 16.7434 16.9705 16.9707C16.7432 17.1975 16.3925 17.226 16.1345 17.0557L16.03 16.9707L13.03 13.9707L12.9753 13.9033C11.8253 14.8472 10.3547 15.415 8.75073 15.415C5.06975 15.415 2.08569 12.431 2.08569 8.74999C2.08569 5.06901 5.06975 2.08495 8.75073 2.08495C12.4317 2.08495 15.4158 5.06901 15.4158 8.74999Z"></path>
                  </svg>
                  <div className="text-base font-semibold text-foreground/90 mb-1">No chats found</div>
                  <div className="text-sm text-muted-foreground/60">Try searching with a different term</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

    <div className="flex h-dvh bg-background overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <>
          <div
            className="fixed inset-0 bg-black/10 z-40 lg:hidden animate-in fade-in duration-200"
            onClick={() => setShowMobileSidebar(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-background border-r border-border/40 z-50 lg:hidden animate-in slide-in-from-left duration-200">
            <div className="p-4 flex items-center justify-between">
              <h2 className="font-semibold">Chats</h2>
              <button
                onClick={() => setShowMobileSidebar(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <button
                onClick={() => {
                  handleNewConversation();
                  setShowMobileSidebar(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#0A7CFF] text-white hover:bg-[#0A7CFF]/90 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M2.6687 11.333V8.66699C2.6687 7.74455 2.66841 7.01205 2.71655 6.42285C2.76533 5.82612 2.86699 5.31731 3.10425 4.85156L3.25854 4.57617C3.64272 3.94975 4.19392 3.43995 4.85229 3.10449L5.02905 3.02149C5.44666 2.84233 5.90133 2.75849 6.42358 2.71582C7.01272 2.66769 7.74445 2.66797 8.66675 2.66797H9.16675C9.53393 2.66797 9.83165 2.96586 9.83179 3.33301C9.83179 3.70028 9.53402 3.99805 9.16675 3.99805H8.66675C7.7226 3.99805 7.05438 3.99834 6.53198 4.04102C6.14611 4.07254 5.87277 4.12568 5.65601 4.20313L5.45581 4.28906C5.01645 4.51293 4.64872 4.85345 4.39233 5.27149L4.28979 5.45508C4.16388 5.7022 4.08381 6.01663 4.04175 6.53125C3.99906 7.05373 3.99878 7.7226 3.99878 8.66699V11.333C3.99878 12.2774 3.99906 12.9463 4.04175 13.4688C4.08381 13.9833 4.16389 14.2978 4.28979 14.5449L4.39233 14.7285C4.64871 15.1465 5.01648 15.4871 5.45581 15.7109L5.65601 15.7969C5.87276 15.8743 6.14614 15.9265 6.53198 15.958C7.05439 16.0007 7.72256 16.002 8.66675 16.002H11.3337C12.2779 16.002 12.9461 16.0007 13.4685 15.958C13.9829 15.916 14.2976 15.8367 14.5447 15.7109L14.7292 15.6074C15.147 15.3511 15.4879 14.9841 15.7117 14.5449L15.7976 14.3447C15.8751 14.128 15.9272 13.8546 15.9587 13.4688C16.0014 12.9463 16.0017 12.2774 16.0017 11.333V10.833C16.0018 10.466 16.2997 10.1681 16.6667 10.168C17.0339 10.168 17.3316 10.4659 17.3318 10.833V11.333C17.3318 12.2555 17.3331 12.9879 17.2849 13.5771C17.2422 14.0993 17.1584 14.5541 16.9792 14.9717L16.8962 15.1484C16.5609 15.8066 16.0507 16.3571 15.4246 16.7412L15.1492 16.8955C14.6833 17.1329 14.1739 17.2354 13.5769 17.2842C12.9878 17.3323 12.256 17.332 11.3337 17.332H8.66675C7.74446 17.332 7.01271 17.3323 6.42358 17.2842C5.90135 17.2415 5.44665 17.1577 5.02905 16.9785L4.85229 16.8955C4.19396 16.5601 3.64271 16.0502 3.25854 15.4238L3.10425 15.1484C2.86697 14.6827 2.76534 14.1739 2.71655 13.5771C2.66841 12.9879 2.6687 12.2555 2.6687 11.333ZM13.4646 3.11328C14.4201 2.334 15.8288 2.38969 16.7195 3.28027L16.8865 3.46485C17.6141 4.35685 17.6143 5.64423 16.8865 6.53613L16.7195 6.7207L11.6726 11.7686C11.1373 12.3039 10.4624 12.6746 9.72827 12.8408L9.41089 12.8994L7.59351 13.1582C7.38637 13.1877 7.17701 13.1187 7.02905 12.9707C6.88112 12.8227 6.81199 12.6134 6.84155 12.4063L7.10132 10.5898L7.15991 10.2715C7.3262 9.53749 7.69692 8.86241 8.23218 8.32715L13.2791 3.28027L13.4646 3.11328ZM15.7791 4.2207C15.3753 3.81702 14.7366 3.79124 14.3035 4.14453L14.2195 4.2207L9.17261 9.26856C8.81541 9.62578 8.56774 10.0756 8.45679 10.5654L8.41772 10.7773L8.28296 11.7158L9.22241 11.582L9.43433 11.543C9.92426 11.432 10.3749 11.1844 10.7322 10.8271L15.7791 5.78027L15.8552 5.69629C16.185 5.29194 16.1852 4.708 15.8552 4.30371L15.7791 4.2207Z"></path>
                </svg>
                <span>New Chat</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-visible p-2">
              {sortedConversations.length === 0 && hasLoadedInitialData.current ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-4 animate-in fade-in duration-500">
                  <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="mb-3 opacity-20">
                    <path d="M16.835 9.99968C16.8348 6.49038 13.8111 3.58171 10 3.58171C6.18893 3.58171 3.16523 6.49038 3.16504 9.99968C3.16504 11.4535 3.67943 12.7965 4.55273 13.8766C4.67524 14.0281 4.72534 14.2262 4.68945 14.4176C4.59391 14.9254 4.45927 15.4197 4.30469 15.904C4.93198 15.8203 5.5368 15.6959 6.12793 15.528L6.25391 15.5055C6.38088 15.4949 6.5091 15.5208 6.62305 15.5817C7.61731 16.1135 8.76917 16.4186 10 16.4186C13.8112 16.4186 16.835 13.5091 16.835 9.99968ZM18.165 9.99968C18.165 14.3143 14.4731 17.7487 10 17.7487C8.64395 17.7487 7.36288 17.4332 6.23438 16.8757C5.31485 17.118 4.36919 17.2694 3.37402 17.3307C3.14827 17.3446 2.93067 17.2426 2.79688 17.0602C2.66303 16.8778 2.63177 16.6396 2.71289 16.4284L2.91992 15.863C3.08238 15.3953 3.21908 14.9297 3.32227 14.4606C2.38719 13.2019 1.83496 11.6626 1.83496 9.99968C1.83515 5.68525 5.52703 2.25163 10 2.25163C14.473 2.25163 18.1649 5.68525 18.165 9.99968Z"></path>
                  </svg>
                  <p className="text-sm font-medium mb-1">No chats yet</p>
                  <p className="text-xs opacity-70">Start a new conversation</p>
                </div>
              ) : (
                <>
                  {/* Pinned Section */}
                  {sortedConversations.some(c => c.pinned) && (
                    <>
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Pinned
                      </div>
                      {sortedConversations.filter(c => c.pinned).map(conv => (
                        <div
                          key={conv.id}
                          onClick={() => {
                            if (editingConvId !== conv.id) {
                              // Instant UI update
                              setActiveConversationId(conv.id);
                              setShowMobileSidebar(false);
                              // Background URL update
                              startTransition(() => {
                                router.replace(`/chat/${conv.id}`, { scroll: false });
                              });
                            }
                          }}
                          className={cn(
                            "p-3 rounded-lg mb-1 transition-colors cursor-pointer group overflow-visible",
                            editingConvId === conv.id
                              ? "bg-muted"
                              : activeConversationId === conv.id
                              ? "bg-[#0A7CFF]/10 border border-[#0A7CFF]/20"
                              : "hover:bg-muted"
                          )}
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
                              <div className="relative flex-shrink-0" data-menu-id={conv.id}>
                                <button
                                  id={`menu-button-${conv.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMobileMenuChatId(mobileMenuChatId === conv.id ? null : conv.id);
                                  }}
                                  className="p-1.5 rounded-md hover:bg-muted"
                                  aria-label="Chat options"
                                >
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                                  </svg>
                                </button>

                                {/* Dropdown menu - uses fixed positioning to escape container */}
                                {mobileMenuChatId === conv.id && (() => {
                                  const button = document.getElementById(`menu-button-${conv.id}`);
                                  const rect = button?.getBoundingClientRect();
                                  return (
                                    <div
                                      className="fixed w-40 bg-background border border-border rounded-lg shadow-lg py-1 z-[110]"
                                      style={{
                                        top: rect ? `${rect.bottom + 4}px` : '0px',
                                        left: rect ? `${rect.right - 160}px` : '0px',
                                      }}
                                    >
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartEditingConversation(conv.id, conv.name || 'New Chat');
                                          setMobileMenuChatId(null);
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
                                          setMobileMenuChatId(null);
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
                                          setMobileMenuChatId(null);
                                        }}
                                        className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 text-destructive flex items-center gap-2"
                                      >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Delete
                                      </button>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Unpinned Section */}
                  {sortedConversations.some(c => !c.pinned) && (
                    <>
                      {sortedConversations.some(c => c.pinned) && (
                        <div className="px-3 py-2 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Recent
                        </div>
                      )}
                      {sortedConversations.filter(c => !c.pinned).map(conv => (
                        <div
                          key={conv.id}
                          onClick={() => {
                            if (editingConvId !== conv.id) {
                              // Instant UI update
                              setActiveConversationId(conv.id);
                              setShowMobileSidebar(false);
                              // Background URL update
                              startTransition(() => {
                                router.replace(`/chat/${conv.id}`, { scroll: false });
                              });
                            }
                          }}
                          className={cn(
                            "p-3 rounded-lg mb-1 transition-colors cursor-pointer group overflow-visible",
                            editingConvId === conv.id
                              ? "bg-muted"
                              : activeConversationId === conv.id
                              ? "bg-[#0A7CFF]/10 border border-[#0A7CFF]/20"
                              : "hover:bg-muted"
                          )}
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
                              <div className="relative flex-shrink-0" data-menu-id={conv.id}>
                                <button
                                  id={`menu-button-${conv.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMobileMenuChatId(mobileMenuChatId === conv.id ? null : conv.id);
                                  }}
                                  className="p-1.5 rounded-md hover:bg-muted"
                                  aria-label="Chat options"
                                >
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                                  </svg>
                                </button>

                                {/* Dropdown menu - uses fixed positioning to escape container */}
                                {mobileMenuChatId === conv.id && (() => {
                                  const button = document.getElementById(`menu-button-${conv.id}`);
                                  const rect = button?.getBoundingClientRect();
                                  return (
                                    <div
                                      className="fixed w-40 bg-background border border-border rounded-lg shadow-lg py-1 z-[110]"
                                      style={{
                                        top: rect ? `${rect.bottom + 4}px` : '0px',
                                        left: rect ? `${rect.right - 160}px` : '0px',
                                      }}
                                    >
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartEditingConversation(conv.id, conv.name || 'New Chat');
                                          setMobileMenuChatId(null);
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
                                          setMobileMenuChatId(null);
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
                                          setMobileMenuChatId(null);
                                        }}
                                        className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 text-destructive flex items-center gap-2"
                                      >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Delete
                                      </button>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Chat Sidebar - Hidden on mobile, shown on tablet+ */}
      {showSidebar && (
        <div className="w-64 border-r border-border/40 bg-background flex-col hidden lg:flex animate-in slide-in-from-left duration-200">
          {/* Hide Sidebar Button */}
          <div className="pt-3 pb-3">
            <div className="px-3">
              <button
                onClick={() => setShowSidebar(false)}
                className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 active:bg-muted transition-all duration-150 text-left"
                aria-label="Hide sidebar"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 text-muted-foreground/70">
                  <path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z"></path>
                </svg>
                <div className="flex-1 text-sm font-medium">Hide sidebar</div>
                <div className="text-xs text-muted-foreground/60 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-border/60 bg-muted/40">⌘</kbd>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-border/60 bg-muted/40">B</kbd>
                </div>
              </button>
            </div>
          </div>

          <div className="px-3 py-3 space-y-1.5">
            {/* Search chats button */}
            <button
              onClick={() => setShowSearch(true)}
              className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 active:bg-muted transition-all duration-150 text-left"
              aria-label="Search chats"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 text-muted-foreground/70">
                <path d="M14.0857 8.74999C14.0857 5.80355 11.6972 3.41503 8.75073 3.41503C5.80429 3.41503 3.41577 5.80355 3.41577 8.74999C3.41577 11.6964 5.80429 14.085 8.75073 14.085C11.6972 14.085 14.0857 11.6964 14.0857 8.74999ZM15.4158 8.74999C15.4158 10.3539 14.848 11.8245 13.9041 12.9746L13.9705 13.0303L16.9705 16.0303L17.0564 16.1338C17.2269 16.3919 17.1977 16.7434 16.9705 16.9707C16.7432 17.1975 16.3925 17.226 16.1345 17.0557L16.03 16.9707L13.03 13.9707L12.9753 13.9033C11.8253 14.8472 10.3547 15.415 8.75073 15.415C5.06975 15.415 2.08569 12.431 2.08569 8.74999C2.08569 5.06901 5.06975 2.08495 8.75073 2.08495C12.4317 2.08495 15.4158 5.06901 15.4158 8.74999Z"></path>
              </svg>
              <div className="flex-1 text-sm font-medium">Search chats</div>
              <div className="text-xs text-muted-foreground/60 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-border/60 bg-muted/40">⌘</kbd>
                <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-border/60 bg-muted/40">K</kbd>
              </div>
            </button>

            {/* New Chat button */}
            <button
              onClick={handleNewConversation}
              className="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#0A7CFF] text-white hover:bg-[#0969E0] active:bg-[#0859C7] transition-all duration-150 font-medium text-sm shadow-sm"
              aria-label="New chat"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M2.6687 11.333V8.66699C2.6687 7.74455 2.66841 7.01205 2.71655 6.42285C2.76533 5.82612 2.86699 5.31731 3.10425 4.85156L3.25854 4.57617C3.64272 3.94975 4.19392 3.43995 4.85229 3.10449L5.02905 3.02149C5.44666 2.84233 5.90133 2.75849 6.42358 2.71582C7.01272 2.66769 7.74445 2.66797 8.66675 2.66797H9.16675C9.53393 2.66797 9.83165 2.96586 9.83179 3.33301C9.83179 3.70028 9.53402 3.99805 9.16675 3.99805H8.66675C7.7226 3.99805 7.05438 3.99834 6.53198 4.04102C6.14611 4.07254 5.87277 4.12568 5.65601 4.20313L5.45581 4.28906C5.01645 4.51293 4.64872 4.85345 4.39233 5.27149L4.28979 5.45508C4.16388 5.7022 4.08381 6.01663 4.04175 6.53125C3.99906 7.05373 3.99878 7.7226 3.99878 8.66699V11.333C3.99878 12.2774 3.99906 12.9463 4.04175 13.4688C4.08381 13.9833 4.16389 14.2978 4.28979 14.5449L4.39233 14.7285C4.64871 15.1465 5.01648 15.4871 5.45581 15.7109L5.65601 15.7969C5.87276 15.8743 6.14614 15.9265 6.53198 15.958C7.05439 16.0007 7.72256 16.002 8.66675 16.002H11.3337C12.2779 16.002 12.9461 16.0007 13.4685 15.958C13.9829 15.916 14.2976 15.8367 14.5447 15.7109L14.7292 15.6074C15.147 15.3511 15.4879 14.9841 15.7117 14.5449L15.7976 14.3447C15.8751 14.128 15.9272 13.8546 15.9587 13.4688C16.0014 12.9463 16.0017 12.2774 16.0017 11.333V10.833C16.0018 10.466 16.2997 10.1681 16.6667 10.168C17.0339 10.168 17.3316 10.4659 17.3318 10.833V11.333C17.3318 12.2555 17.3331 12.9879 17.2849 13.5771C17.2422 14.0993 17.1584 14.5541 16.9792 14.9717L16.8962 15.1484C16.5609 15.8066 16.0507 16.3571 15.4246 16.7412L15.1492 16.8955C14.6833 17.1329 14.1739 17.2354 13.5769 17.2842C12.9878 17.3323 12.256 17.332 11.3337 17.332H8.66675C7.74446 17.332 7.01271 17.3323 6.42358 17.2842C5.90135 17.2415 5.44665 17.1577 5.02905 16.9785L4.85229 16.8955C4.19396 16.5601 3.64271 16.0502 3.25854 15.4238L3.10425 15.1484C2.86697 14.6827 2.76534 14.1739 2.71655 13.5771C2.66841 12.9879 2.6687 12.2555 2.6687 11.333ZM13.4646 3.11328C14.4201 2.334 15.8288 2.38969 16.7195 3.28027L16.8865 3.46485C17.6141 4.35685 17.6143 5.64423 16.8865 6.53613L16.7195 6.7207L11.6726 11.7686C11.1373 12.3039 10.4624 12.6746 9.72827 12.8408L9.41089 12.8994L7.59351 13.1582C7.38637 13.1877 7.17701 13.1187 7.02905 12.9707C6.88112 12.8227 6.81199 12.6134 6.84155 12.4063L7.10132 10.5898L7.15991 10.2715C7.3262 9.53749 7.69692 8.86241 8.23218 8.32715L13.2791 3.28027L13.4646 3.11328ZM15.7791 4.2207C15.3753 3.81702 14.7366 3.79124 14.3035 4.14453L14.2195 4.2207L9.17261 9.26856C8.81541 9.62578 8.56774 10.0756 8.45679 10.5654L8.41772 10.7773L8.28296 11.7158L9.22241 11.582L9.43433 11.543C9.92426 11.432 10.3749 11.1844 10.7322 10.8271L15.7791 5.78027L15.8552 5.69629C16.185 5.29194 16.1852 4.708 15.8552 4.30371L15.7791 4.2207Z"></path>
              </svg>
              <span>New Chat</span>
            </button>
          </div>

        <div className="flex-1 overflow-y-auto overflow-x-visible px-2 py-2">
          {sortedConversations.length === 0 && hasLoadedInitialData.current ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-4 animate-in fade-in duration-500">
              <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="mb-3 opacity-20">
                <path d="M16.835 9.99968C16.8348 6.49038 13.8111 3.58171 10 3.58171C6.18893 3.58171 3.16523 6.49038 3.16504 9.99968C3.16504 11.4535 3.67943 12.7965 4.55273 13.8766C4.67524 14.0281 4.72534 14.2262 4.68945 14.4176C4.59391 14.9254 4.45927 15.4197 4.30469 15.904C4.93198 15.8203 5.5368 15.6959 6.12793 15.528L6.25391 15.5055C6.38088 15.4949 6.5091 15.5208 6.62305 15.5817C7.61731 16.1135 8.76917 16.4186 10 16.4186C13.8112 16.4186 16.835 13.5091 16.835 9.99968ZM18.165 9.99968C18.165 14.3143 14.4731 17.7487 10 17.7487C8.64395 17.7487 7.36288 17.4332 6.23438 16.8757C5.31485 17.118 4.36919 17.2694 3.37402 17.3307C3.14827 17.3446 2.93067 17.2426 2.79688 17.0602C2.66303 16.8778 2.63177 16.6396 2.71289 16.4284L2.91992 15.863C3.08238 15.3953 3.21908 14.9297 3.32227 14.4606C2.38719 13.2019 1.83496 11.6626 1.83496 9.99968C1.83515 5.68525 5.52703 2.25163 10 2.25163C14.473 2.25163 18.1649 5.68525 18.165 9.99968Z"></path>
              </svg>
              <p className="text-sm font-medium mb-1">No chats yet</p>
              <p className="text-xs opacity-70">Start a new conversation</p>
            </div>
          ) : (
            <>
              {/* Pinned Section */}
              {sortedConversations.some(c => c.pinned) && (
                <div className="mb-4">
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                    Pinned
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {sortedConversations.filter(c => c.pinned).map(conv => (
                      <SwipeableChatItem
                        key={conv.id}
                        conv={conv}
                        swipedChatId={swipedChatId}
                        setSwipedChatId={setSwipedChatId}
                        setDeleteConfirm={setDeleteConfirm}
                        activeConversationId={activeConversationId}
                        setActiveConversationId={setActiveConversationId}
                        editingConvId={editingConvId}
                        editingName={editingName}
                        setEditingName={setEditingName}
                        handleSaveConversationName={handleSaveConversationName}
                        handleCancelEditing={handleCancelEditing}
                        handleTogglePinChat={handleTogglePinChat}
                        handleStartEditingConversation={handleStartEditingConversation}
                        getLastMessagePreview={getLastMessagePreview}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Unpinned Section */}
              {sortedConversations.some(c => !c.pinned) && (
                <div>
                  {sortedConversations.some(c => c.pinned) && (
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                      Recent
                    </div>
                  )}
                  <div className="space-y-0.5 mt-1">
                    {sortedConversations.filter(c => !c.pinned).map(conv => (
                      <SwipeableChatItem
                        key={conv.id}
                        conv={conv}
                      swipedChatId={swipedChatId}
                      setSwipedChatId={setSwipedChatId}
                      setDeleteConfirm={setDeleteConfirm}
                      activeConversationId={activeConversationId}
                      setActiveConversationId={setActiveConversationId}
                      editingConvId={editingConvId}
                      editingName={editingName}
                      setEditingName={setEditingName}
                      handleSaveConversationName={handleSaveConversationName}
                      handleCancelEditing={handleCancelEditing}
                      handleTogglePinChat={handleTogglePinChat}
                      handleStartEditingConversation={handleStartEditingConversation}
                      getLastMessagePreview={getLastMessagePreview}
                    />
                  ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      )}

      {/* Compact Menu - Shown when sidebar is hidden */}
      {!showSidebar && (
        <div className="w-12 border-r border-border/40 bg-background flex-col hidden lg:flex">
          <div className="flex flex-col items-center py-3">
            {/* Show Sidebar Button */}
            <div className="pb-3">
              <button
                onClick={() => setShowSidebar(true)}
                className="p-2.5 hover:bg-muted rounded-lg transition-colors"
                aria-label="Show sidebar"
                title="Show sidebar (Ctrl+B)"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground/70">
                  <path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z"></path>
                </svg>
              </button>
            </div>

            <div className="flex flex-col items-center gap-1.5 py-3">
              {/* Search Button */}
              <button
                onClick={() => setShowSearch(true)}
                className="p-2.5 hover:bg-muted rounded-lg transition-colors"
                aria-label="Search chats"
                title="Search chats (Ctrl+K)"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground/70">
                  <path d="M14.0857 8.74999C14.0857 5.80355 11.6972 3.41503 8.75073 3.41503C5.80429 3.41503 3.41577 5.80355 3.41577 8.74999C3.41577 11.6964 5.80429 14.085 8.75073 14.085C11.6972 14.085 14.0857 11.6964 14.0857 8.74999ZM15.4158 8.74999C15.4158 10.3539 14.848 11.8245 13.9041 12.9746L13.9705 13.0303L16.9705 16.0303L17.0564 16.1338C17.2269 16.3919 17.1977 16.7434 16.9705 16.9707C16.7432 17.1975 16.3925 17.226 16.1345 17.0557L16.03 16.9707L13.03 13.9707L12.9753 13.9033C11.8253 14.8472 10.3547 15.415 8.75073 15.415C5.06975 15.415 2.08569 12.431 2.08569 8.74999C2.08569 5.06901 5.06975 2.08495 8.75073 2.08495C12.4317 2.08495 15.4158 5.06901 15.4158 8.74999Z"></path>
                </svg>
              </button>

              {/* New Chat Button */}
              <button
                onClick={handleNewConversation}
                className="p-2.5 hover:bg-muted rounded-lg transition-colors"
                aria-label="New chat"
                title="New chat"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground/70">
                  <path d="M2.6687 11.333V8.66699C2.6687 7.74455 2.66841 7.01205 2.71655 6.42285C2.76533 5.82612 2.86699 5.31731 3.10425 4.85156L3.25854 4.57617C3.64272 3.94975 4.19392 3.43995 4.85229 3.10449L5.02905 3.02149C5.44666 2.84233 5.90133 2.75849 6.42358 2.71582C7.01272 2.66769 7.74445 2.66797 8.66675 2.66797H9.16675C9.53393 2.66797 9.83165 2.96586 9.83179 3.33301C9.83179 3.70028 9.53402 3.99805 9.16675 3.99805H8.66675C7.7226 3.99805 7.05438 3.99834 6.53198 4.04102C6.14611 4.07254 5.87277 4.12568 5.65601 4.20313L5.45581 4.28906C5.01645 4.51293 4.64872 4.85345 4.39233 5.27149L4.28979 5.45508C4.16388 5.7022 4.08381 6.01663 4.04175 6.53125C3.99906 7.05373 3.99878 7.7226 3.99878 8.66699V11.333C3.99878 12.2774 3.99906 12.9463 4.04175 13.4688C4.08381 13.9833 4.16389 14.2978 4.28979 14.5449L4.39233 14.7285C4.64871 15.1465 5.01648 15.4871 5.45581 15.7109L5.65601 15.7969C5.87276 15.8743 6.14614 15.9265 6.53198 15.958C7.05439 16.0007 7.72256 16.002 8.66675 16.002H11.3337C12.2779 16.002 12.9461 16.0007 13.4685 15.958C13.9829 15.916 14.2976 15.8367 14.5447 15.7109L14.7292 15.6074C15.147 15.3511 15.4879 14.9841 15.7117 14.5449L15.7976 14.3447C15.8751 14.128 15.9272 13.8546 15.9587 13.4688C16.0014 12.9463 16.0017 12.2774 16.0017 11.333V10.833C16.0018 10.466 16.2997 10.1681 16.6667 10.168C17.0339 10.168 17.3316 10.4659 17.3318 10.833V11.333C17.3318 12.2555 17.3331 12.9879 17.2849 13.5771C17.2422 14.0993 17.1584 14.5541 16.9792 14.9717L16.8962 15.1484C16.5609 15.8066 16.0507 16.3571 15.4246 16.7412L15.1492 16.8955C14.6833 17.1329 14.1739 17.2354 13.5769 17.2842C12.9878 17.3323 12.256 17.332 11.3337 17.332H8.66675C7.74446 17.332 7.01271 17.3323 6.42358 17.2842C5.90135 17.2415 5.44665 17.1577 5.02905 16.9785L4.85229 16.8955C4.19396 16.5601 3.64271 16.0502 3.25854 15.4238L3.10425 15.1484C2.86697 14.6827 2.76534 14.1739 2.71655 13.5771C2.66841 12.9879 2.6687 12.2555 2.6687 11.333ZM13.4646 3.11328C14.4201 2.334 15.8288 2.38969 16.7195 3.28027L16.8865 3.46485C17.6141 4.35685 17.6143 5.64423 16.8865 6.53613L16.7195 6.7207L11.6726 11.7686C11.1373 12.3039 10.4624 12.6746 9.72827 12.8408L9.41089 12.8994L7.59351 13.1582C7.38637 13.1877 7.17701 13.1187 7.02905 12.9707C6.88112 12.8227 6.81199 12.6134 6.84155 12.4063L7.10132 10.5898L7.15991 10.2715C7.3262 9.53749 7.69692 8.86241 8.23218 8.32715L13.2791 3.28027L13.4646 3.11328ZM15.7791 4.2207C15.3753 3.81702 14.7366 3.79124 14.3035 4.14453L14.2195 4.2207L9.17261 9.26856C8.81541 9.62578 8.56774 10.0756 8.45679 10.5654L8.41772 10.7773L8.28296 11.7158L9.22241 11.582L9.43433 11.543C9.92426 11.432 10.3749 11.1844 10.7322 10.8271L15.7791 5.78027L15.8552 5.69629C16.185 5.29194 16.1852 4.708 15.8552 4.30371L15.7791 4.2207Z"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-dvh relative">
        <div className="absolute top-0 left-0 right-0 z-[60]">
          <ChatHeader
            conversationName={activeConversation?.name}
            onShowMobileSidebar={() => setShowMobileSidebar(!showMobileSidebar)}
            onShowSidebar={() => setShowSidebar(true)}
            showSidebar={showSidebar}
            hasMessages={activeConversation && activeConversation.messages.length > 0}
            onRename={activeConversation ? () => handleStartEditingConversation(activeConversation.id, activeConversation.name || 'New Chat') : undefined}
            onDelete={activeConversation ? () => setDeleteConfirm({ type: 'chat', id: activeConversation.id, name: activeConversation.name || 'New Chat' }) : undefined}
            onNewChat={handleNewConversation}
          />
        </div>

        <ScrollArea
          ref={scrollAreaRef}
          className="h-full flex flex-col"
          isMobile={isMobileView}
          withVerticalMargins
          mobileHeaderHeight={isMobileView}
          bottomMargin="calc(var(--dynamic-height, 64px))"
          disableSmoothScroll={switchedChat}
        >
          <div
            className={cn(
              "min-h-screen flex flex-col",
              isMobileView ? "pt-24" : "pt-16",
              // Add extra padding when knowledge is selected to prevent overlap
              selectedKnowledge.length > 0
                ? "pb-40 sm:pb-32"
                : "pb-32 sm:pb-24"
            )}
          >
            <div className="flex-1 flex flex-col relative">
              <div className="relative h-full flex">
                <div className="w-3 bg-background" />
                <MessageList
                  messages={activeConversation?.messages || []}
                  isTyping={isTyping}
                  isMobileView={isMobileView}
                  // Suppress the first-frame animation right after switching chats
                  animateLatest={!switchedChat}
                />
                <div className="w-3 bg-background" />
              </div>
              <div className="bg-background flex-1" />
            </div>
          </div>
        </ScrollArea>

        <div className="absolute bottom-0 left-0 right-0 z-[60] mb-[env(keyboard-inset-height,0px)] bg-background">
          <MessageInput
            onSendMessage={handleSendMessage}
            message={messageDraft}
            setMessage={setMessageDraft}
            isMobileView={isMobileView}
            knowledgeBases={knowledgeBases.map(kb => ({
              id: kb.id,
              name: kb.name,
              content: kb.content || '',
              createdAt: kb.createdAt || kb.uploadedAt || new Date().toISOString(),
            }))}
            selectedKnowledge={selectedKnowledge}
            onToggleKnowledge={handleToggleKnowledge}
          />
        </div>
      </div>

      {/* Knowledge Panel - Desktop (Overlay instead of fixed width) */}
      {showKnowledgePanel && !isMobile && (
        <>
          <div
            className="fixed top-16 right-0 bottom-0 w-96 border-l border-border/40 bg-background flex-col flex z-50 shadow-2xl animate-in slide-in-from-right duration-300"
            data-knowledge-panel="true"
          >
          <div className="p-4 flex items-center justify-between">
            <h2 className="font-semibold">Knowledge Base</h2>
            {/* Close button intentionally removed on desktop; toggle via toolbar icon or click outside */}
            <div />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {knowledgeBases.filter(kb => kb && kb.id).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12 animate-in fade-in duration-500">
                <svg width="64" height="64" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="mb-4 opacity-20">
                  <path d="M2.66867 14.1665V8.98677C2.23313 8.72481 1.8817 8.32262 1.69113 7.82075L1.61691 7.59419L1.45578 6.99067C1.12249 5.74681 1.86036 4.46753 3.10422 4.13423L13.9714 1.2231L14.2048 1.17329C15.3713 0.984508 16.5144 1.70556 16.8269 2.87153L16.988 3.47505L17.0388 3.70845C17.2153 4.79724 16.5981 5.86547 15.5671 6.25728L15.3396 6.33149L4.47336 9.24263C4.31482 9.28511 4.15541 9.30996 3.99777 9.3188V14.1665C3.99777 15.1799 4.82027 16.0014 5.83371 16.0014H14.1667C15.1801 16.0013 16.0017 15.1799 16.0017 14.1665V8.33345C16.0017 7.96618 16.2994 7.66841 16.6667 7.66841C17.0339 7.66848 17.3318 7.96622 17.3318 8.33345V14.1665C17.3318 15.9144 15.9146 17.3314 14.1667 17.3315H5.83371C4.08573 17.3315 2.66867 15.9144 2.66867 14.1665ZM11.6667 10.1684L11.8005 10.1821C12.1036 10.2441 12.3318 10.5121 12.3318 10.8334C12.3317 11.1548 12.1035 11.4228 11.8005 11.4848L11.6667 11.4985H8.33371C7.96648 11.4985 7.66873 11.2007 7.66867 10.8334C7.66867 10.4662 7.96644 10.1684 8.33371 10.1684H11.6667ZM15.5417 3.21626C15.4075 2.71539 14.9168 2.40477 14.4157 2.48579L14.3152 2.50727L3.44895 5.41938C2.91466 5.56254 2.59693 6.11166 2.73996 6.64595L2.90207 7.24946L2.93332 7.34712C3.11346 7.82184 3.62765 8.09253 4.12863 7.95845L14.9958 5.04634L15.0935 5.01509C15.5364 4.84669 15.8013 4.3872 15.7253 3.91938L15.7038 3.81977L15.5417 3.21626Z"></path>
                </svg>
                <p className="text-sm font-medium mb-1">No documents available</p>
                <p className="text-xs opacity-70">Training documents will appear here</p>
              </div>
            ) : (
              knowledgeBases.filter(kb => kb && kb.id).map(kb => (
                <div
                  key={kb.id}
                  className={cn(
                    "group relative rounded-xl transition-all duration-200",
                    editingDocId === kb.id
                      ? "bg-gray-50 dark:bg-white/5"
                      : selectedKnowledge.includes(kb.id)
                      ? "bg-blue-50/30 dark:bg-blue-500/5"
                      : "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                  )}
                >
                  {editingDocId === kb.id ? (
                    <div className="p-3 space-y-2">
                      <input
                        type="text"
                        value={editingDocName}
                        onChange={(e) => setEditingDocName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveDocName();
                          if (e.key === 'Escape') handleCancelDocEditing();
                        }}
                        onBlur={handleSaveDocName}
                        autoFocus
                        className="w-full px-2 py-1.5 text-sm font-medium bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        Press Enter to save, Esc to cancel
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 p-3 relative">
                        <div
                          onClick={() => handleToggleKnowledge(kb.id)}
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                        >
                          <svg className="h-4 w-4 text-gray-400 dark:text-gray-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" clipRule="evenodd" d="M11.2598 2.25191C11.8396 2.25191 12.2381 2.24808 12.6201 2.33981L12.8594 2.40719C13.0957 2.48399 13.3228 2.5886 13.5352 2.71871L13.6582 2.79879C13.9416 2.99641 14.1998 3.25938 14.5586 3.61813L15.5488 4.60836L15.833 4.89449C16.0955 5.16136 16.2943 5.38072 16.4482 5.6318L16.5703 5.84957C16.6829 6.07074 16.7691 6.30495 16.8271 6.54684L16.8574 6.69137C16.918 7.0314 16.915 7.39998 16.915 7.90719V13.0839C16.915 13.7728 16.9157 14.3301 16.8789 14.7802C16.8461 15.1808 16.781 15.5417 16.6367 15.8779L16.5703 16.0205C16.3049 16.5413 15.9008 16.9772 15.4053 17.2812L15.1865 17.4033C14.8099 17.5951 14.4041 17.6745 13.9463 17.7119C13.4961 17.7487 12.9391 17.749 12.25 17.749H7.75C7.06092 17.749 6.50395 17.7487 6.05371 17.7119C5.65317 17.6791 5.29227 17.6148 4.95606 17.4707L4.81348 17.4033C4.29235 17.1378 3.85586 16.7341 3.55176 16.2382L3.42969 16.0205C3.23787 15.6439 3.15854 15.2379 3.12109 14.7802C3.08432 14.3301 3.08496 13.7728 3.08496 13.0839V6.91695C3.08496 6.228 3.08433 5.67086 3.12109 5.22066C3.1585 4.76296 3.23797 4.35698 3.42969 3.98043C3.73311 3.38494 4.218 2.90008 4.81348 2.59664C5.19009 2.40484 5.59593 2.32546 6.05371 2.28805C6.50395 2.25126 7.06091 2.25191 7.75 2.25191H11.2598ZM7.75 3.58199C7.03896 3.58199 6.54563 3.58288 6.16211 3.61422C5.78642 3.64492 5.575 3.70168 5.41699 3.78219C5.0718 3.95811 4.79114 4.23874 4.61524 4.58395C4.53479 4.74193 4.47795 4.95354 4.44727 5.32906C4.41595 5.71254 4.41504 6.20609 4.41504 6.91695V13.0839C4.41504 13.7947 4.41594 14.2884 4.44727 14.6718C4.47798 15.0472 4.53477 15.259 4.61524 15.417L4.68555 15.5429C4.86186 15.8304 5.11487 16.0648 5.41699 16.2187L5.54688 16.2744C5.69065 16.3258 5.88016 16.3636 6.16211 16.3867C6.54563 16.418 7.03898 16.4189 7.75 16.4189H12.25C12.961 16.4189 13.4544 16.418 13.8379 16.3867C14.2135 16.356 14.425 16.2992 14.583 16.2187L14.709 16.1474C14.9963 15.9712 15.2308 15.7189 15.3848 15.417L15.4414 15.2861C15.4927 15.1425 15.5297 14.953 15.5527 14.6718C15.5841 14.2884 15.585 13.7947 15.585 13.0839V8.55758L13.3506 8.30953C12.2572 8.18804 11.3976 7.31827 11.2881 6.22359L11.0234 3.58199H7.75ZM12.6113 6.09176C12.6584 6.56193 13.0275 6.93498 13.4971 6.98727L15.5762 7.21871C15.5727 7.13752 15.5686 7.07109 15.5615 7.01266L15.5342 6.85738C15.5005 6.7171 15.4501 6.58135 15.3848 6.45309L15.3145 6.32711C15.2625 6.24233 15.1995 6.16135 15.0928 6.04488L14.6084 5.54879L13.6182 4.55856C13.2769 4.21733 13.1049 4.04904 12.9688 3.94234L12.8398 3.8525C12.7167 3.77705 12.5853 3.71637 12.4482 3.67184L12.3672 3.6484L12.6113 6.09176Z"></path>
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-gray-700 dark:text-gray-200 truncate leading-tight">{kb.name}</p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                              {kb.uploadedAt ? new Date(kb.uploadedAt).toLocaleDateString() : 'Recently'}
                            </p>
                          </div>
                          {selectedKnowledge.includes(kb.id) && (
                            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-500">
                              <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        {/* 3-dot menu - outside clickable area */}
                        <div className="relative shrink-0" data-menu-id={kb.id}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('Desktop menu clicked for:', kb.id, kb.name);
                              setMobileMenuDocId(mobileMenuDocId === kb.id ? null : kb.id);
                            }}
                            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-opacity"
                            aria-label="Document options"
                          >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="text-gray-600 dark:text-gray-400">
                              <path d="M15.498 8.50159C16.3254 8.50159 16.9959 9.17228 16.9961 9.99963C16.9961 10.8271 16.3256 11.4987 15.498 11.4987C14.6705 11.4987 14 10.8271 14 9.99963C14.0002 9.17228 14.6706 8.50159 15.498 8.50159Z"></path>
                              <path d="M4.49805 8.50159C5.32544 8.50159 5.99689 9.17228 5.99707 9.99963C5.99707 10.8271 5.32555 11.4987 4.49805 11.4987C3.67069 11.4985 3 10.827 3 9.99963C3.00018 9.17239 3.6708 8.50176 4.49805 8.50159Z"></path>
                              <path d="M10.0003 8.50159C10.8276 8.50176 11.4982 9.17239 11.4984 9.99963C11.4984 10.827 10.8277 11.4985 10.0003 11.4987C9.17283 11.4987 8.50131 10.8271 8.50131 9.99963C8.50149 9.17228 9.17294 8.50159 10.0003 8.50159Z"></path>
                            </svg>
                          </button>

                          {/* Dropdown menu */}
                          {mobileMenuDocId === kb.id && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-background border border-border rounded-lg shadow-lg py-1 z-[110]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditingDoc(kb.id, kb.name);
                                  setMobileMenuDocId(null);
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
                                  setDeleteConfirm({ type: 'doc', id: kb.id, name: kb.name });
                                  setMobileMenuDocId(null);
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
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        </>
      )}

      {/* Knowledge Panel - Mobile Modal */}
      {showKnowledgePanel && isMobile && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[70]"
            onClick={() => setShowKnowledgePanel(false)}
          />
          <div className="fixed inset-x-0 bottom-0 bg-background rounded-t-2xl z-[70] max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl">
            {/* Pull indicator */}
            <div className="pt-2 pb-1 flex justify-center">
              <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
            </div>
            <div className="p-4 border-b border-border/40 flex items-center justify-between">
              <h2 className="font-semibold text-lg">Knowledge Base</h2>
              <button
                onClick={() => setShowKnowledgePanel(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {knowledgeBases.filter(kb => kb && kb.id).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12 animate-in fade-in duration-500">
                  <svg width="64" height="64" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="mb-4 opacity-20">
                    <path d="M2.66867 14.1665V8.98677C2.23313 8.72481 1.8817 8.32262 1.69113 7.82075L1.61691 7.59419L1.45578 6.99067C1.12249 5.74681 1.86036 4.46753 3.10422 4.13423L13.9714 1.2231L14.2048 1.17329C15.3713 0.984508 16.5144 1.70556 16.8269 2.87153L16.988 3.47505L17.0388 3.70845C17.2153 4.79724 16.5981 5.86547 15.5671 6.25728L15.3396 6.33149L4.47336 9.24263C4.31482 9.28511 4.15541 9.30996 3.99777 9.3188V14.1665C3.99777 15.1799 4.82027 16.0014 5.83371 16.0014H14.1667C15.1801 16.0013 16.0017 15.1799 16.0017 14.1665V8.33345C16.0017 7.96618 16.2994 7.66841 16.6667 7.66841C17.0339 7.66848 17.3318 7.96622 17.3318 8.33345V14.1665C17.3318 15.9144 15.9146 17.3314 14.1667 17.3315H5.83371C4.08573 17.3315 2.66867 15.9144 2.66867 14.1665ZM11.6667 10.1684L11.8005 10.1821C12.1036 10.2441 12.3318 10.5121 12.3318 10.8334C12.3317 11.1548 12.1035 11.4228 11.8005 11.4848L11.6667 11.4985H8.33371C7.96648 11.4985 7.66873 11.2007 7.66867 10.8334C7.66867 10.4662 7.96644 10.1684 8.33371 10.1684H11.6667ZM15.5417 3.21626C15.4075 2.71539 14.9168 2.40477 14.4157 2.48579L14.3152 2.50727L3.44895 5.41938C2.91466 5.56254 2.59693 6.11166 2.73996 6.64595L2.90207 7.24946L2.93332 7.34712C3.11346 7.82184 3.62765 8.09253 4.12863 7.95845L14.9958 5.04634L15.0935 5.01509C15.5364 4.84669 15.8013 4.3872 15.7253 3.91938L15.7038 3.81977L15.5417 3.21626Z"></path>
                  </svg>
                  <p className="text-sm font-medium mb-1">No documents available</p>
                  <p className="text-xs opacity-70">Training documents will appear here</p>
                </div>
              ) : (
                knowledgeBases.filter(kb => kb && kb.id).map(kb => (
                  <div
                    key={kb.id}
                    className={cn(
                      "rounded-xl transition-all duration-200",
                      editingDocId === kb.id
                        ? "bg-gray-50 dark:bg-white/5"
                        : selectedKnowledge.includes(kb.id)
                        ? "bg-blue-50/30 dark:bg-blue-500/5"
                        : "active:bg-gray-50 dark:active:bg-white/[0.03]"
                    )}
                  >
                    {editingDocId === kb.id ? (
                      <div className="p-4 space-y-3">
                        <input
                          type="text"
                          value={editingDocName}
                          onChange={(e) => setEditingDocName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveDocName();
                            if (e.key === 'Escape') handleCancelDocEditing();
                          }}
                          autoFocus
                          className="w-full px-3 py-2.5 text-base font-medium bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Document name"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveDocName();
                            }}
                            className="flex-1 px-4 py-2.5 text-sm font-medium bg-blue-500 text-white rounded-xl active:scale-95 transition-transform"
                          >
                            Save
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelDocEditing();
                            }}
                            className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-gray-100 rounded-xl active:scale-95 transition-transform"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 p-4 relative">
                          <div
                            onClick={() => editingDocId !== kb.id && handleToggleKnowledge(kb.id)}
                            className="flex items-center gap-3 flex-1 cursor-pointer"
                          >
                            <svg className="h-5 w-5 text-gray-400 dark:text-gray-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" clipRule="evenodd" d="M11.2598 2.25191C11.8396 2.25191 12.2381 2.24808 12.6201 2.33981L12.8594 2.40719C13.0957 2.48399 13.3228 2.5886 13.5352 2.71871L13.6582 2.79879C13.9416 2.99641 14.1998 3.25938 14.5586 3.61813L15.5488 4.60836L15.833 4.89449C16.0955 5.16136 16.2943 5.38072 16.4482 5.6318L16.5703 5.84957C16.6829 6.07074 16.7691 6.30495 16.8271 6.54684L16.8574 6.69137C16.918 7.0314 16.915 7.39998 16.915 7.90719V13.0839C16.915 13.7728 16.9157 14.3301 16.8789 14.7802C16.8461 15.1808 16.781 15.5417 16.6367 15.8779L16.5703 16.0205C16.3049 16.5413 15.9008 16.9772 15.4053 17.2812L15.1865 17.4033C14.8099 17.5951 14.4041 17.6745 13.9463 17.7119C13.4961 17.7487 12.9391 17.749 12.25 17.749H7.75C7.06092 17.749 6.50395 17.7487 6.05371 17.7119C5.65317 17.6791 5.29227 17.6148 4.95606 17.4707L4.81348 17.4033C4.29235 17.1378 3.85586 16.7341 3.55176 16.2382L3.42969 16.0205C3.23787 15.6439 3.15854 15.2379 3.12109 14.7802C3.08432 14.3301 3.08496 13.7728 3.08496 13.0839V6.91695C3.08496 6.228 3.08433 5.67086 3.12109 5.22066C3.1585 4.76296 3.23797 4.35698 3.42969 3.98043C3.73311 3.38494 4.218 2.90008 4.81348 2.59664C5.19009 2.40484 5.59593 2.32546 6.05371 2.28805C6.50395 2.25126 7.06091 2.25191 7.75 2.25191H11.2598ZM7.75 3.58199C7.03896 3.58199 6.54563 3.58288 6.16211 3.61422C5.78642 3.64492 5.575 3.70168 5.41699 3.78219C5.0718 3.95811 4.79114 4.23874 4.61524 4.58395C4.53479 4.74193 4.47795 4.95354 4.44727 5.32906C4.41595 5.71254 4.41504 6.20609 4.41504 6.91695V13.0839C4.41504 13.7947 4.41594 14.2884 4.44727 14.6718C4.47798 15.0472 4.53477 15.259 4.61524 15.417L4.68555 15.5429C4.86186 15.8304 5.11487 16.0648 5.41699 16.2187L5.54688 16.2744C5.69065 16.3258 5.88016 16.3636 6.16211 16.3867C6.54563 16.418 7.03898 16.4189 7.75 16.4189H12.25C12.961 16.4189 13.4544 16.418 13.8379 16.3867C14.2135 16.356 14.425 16.2992 14.583 16.2187L14.709 16.1474C14.9963 15.9712 15.2308 15.7189 15.3848 15.417L15.4414 15.2861C15.4927 15.1425 15.5297 14.953 15.5527 14.6718C15.5841 14.2884 15.585 13.7947 15.585 13.0839V8.55758L13.3506 8.30953C12.2572 8.18804 11.3976 7.31827 11.2881 6.22359L11.0234 3.58199H7.75ZM12.6113 6.09176C12.6584 6.56193 13.0275 6.93498 13.4971 6.98727L15.5762 7.21871C15.5727 7.13752 15.5686 7.07109 15.5615 7.01266L15.5342 6.85738C15.5005 6.7171 15.4501 6.58135 15.3848 6.45309L15.3145 6.32711C15.2625 6.24233 15.1995 6.16135 15.0928 6.04488L14.6084 5.54879L13.6182 4.55856C13.2769 4.21733 13.1049 4.04904 12.9688 3.94234L12.8398 3.8525C12.7167 3.77705 12.5853 3.71637 12.4482 3.67184L12.3672 3.6484L12.6113 6.09176Z"></path>
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-[15px] font-medium text-gray-700 dark:text-gray-200 truncate leading-tight">{kb.name}</p>
                              <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1">
                                {kb.uploadedAt ? new Date(kb.uploadedAt).toLocaleDateString() : 'Recently'}
                              </p>
                            </div>
                            {selectedKnowledge.includes(kb.id) && (
                              <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500">
                                <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                          {/* 3-dot menu - outside clickable area */}
                          <div className="relative shrink-0" data-menu-id={kb.id}>
                            <button
                              id={`doc-menu-button-${kb.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setMobileMenuDocId(mobileMenuDocId === kb.id ? null : kb.id);
                              }}
                              className="p-2 rounded-md hover:bg-muted active:bg-muted"
                              aria-label="Document options"
                            >
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground/70">
                                <path d="M15.498 8.50159C16.3254 8.50159 16.9959 9.17228 16.9961 9.99963C16.9961 10.8271 16.3256 11.4987 15.498 11.4987C14.6705 11.4987 14 10.8271 14 9.99963C14.0002 9.17228 14.6706 8.50159 15.498 8.50159Z"></path>
                                <path d="M4.49805 8.50159C5.32544 8.50159 5.99689 9.17228 5.99707 9.99963C5.99707 10.8271 5.32555 11.4987 4.49805 11.4987C3.67069 11.4985 3 10.827 3 9.99963C3.00018 9.17239 3.6708 8.50176 4.49805 8.50159Z"></path>
                                <path d="M10.0003 8.50159C10.8276 8.50176 11.4982 9.17239 11.4984 9.99963C11.4984 10.827 10.8277 11.4985 10.0003 11.4987C9.17283 11.4987 8.50131 10.8271 8.50131 9.99963C8.50149 9.17228 9.17294 8.50159 10.0003 8.50159Z"></path>
                              </svg>
                            </button>

                            {mobileMenuDocId === kb.id && (() => {
                              const button = document.getElementById(`doc-menu-button-${kb.id}`);
                              const rect = button?.getBoundingClientRect();
                              const vpH = typeof window !== 'undefined' ? window.innerHeight : 0;
                              const vpW = typeof window !== 'undefined' ? window.innerWidth : 0;
                              const menuW = 160; // px
                              const margin = 8; // px
                              const estimatedMenuH = 112; // px, 2 items + padding; prevents off-screen on short viewports
                              const placeAbove = rect ? rect.bottom + estimatedMenuH + margin > vpH : false;
                              const topPx = rect
                                ? (placeAbove ? rect.top - 4 : rect.bottom + 4)
                                : 0;
                              const leftPx = rect
                                ? Math.min(
                                    Math.max(margin, rect.right - menuW),
                                    Math.max(margin, vpW - menuW - margin)
                                  )
                                : margin;
                              return (
                                <div
                                  className={`fixed w-40 bg-background border border-border rounded-lg shadow-lg py-1 z-[110] ${placeAbove ? '-translate-y-full' : ''}`}
                                  style={{
                                    top: `${topPx}px`,
                                    left: `${leftPx}px`,
                                  }}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEditingDoc(kb.id, kb.name);
                                      setMobileMenuDocId(null);
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
                                      setDeleteConfirm({ type: 'doc', id: kb.id, name: kb.name });
                                      setMobileMenuDocId(null);
                                    }}
                                    className="w-full px-3 py-2 text-sm text-left hover:bg-destructive/10 text-destructive flex items-center gap-2"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

    </div>

      {/* Confirmation Dialog - only render when needed to prevent title flicker */}
      {deleteConfirm && (
        <ConfirmDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setDeleteConfirm(null);
          }}
          title={deleteConfirm.type === 'chat' ? 'Delete Chat?' : 'Delete Document?'}
          description={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
          onConfirm={async () => {
            if (deleteConfirm.type === 'chat') {
              handleDeleteConversation(deleteConfirm.id);
            } else {
              // Delete document from database
              try {
                const response = await fetch(`/api/knowledge/${deleteConfirm.id}`, {
                  method: 'DELETE',
                });

                if (response.ok) {
                  setKnowledgeBases(prev => prev.filter(k => k.id !== deleteConfirm.id));
                  setSelectedKnowledge(prev => prev.filter(id => id !== deleteConfirm.id));
                  toast({ title: 'Document deleted' });
                } else {
                  toast({ title: 'Could not delete document', variant: 'destructive' });
                }
              } catch (error) {
                console.error('Error deleting document:', error);
                toast({ title: 'Could not delete document', variant: 'destructive' });
              }
            }
            setDeleteConfirm(null);
          }}
          confirmText="Delete"
          variant="destructive"
        />
      )}
    </>
  );
}

