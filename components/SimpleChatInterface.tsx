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
import { DocumentIcon } from './icons/AppleIcons';

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
  const [mobileMenuChatId, setMobileMenuChatId] = useState<string | null>(null);
  const [mobileMenuDocId, setMobileMenuDocId] = useState<string | null>(null);
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
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M2.6687 11.333V8.66699C2.6687 7.74455 2.66841 7.01205 2.71655 6.42285C2.76533 5.82612 2.86699 5.31731 3.10425 4.85156L3.25854 4.57617C3.64272 3.94975 4.19392 3.43995 4.85229 3.10449L5.02905 3.02149C5.44666 2.84233 5.90133 2.75849 6.42358 2.71582C7.01272 2.66769 7.74445 2.66797 8.66675 2.66797H9.16675C9.53393 2.66797 9.83165 2.96586 9.83179 3.33301C9.83179 3.70028 9.53402 3.99805 9.16675 3.99805H8.66675C7.7226 3.99805 7.05438 3.99834 6.53198 4.04102C6.14611 4.07254 5.87277 4.12568 5.65601 4.20313L5.45581 4.28906C5.01645 4.51293 4.64872 4.85345 4.39233 5.27149L4.28979 5.45508C4.16388 5.7022 4.08381 6.01663 4.04175 6.53125C3.99906 7.05373 3.99878 7.7226 3.99878 8.66699V11.333C3.99878 12.2774 3.99906 12.9463 4.04175 13.4688C4.08381 13.9833 4.16389 14.2978 4.28979 14.5449L4.39233 14.7285C4.64871 15.1465 5.01648 15.4871 5.45581 15.7109L5.65601 15.7969C5.87276 15.8743 6.14614 15.9265 6.53198 15.958C7.05439 16.0007 7.72256 16.002 8.66675 16.002H11.3337C12.2779 16.002 12.9461 16.0007 13.4685 15.958C13.9829 15.916 14.2976 15.8367 14.5447 15.7109L14.7292 15.6074C15.147 15.3511 15.4879 14.9841 15.7117 14.5449L15.7976 14.3447C15.8751 14.128 15.9272 13.8546 15.9587 13.4688C16.0014 12.9463 16.0017 12.2774 16.0017 11.333V10.833C16.0018 10.466 16.2997 10.1681 16.6667 10.168C17.0339 10.168 17.3316 10.4659 17.3318 10.833V11.333C17.3318 12.2555 17.3331 12.9879 17.2849 13.5771C17.2422 14.0993 17.1584 14.5541 16.9792 14.9717L16.8962 15.1484C16.5609 15.8066 16.0507 16.3571 15.4246 16.7412L15.1492 16.8955C14.6833 17.1329 14.1739 17.2354 13.5769 17.2842C12.9878 17.3323 12.256 17.332 11.3337 17.332H8.66675C7.74446 17.332 7.01271 17.3323 6.42358 17.2842C5.90135 17.2415 5.44665 17.1577 5.02905 16.9785L4.85229 16.8955C4.19396 16.5601 3.64271 16.0502 3.25854 15.4238L3.10425 15.1484C2.86697 14.6827 2.76534 14.1739 2.71655 13.5771C2.66841 12.9879 2.6687 12.2555 2.6687 11.333ZM13.4646 3.11328C14.4201 2.334 15.8288 2.38969 16.7195 3.28027L16.8865 3.46485C17.6141 4.35685 17.6143 5.64423 16.8865 6.53613L16.7195 6.7207L11.6726 11.7686C11.1373 12.3039 10.4624 12.6746 9.72827 12.8408L9.41089 12.8994L7.59351 13.1582C7.38637 13.1877 7.17701 13.1187 7.02905 12.9707C6.88112 12.8227 6.81199 12.6134 6.84155 12.4063L7.10132 10.5898L7.15991 10.2715C7.3262 9.53749 7.69692 8.86241 8.23218 8.32715L13.2791 3.28027L13.4646 3.11328ZM15.7791 4.2207C15.3753 3.81702 14.7366 3.79124 14.3035 4.14453L14.2195 4.2207L9.17261 9.26856C8.81541 9.62578 8.56774 10.0756 8.45679 10.5654L8.41772 10.7773L8.28296 11.7158L9.22241 11.582L9.43433 11.543C9.92426 11.432 10.3749 11.1844 10.7322 10.8271L15.7791 5.78027L15.8552 5.69629C16.185 5.29194 16.1852 4.708 15.8552 4.30371L15.7791 4.2207Z"></path>
                </svg>
                <span>New Chat</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-visible p-2">
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
                                      className="fixed w-40 bg-popover border border-border rounded-lg shadow-lg py-1 z-[110]"
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
                              router.push(`/chat/${conv.id}`);
                              setShowMobileSidebar(false);
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
                                      className="fixed w-40 bg-popover border border-border rounded-lg shadow-lg py-1 z-[110]"
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
      <div className="w-64 border-r border-border/40 bg-background flex-col hidden lg:flex">
        <div className="p-4 border-b border-border/40">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#0A7CFF] text-white hover:bg-[#0A7CFF]/90 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M2.6687 11.333V8.66699C2.6687 7.74455 2.66841 7.01205 2.71655 6.42285C2.76533 5.82612 2.86699 5.31731 3.10425 4.85156L3.25854 4.57617C3.64272 3.94975 4.19392 3.43995 4.85229 3.10449L5.02905 3.02149C5.44666 2.84233 5.90133 2.75849 6.42358 2.71582C7.01272 2.66769 7.74445 2.66797 8.66675 2.66797H9.16675C9.53393 2.66797 9.83165 2.96586 9.83179 3.33301C9.83179 3.70028 9.53402 3.99805 9.16675 3.99805H8.66675C7.7226 3.99805 7.05438 3.99834 6.53198 4.04102C6.14611 4.07254 5.87277 4.12568 5.65601 4.20313L5.45581 4.28906C5.01645 4.51293 4.64872 4.85345 4.39233 5.27149L4.28979 5.45508C4.16388 5.7022 4.08381 6.01663 4.04175 6.53125C3.99906 7.05373 3.99878 7.7226 3.99878 8.66699V11.333C3.99878 12.2774 3.99906 12.9463 4.04175 13.4688C4.08381 13.9833 4.16389 14.2978 4.28979 14.5449L4.39233 14.7285C4.64871 15.1465 5.01648 15.4871 5.45581 15.7109L5.65601 15.7969C5.87276 15.8743 6.14614 15.9265 6.53198 15.958C7.05439 16.0007 7.72256 16.002 8.66675 16.002H11.3337C12.2779 16.002 12.9461 16.0007 13.4685 15.958C13.9829 15.916 14.2976 15.8367 14.5447 15.7109L14.7292 15.6074C15.147 15.3511 15.4879 14.9841 15.7117 14.5449L15.7976 14.3447C15.8751 14.128 15.9272 13.8546 15.9587 13.4688C16.0014 12.9463 16.0017 12.2774 16.0017 11.333V10.833C16.0018 10.466 16.2997 10.1681 16.6667 10.168C17.0339 10.168 17.3316 10.4659 17.3318 10.833V11.333C17.3318 12.2555 17.3331 12.9879 17.2849 13.5771C17.2422 14.0993 17.1584 14.5541 16.9792 14.9717L16.8962 15.1484C16.5609 15.8066 16.0507 16.3571 15.4246 16.7412L15.1492 16.8955C14.6833 17.1329 14.1739 17.2354 13.5769 17.2842C12.9878 17.3323 12.256 17.332 11.3337 17.332H8.66675C7.74446 17.332 7.01271 17.3323 6.42358 17.2842C5.90135 17.2415 5.44665 17.1577 5.02905 16.9785L4.85229 16.8955C4.19396 16.5601 3.64271 16.0502 3.25854 15.4238L3.10425 15.1484C2.86697 14.6827 2.76534 14.1739 2.71655 13.5771C2.66841 12.9879 2.6687 12.2555 2.6687 11.333ZM13.4646 3.11328C14.4201 2.334 15.8288 2.38969 16.7195 3.28027L16.8865 3.46485C17.6141 4.35685 17.6143 5.64423 16.8865 6.53613L16.7195 6.7207L11.6726 11.7686C11.1373 12.3039 10.4624 12.6746 9.72827 12.8408L9.41089 12.8994L7.59351 13.1582C7.38637 13.1877 7.17701 13.1187 7.02905 12.9707C6.88112 12.8227 6.81199 12.6134 6.84155 12.4063L7.10132 10.5898L7.15991 10.2715C7.3262 9.53749 7.69692 8.86241 8.23218 8.32715L13.2791 3.28027L13.4646 3.11328ZM15.7791 4.2207C15.3753 3.81702 14.7366 3.79124 14.3035 4.14453L14.2195 4.2207L9.17261 9.26856C8.81541 9.62578 8.56774 10.0756 8.45679 10.5654L8.41772 10.7773L8.28296 11.7158L9.22241 11.582L9.43433 11.543C9.92426 11.432 10.3749 11.1844 10.7322 10.8271L15.7791 5.78027L15.8552 5.69629C16.185 5.29194 16.1852 4.708 15.8552 4.30371L15.7791 4.2207Z"></path>
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
          <div
            className="fixed top-16 right-0 bottom-0 w-96 border-l border-border/40 bg-background flex-col flex z-50 shadow-2xl animate-in slide-in-from-right duration-300"
            data-knowledge-panel="true"
          >
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
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4.33496 12.5V7.5C4.33496 7.13273 4.63273 6.83496 5 6.83496C5.36727 6.83496 5.66504 7.13273 5.66504 7.5V12.5C5.66504 14.8942 7.60585 16.835 10 16.835C12.3942 16.835 14.335 14.8942 14.335 12.5V5.83301C14.3348 4.35959 13.1404 3.16522 11.667 3.16504C10.1934 3.16504 8.99822 4.35948 8.99805 5.83301V12.5C8.99805 13.0532 9.44679 13.502 10 13.502C10.5532 13.502 11.002 13.0532 11.002 12.5V7.5C11.002 7.13273 11.2997 6.83496 11.667 6.83496C12.0341 6.83514 12.332 7.13284 12.332 7.5V12.5C12.332 13.7877 11.2877 14.832 10 14.832C8.71226 14.832 7.66797 13.7877 7.66797 12.5V5.83301C7.66814 3.62494 9.45888 1.83496 11.667 1.83496C13.875 1.83514 15.6649 3.62505 15.665 5.83301V12.5C15.665 15.6287 13.1287 18.165 10 18.165C6.87131 18.165 4.33496 15.6287 4.33496 12.5Z"></path>
                  </svg>
                  <span>Upload Document</span>
                </>
              )}
            </label>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {knowledgeBases.filter(kb => kb && kb.id).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12 animate-in fade-in duration-500">
                <img src="/folder-icon.png" alt="Folder" className="h-16 w-16 mb-4 opacity-40" />
                <p className="text-sm font-medium mb-1">No documents yet</p>
                <p className="text-xs opacity-70">Upload PDFs, text files, or markdown</p>
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
                      <div
                        onClick={() => handleToggleKnowledge(kb.id)}
                        className="flex items-center gap-3 p-3 cursor-pointer"
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
                        <div className="flex items-center gap-2 shrink-0">
                          {selectedKnowledge.includes(kb.id) && (
                            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-500">
                              <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          {/* 3-dot menu */}
                          <div className="relative" data-menu-id={kb.id}>
                            <button
                              id={`doc-menu-button-${kb.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setMobileMenuDocId(mobileMenuDocId === kb.id ? null : kb.id);
                              }}
                              className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                              aria-label="Document options"
                            >
                              <svg className="h-4 w-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                              </svg>
                            </button>

                            {/* Dropdown menu - uses fixed positioning to escape container */}
                            {mobileMenuDocId === kb.id && (() => {
                              const button = document.getElementById(`doc-menu-button-${kb.id}`);
                              const rect = button?.getBoundingClientRect();

                              // Calculate position intelligently to avoid screen edges
                              let left = 0;
                              let top = 0;
                              const menuWidth = 160; // w-40 = 160px
                              const menuHeight = 100; // Approximate height of menu with 2 items
                              const screenWidth = window.innerWidth;
                              const screenHeight = window.innerHeight;
                              const margin = 16; // Larger margin from screen edge

                              if (rect) {
                                // Calculate horizontal position
                                const spaceOnRight = screenWidth - rect.right;
                                const spaceOnLeft = rect.left;

                                // If button is close to right edge (less than menu width + margin)
                                if (spaceOnRight < menuWidth + margin) {
                                  // Position menu to the left of the button
                                  const leftAligned = rect.left - menuWidth + rect.width;
                                  left = Math.max(margin, leftAligned);
                                }
                                // If there's not enough space on left either
                                else if (spaceOnLeft < menuWidth) {
                                  // Center the menu with margin
                                  left = Math.max(margin, Math.min(screenWidth - menuWidth - margin, rect.left));
                                }
                                else {
                                  // Normal positioning - align right edge of menu with right edge of button
                                  left = Math.max(margin, Math.min(screenWidth - menuWidth - margin, rect.right - menuWidth));
                                }

                                // Calculate vertical position
                                const spaceBelow = screenHeight - rect.bottom;
                                if (spaceBelow < menuHeight + margin) {
                                  // Not enough space below, show above the button
                                  top = rect.top - menuHeight - 4;
                                } else {
                                  // Show below the button
                                  top = rect.bottom + 4;
                                }
                              }

                              return (
                                <div
                                  className="fixed w-40 bg-popover border border-border rounded-lg shadow-lg py-1 z-[110]"
                                  style={{
                                    top: `${top}px`,
                                    left: `${left}px`,
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
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4.33496 12.5V7.5C4.33496 7.13273 4.63273 6.83496 5 6.83496C5.36727 6.83496 5.66504 7.13273 5.66504 7.5V12.5C5.66504 14.8942 7.60585 16.835 10 16.835C12.3942 16.835 14.335 14.8942 14.335 12.5V5.83301C14.3348 4.35959 13.1404 3.16522 11.667 3.16504C10.1934 3.16504 8.99822 4.35948 8.99805 5.83301V12.5C8.99805 13.0532 9.44679 13.502 10 13.502C10.5532 13.502 11.002 13.0532 11.002 12.5V7.5C11.002 7.13273 11.2997 6.83496 11.667 6.83496C12.0341 6.83514 12.332 7.13284 12.332 7.5V12.5C12.332 13.7877 11.2877 14.832 10 14.832C8.71226 14.832 7.66797 13.7877 7.66797 12.5V5.83301C7.66814 3.62494 9.45888 1.83496 11.667 1.83496C13.875 1.83514 15.6649 3.62505 15.665 5.83301V12.5C15.665 15.6287 13.1287 18.165 10 18.165C6.87131 18.165 4.33496 15.6287 4.33496 12.5Z"></path>
                    </svg>
                    <span>Upload Document</span>
                  </>
                )}
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {knowledgeBases.filter(kb => kb && kb.id).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12 animate-in fade-in duration-500">
                  <img src="/folder-icon.png" alt="Folder" className="h-16 w-16 mb-4 opacity-40" />
                  <p className="text-sm font-medium mb-1">No documents yet</p>
                  <p className="text-xs opacity-70">Upload PDFs, text files, or markdown</p>
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
                        <div
                          onClick={() => editingDocId !== kb.id && handleToggleKnowledge(kb.id)}
                          className="flex items-center gap-3 p-4 cursor-pointer"
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
                          <div className="flex items-center gap-3 shrink-0">
                            {selectedKnowledge.includes(kb.id) && (
                              <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500">
                                <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                            {/* 3-dot menu */}
                            <div className="relative" data-menu-id={kb.id}>
                              <button
                                id={`doc-menu-button-mobile-${kb.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMobileMenuDocId(mobileMenuDocId === kb.id ? null : kb.id);
                                }}
                                className="p-2 rounded-md hover:bg-muted active:bg-muted"
                                aria-label="Document options"
                              >
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                                </svg>
                              </button>

                              {/* Dropdown menu - uses fixed positioning to escape container */}
                              {mobileMenuDocId === kb.id && (() => {
                                const button = document.getElementById(`doc-menu-button-mobile-${kb.id}`);
                                const rect = button?.getBoundingClientRect();

                                // Calculate position intelligently to avoid screen edges
                                let left = 0;
                                let top = 0;
                                const menuWidth = 160; // w-40 = 160px
                                const menuHeight = 100; // Approximate height of menu with 2 items
                                const screenWidth = window.innerWidth;
                                const screenHeight = window.innerHeight;
                                const margin = 16; // Larger margin from screen edge

                                if (rect) {
                                  // Calculate horizontal position
                                  const spaceOnRight = screenWidth - rect.right;
                                  const spaceOnLeft = rect.left;

                                  // If button is close to right edge (less than menu width + margin)
                                  if (spaceOnRight < menuWidth + margin) {
                                    // Position menu to the left of the button
                                    const leftAligned = rect.left - menuWidth + rect.width;
                                    left = Math.max(margin, leftAligned);
                                  }
                                  // If there's not enough space on left either
                                  else if (spaceOnLeft < menuWidth) {
                                    // Center the menu with margin
                                    left = Math.max(margin, Math.min(screenWidth - menuWidth - margin, rect.left));
                                  }
                                  else {
                                    // Normal positioning - align right edge of menu with right edge of button
                                    left = Math.max(margin, Math.min(screenWidth - menuWidth - margin, rect.right - menuWidth));
                                  }

                                  // Calculate vertical position
                                  const spaceBelow = screenHeight - rect.bottom;
                                  if (spaceBelow < menuHeight + margin) {
                                    // Not enough space below, show above the button
                                    top = rect.top - menuHeight - 4;
                                  } else {
                                    // Show below the button
                                    top = rect.bottom + 4;
                                  }
                                }

                                return (
                                  <div
                                    className="fixed w-40 bg-popover border border-border rounded-lg shadow-lg py-1 z-[110]"
                                    style={{
                                      top: `${top}px`,
                                      left: `${left}px`,
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

