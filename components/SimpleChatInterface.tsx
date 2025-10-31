"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

interface SimpleChatInterfaceProps {
  chatId: string;
}

export function SimpleChatInterface({ chatId }: SimpleChatInterfaceProps) {
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
  const [swipedChatId, setSwipedChatId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const hasLoadedInitialData = useRef(false); // Track if we've loaded data to prevent blinking

  const { toast } = useToast();

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

  // Filter messages based on search query
  const filteredMessages = activeConversation?.messages.filter(msg =>
    searchQuery.trim() === '' || msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

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
      // Cmd/Ctrl + K for knowledge panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowKnowledgePanel(prev => !prev);
      }
      // Cmd/Ctrl + F for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(prev => !prev);
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

  // No more lazy loading - just update active conversation when chatId changes
  useEffect(() => {
    setActiveConversationId(chatId);

    // Reset knowledge selection for new chats
    if (chatId && !conversations.find(c => c.id === chatId)) {
      setSelectedKnowledge([]);
    }
  }, [chatId, conversations]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current && activeConversation) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        // Use requestAnimationFrame for smooth scrolling
        requestAnimationFrame(() => {
          scrollElement.scrollTo({
            top: scrollElement.scrollHeight,
            behavior: 'smooth'
          });
        });
      }
    }
  }, [activeConversation?.messages.length]);

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

      // Get sources from response headers
      const sourcesHeader = response.headers.get('X-Sources');
      let messageSources: string[] = [];
      if (sourcesHeader) {
        try {
          messageSources = JSON.parse(sourcesHeader);
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

        // Update URL without reload
        router.push(`/chat/${actualChatId}`);
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
    // Create new chat ID and navigate to it
    const newChatId = nanoid();
    router.push(`/chat/${newChatId}`);
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

  return (
    <div className="flex h-dvh bg-background overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <>
          <div
            className="fixed inset-0 bg-black/10 z-40 lg:hidden animate-in fade-in duration-200"
            onClick={() => setShowMobileSidebar(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-background border-r border-border/40 z-50 lg:hidden animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-border/40 flex items-center justify-between">
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
            <div className="p-4 border-b border-border/40">
              <button
                onClick={() => {
                  handleNewConversation();
                  setShowMobileSidebar(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#0A7CFF] text-white hover:bg-[#0A7CFF]/90 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Chat</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {sortedConversations.length === 0 && hasLoadedInitialData.current ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-4 animate-in fade-in duration-500">
                  <svg className="h-12 w-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
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
                              router.push(`/chat/${conv.id}`);
                              setShowMobileSidebar(false);
                            }
                          }}
                          className={cn(
                            "p-3 rounded-lg mb-1 transition-colors cursor-pointer group",
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
                                  <p
                                    className="text-sm font-semibold truncate flex-1 cursor-text"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEditingConversation(conv.id, conv.name || 'New Chat');
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
                                className="flex-shrink-0 p-1 rounded transition-all"
                                title={conv.pinned ? "Unpin" : "Pin"}
                                aria-label={conv.pinned ? "Unpin chat" : "Pin chat"}
                              >
                                <svg
                                  className={cn(
                                    "h-5 w-5 transition-colors",
                                    conv.pinned ? "text-amber-500" : "text-muted-foreground"
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
                              router.push(`/chat/${conv.id}`);
                              setShowMobileSidebar(false);
                            }
                          }}
                          className={cn(
                            "p-3 rounded-lg mb-1 transition-colors cursor-pointer group",
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
                                  <p
                                    className="text-sm font-semibold truncate flex-1 cursor-text"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEditingConversation(conv.id, conv.name || 'New Chat');
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
                                className="flex-shrink-0 p-1 rounded transition-all"
                                title={conv.pinned ? "Unpin" : "Pin"}
                                aria-label={conv.pinned ? "Unpin chat" : "Pin chat"}
                              >
                                <svg
                                  className={cn(
                                    "h-5 w-5 transition-colors",
                                    conv.pinned ? "text-amber-500" : "text-muted-foreground"
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
      <div className="w-64 border-r border-border/40 bg-background flex-col hidden lg:flex">
        <div className="p-4 border-b border-border/40">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#0A7CFF] text-white hover:bg-[#0A7CFF]/90 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sortedConversations.length === 0 && hasLoadedInitialData.current ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-4 animate-in fade-in duration-500">
              <svg className="h-12 w-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
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
                    <SwipeableChatItem
                      key={conv.id}
                      conv={conv}
                      swipedChatId={swipedChatId}
                      setSwipedChatId={setSwipedChatId}
                      setDeleteConfirm={setDeleteConfirm}
                      activeConversationId={activeConversationId}
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
                    <SwipeableChatItem
                      key={conv.id}
                      conv={conv}
                      swipedChatId={swipedChatId}
                      setSwipedChatId={setSwipedChatId}
                      setDeleteConfirm={setDeleteConfirm}
                      activeConversationId={activeConversationId}
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
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-dvh relative">
        <div className="absolute top-0 left-0 right-0 z-[60]">
          <ChatHeader
            onShowKnowledge={() => setShowKnowledgePanel(!showKnowledgePanel)}
            conversationName={activeConversation?.name}
            onShowMobileSidebar={() => setShowMobileSidebar(!showMobileSidebar)}
            onShowSearch={() => setShowSearch(!showSearch)}
          />
        </div>

        {/* Search Bar - Below header, compact version */}
        {showSearch && (
          <div className="absolute top-16 left-0 right-0 z-[55] px-4 py-2">
            <div className="max-w-2xl mx-auto relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in messages..."
                className="w-full bg-background border border-border rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A7CFF] shadow-lg"
                autoFocus
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close search"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {searchQuery && (
                <div className="absolute -bottom-6 right-0 text-xs text-muted-foreground">
                  {filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        )}

        <ScrollArea
          ref={scrollAreaRef}
          className="h-full flex flex-col"
          isMobile={isMobileView}
          withVerticalMargins
          mobileHeaderHeight={isMobileView}
          bottomMargin="calc(var(--dynamic-height, 64px))"
        >
          <div
            className={cn(
              "min-h-screen flex flex-col",
              isMobileView ? "pt-24" : "pt-16",
              // Add extra padding when search is active
              showSearch && "pt-28",
              // Add extra padding when knowledge is selected to prevent overlap
              selectedKnowledge.length > 0
                ? "pb-40 sm:pb-32"
                : "pb-32 sm:pb-24"
            )}
          >
            <div className="flex-1 flex flex-col relative">
              <div className="relative h-full flex">
                <div className="w-3 bg-background" />
                {searchQuery ? (
                  <>
                    <MessageList
                      messages={filteredMessages}
                      isTyping={false}
                      isMobileView={isMobileView}
                    />
                    {filteredMessages.length === 0 && (
                      <div className="flex-1 flex items-center justify-center text-center text-muted-foreground py-12">
                        <div>
                          <svg className="h-12 w-12 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <p className="text-sm font-medium">No messages found</p>
                          <p className="text-xs opacity-70 mt-1">Try a different search term</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <MessageList
                    messages={activeConversation?.messages || []}
                    isTyping={isTyping}
                    isMobileView={isMobileView}
                  />
                )}
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
          <div className="fixed top-16 right-0 bottom-0 w-96 border-l border-border/40 bg-background flex-col flex z-50 shadow-2xl animate-in slide-in-from-right duration-300">
          <div className="p-4 border-b border-border/40 flex items-center justify-between">
            <h2 className="font-semibold">Knowledge Base</h2>
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

          <div className="p-4 border-b border-border/40">
            <input
              type="file"
              accept=".pdf,.txt,.md"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setIsUploading(true);
                toast({
                  title: `Uploading ${file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name}`,
                });

                const formData = new FormData();
                formData.append('file', file);
                formData.append('name', file.name);
                formData.append('deviceId', getDeviceId());

                try {
                  const response = await fetch('/api/knowledge', {
                    method: 'POST',
                    body: formData,
                  });

                  if (response.ok) {
                    const data = await response.json();
                    const knowledgeData = data.knowledge || data;

                    if (!knowledgeData.id) {
                      toast({
                        title: "Upload failed",
                        variant: "destructive",
                      });
                      return;
                    }

                    const newKB = {
                      id: String(knowledgeData.id),
                      name: knowledgeData.name || file.name,
                      content: knowledgeData.content || '',
                      createdAt: knowledgeData.uploadedAt || knowledgeData.createdAt || new Date().toISOString(),
                    };

                    setKnowledgeBases(prev => [...prev, newKB]);
                    toast({
                      title: "Uploaded",
                    });
                  } else {
                    const errorText = await response.text();
                    toast({
                      title: "Upload failed",
                      variant: "destructive",
                    });
                  }
                } catch (error) {
                  console.error('Upload error:', error);
                  toast({
                    title: "Upload failed",
                    variant: "destructive",
                  });
                } finally {
                  setIsUploading(false);
                  e.target.value = '';
                }
              }}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white transition-colors",
                isUploading
                  ? "bg-[#0A7CFF]/50 cursor-not-allowed"
                  : "bg-[#0A7CFF] hover:bg-[#0A7CFF]/90 cursor-pointer"
              )}
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Upload Document</span>
                </>
              )}
            </label>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {knowledgeBases.filter(kb => kb && kb.id).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12 animate-in fade-in duration-500">
                <svg className="h-16 w-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium mb-1">No documents yet</p>
                <p className="text-xs opacity-70">Upload PDFs, text files, or markdown</p>
              </div>
            ) : (
              knowledgeBases.filter(kb => kb && kb.id).map(kb => (
                <div
                  key={kb.id}
                  className={cn(
                    "p-3 rounded-lg border transition-colors group",
                    editingDocId === kb.id
                      ? "border-[#0A7CFF]"
                      : selectedKnowledge.includes(kb.id)
                      ? "border-[#0A7CFF] bg-[#0A7CFF]/5"
                      : "border-border hover:border-[#0A7CFF]/50"
                  )}
                >
                  {editingDocId === kb.id ? (
                    <div className="space-y-2">
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
                        className="w-full px-2 py-1 text-sm font-medium bg-background border border-border rounded"
                      />
                      <p className="text-xs text-muted-foreground">
                        Press Enter to save, Esc to cancel
                      </p>
                    </div>
                  ) : (
                    <>
                      <div
                        onClick={() => handleToggleKnowledge(kb.id)}
                        className="flex items-start justify-between cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{kb.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {kb.uploadedAt ? new Date(kb.uploadedAt).toLocaleDateString() : 'Recently'}
                          </p>
                        </div>
                        {selectedKnowledge.includes(kb.id) && (
                          <svg className="h-5 w-5 text-[#0A7CFF] shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      {/* Action Buttons - Always visible on mobile, hover on desktop */}
                      <div className="mt-2 flex gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditingDoc(kb.id, kb.name);
                          }}
                          className="flex-1 text-xs text-foreground hover:text-[#0A7CFF] active:text-[#0A7CFF] hover:bg-[#0A7CFF]/10 active:bg-[#0A7CFF]/10 py-2 rounded-md transition-colors flex items-center justify-center gap-1.5 touch-manipulation"
                          title="Edit name"
                          aria-label="Edit document name"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm({ type: 'doc', id: kb.id, name: kb.name });
                          }}
                          className="flex-1 text-xs text-destructive hover:text-destructive/80 active:text-destructive/80 hover:bg-destructive/10 active:bg-destructive/10 py-2 rounded-md transition-colors flex items-center justify-center gap-1.5 touch-manipulation"
                          title="Delete"
                          aria-label="Delete document"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
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
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowKnowledgePanel(false)}
          />
          <div className="fixed inset-x-0 bottom-0 bg-background rounded-t-2xl z-50 max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl">
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

            <div className="p-4 border-b border-border/40">
              <input
                type="file"
                accept=".pdf,.txt,.md"
                disabled={isUploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  setIsUploading(true);
                  const truncatedName = file.name.length > 30
                    ? file.name.substring(0, 30) + '...'
                    : file.name;
                  toast({
                    title: `Uploading ${truncatedName}`,
                  });

                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('name', file.name);
                  formData.append('deviceId', getDeviceId());

                  try {
                    const response = await fetch('/api/knowledge', {
                      method: 'POST',
                      body: formData,
                    });

                    if (response.ok) {
                      const data = await response.json();
                      const knowledgeData = data.knowledge || data;

                      if (!knowledgeData.id) {
                        toast({
                          title: "Upload failed",
                          variant: "destructive",
                        });
                        return;
                      }

                      const newKB = {
                        id: String(knowledgeData.id),
                        name: knowledgeData.name || file.name,
                        content: knowledgeData.content || '',
                        createdAt: knowledgeData.uploadedAt || knowledgeData.createdAt || new Date().toISOString(),
                      };

                      setKnowledgeBases(prev => [...prev, newKB]);
                      toast({
                        title: "Uploaded",
                      });
                    } else {
                      const errorText = await response.text();
                      toast({
                        title: "Upload failed",
                        variant: "destructive",
                      });
                    }
                  } catch (error) {
                    console.error('Upload error:', error);
                    toast({
                      title: "Upload failed",
                      variant: "destructive",
                    });
                  } finally {
                    setIsUploading(false);
                    e.target.value = '';
                  }
                }}
                className="hidden"
                id="file-upload-mobile"
              />
              <label
                htmlFor="file-upload-mobile"
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white transition-colors text-base",
                  isUploading
                    ? "bg-[#0A7CFF]/50 cursor-not-allowed"
                    : "bg-[#0A7CFF] hover:bg-[#0A7CFF]/90 cursor-pointer active:scale-95"
                )}
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span>Upload Document</span>
                  </>
                )}
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {knowledgeBases.filter(kb => kb && kb.id).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12 animate-in fade-in duration-500">
                  <svg className="h-16 w-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium mb-1">No documents yet</p>
                  <p className="text-xs opacity-70">Upload PDFs, text files, or markdown</p>
                </div>
              ) : (
                knowledgeBases.filter(kb => kb && kb.id).map(kb => (
                  <div
                    key={kb.id}
                    onClick={() => editingDocId !== kb.id && handleToggleKnowledge(kb.id)}
                    className={cn(
                      "p-4 rounded-xl border transition-all",
                      editingDocId === kb.id
                        ? "border-[#0A7CFF] bg-[#0A7CFF]/5"
                        : selectedKnowledge.includes(kb.id)
                        ? "border-[#0A7CFF] bg-[#0A7CFF]/5 active:scale-95"
                        : "border-border hover:border-[#0A7CFF]/50 active:scale-95"
                    )}
                  >
                    {editingDocId === kb.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editingDocName}
                          onChange={(e) => setEditingDocName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveDocName();
                            if (e.key === 'Escape') handleCancelDocEditing();
                          }}
                          autoFocus
                          className="w-full px-3 py-2 text-base font-medium bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A7CFF]"
                          placeholder="Document name"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveDocName();
                            }}
                            className="flex-1 px-3 py-2 text-sm bg-[#0A7CFF] text-white rounded-lg hover:bg-[#0A7CFF]/90 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelDocEditing();
                            }}
                            className="flex-1 px-3 py-2 text-sm bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="text-base font-medium">{kb.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {kb.uploadedAt ? new Date(kb.uploadedAt).toLocaleDateString() : 'Recently'}
                            </p>
                          </div>
                          {selectedKnowledge.includes(kb.id) && (
                            <svg className="h-6 w-6 text-[#0A7CFF] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEditingDoc(kb.id, kb.name);
                            }}
                            className="flex-1 text-sm text-foreground hover:text-[#0A7CFF] active:text-[#0A7CFF] hover:bg-[#0A7CFF]/10 active:bg-[#0A7CFF]/10 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({ type: 'doc', id: kb.id, name: kb.name });
                            }}
                            className="flex-1 text-sm text-destructive hover:text-destructive/80 active:text-destructive/80 hover:bg-destructive/10 active:bg-destructive/10 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
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

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={deleteConfirm?.type === 'chat' ? 'Delete Chat?' : 'Delete Document?'}
        description={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        onConfirm={async () => {
          if (deleteConfirm) {
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
                  toast({
                    title: "Document deleted",
                  });
                } else {
                  toast({
                    title: "Could not delete document",
                    variant: "destructive",
                  });
                }
              } catch (error) {
                console.error('Error deleting document:', error);
                toast({
                  title: "Could not delete document",
                  variant: "destructive",
                });
              }
            }
            setDeleteConfirm(null);
          }
        }}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}

