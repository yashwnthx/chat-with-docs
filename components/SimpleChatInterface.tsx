"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageInput } from './ChatInput';
import { MessageList } from './MessageList';
import { ChatHeader } from './ChatHeader';
import { ScrollArea } from './ui/scroll-area';
import { LoadingSpinner } from './LoadingSpinner';
import { ConfirmDialog } from './ConfirmDialog';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { Message, Conversation, KnowledgeBase } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function SimpleChatInterface() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  const STORAGE_KEY = 'chatbot_conversations';
  const KB_STORAGE_KEY = 'chatbot_knowledge';

  // Get active conversation
  const activeConversation = conversations.find(c => c.id === activeConversationId);

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

  // Load from localStorage on mount
  useEffect(() => {
    const savedConversations = localStorage.getItem(STORAGE_KEY);
    const savedKnowledge = localStorage.getItem(KB_STORAGE_KEY);

    if (savedConversations) {
      try {
        const parsed = JSON.parse(savedConversations);
        setConversations(parsed);
        if (parsed.length > 0) {
          setActiveConversationId(parsed[0].id);
        }
      } catch (e) {
        console.error('Error loading conversations:', e);
      }
    } else {
      // Create initial conversation
      const newConv: Conversation = {
        id: uuidv4(),
        name: 'New Chat',
        recipients: [{ id: 'ai', name: 'AI Assistant' }],
        messages: [],
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
      };
      setConversations([newConv]);
      setActiveConversationId(newConv.id);
    }

    if (savedKnowledge) {
      try {
        setKnowledgeBases(JSON.parse(savedKnowledge));
      } catch (e) {
        console.error('Error loading knowledge bases:', e);
      }
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    }
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem(KB_STORAGE_KEY, JSON.stringify(knowledgeBases));
  }, [knowledgeBases]);

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
      id: uuidv4(),
      content: text,
      sender: 'me',
      timestamp: new Date().toISOString()
    };

    // Update conversation with new message
    setConversations(prev => prev.map(conv =>
      conv.id === activeConversationId
        ? {
            ...conv,
            messages: [...conv.messages, newMessage],
            lastMessageTime: new Date().toISOString(),
          }
        : conv
    ));

    setMessageDraft('');
    setIsTyping(true);

    // Prepare messages for API
    const currentConv = conversations.find(c => c.id === activeConversationId);
    const allMessages = currentConv ? [...currentConv.messages, newMessage] : [newMessage];

    const apiMessages = allMessages.map(m => ({
      role: m.sender === 'me' ? 'user' : 'assistant',
      content: m.content
    }));

    // Call API with knowledge base if selected
    try {
      // Filter out any null/undefined knowledge IDs
      const validKnowledgeIds = selectedKnowledge.filter(id => id != null);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          knowledgeIds: validKnowledgeIds,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let botMessageText = '';

      if (reader) {
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
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }
      }

      const botMessage: Message = {
        id: uuidv4(),
        content: botMessageText || 'I received your message!',
        sender: 'bot',
        timestamp: new Date().toISOString()
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
    } catch (error) {
      console.error('Error sending message:', error);
      // Fallback response
      const botMessage: Message = {
        id: uuidv4(),
        content: `I understand you said: "${text}". How can I help you with that?`,
        sender: 'bot',
        timestamp: new Date().toISOString()
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
    const newConv: Conversation = {
      id: uuidv4(),
      name: 'New Chat',
      recipients: [{ id: 'ai', name: 'AI Assistant' }],
      messages: [],
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    setSelectedKnowledge([]);
  }, []);

  const handleDeleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (id === activeConversationId) {
        setActiveConversationId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
    toast({
      title: "Chat Deleted",
      description: "The conversation has been removed",
    });
  }, [activeConversationId, toast]);

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

  const handleSaveConversationName = () => {
    if (!editingConvId || !editingName.trim()) return;

    setConversations(prev => prev.map(conv =>
      conv.id === editingConvId
        ? { ...conv, name: editingName.trim() }
        : conv
    ));

    setEditingConvId(null);
    setEditingName('');
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
      title: "Document Renamed",
      description: "Document name has been updated",
    });

    setEditingDocId(null);
    setEditingDocName('');
  }, [editingDocId, editingDocName, toast]);

  const handleCancelDocEditing = () => {
    setEditingDocId(null);
    setEditingDocName('');
  };

  return (
    <div className="flex h-dvh bg-gray-100 dark:bg-background overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-in fade-in duration-200"
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
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-4 animate-in fade-in duration-500">
                  <svg className="h-12 w-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <p className="text-sm font-medium mb-1">No chats yet</p>
                  <p className="text-xs opacity-70">Start a new conversation</p>
                </div>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => {
                      if (editingConvId !== conv.id) {
                        setActiveConversationId(conv.id);
                        setShowMobileSidebar(false);
                      }
                    }}
                    className={cn(
                      "p-3 rounded-lg mb-1 transition-colors",
                      editingConvId === conv.id
                        ? "bg-muted"
                        : activeConversationId === conv.id
                        ? "bg-[#0A7CFF]/10 border border-[#0A7CFF]/20"
                        : "hover:bg-muted"
                    )}
                  >
                    {editingConvId === conv.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveConversationName();
                            if (e.key === 'Escape') handleCancelEditing();
                          }}
                          autoFocus
                          className="w-full px-3 py-2 text-sm font-medium bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A7CFF]"
                          placeholder="Chat name"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveConversationName();
                            }}
                            className="flex-1 px-3 py-2 text-sm bg-[#0A7CFF] text-white rounded-lg hover:bg-[#0A7CFF]/90 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelEditing();
                            }}
                            className="flex-1 px-3 py-2 text-sm bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium truncate flex-1">
                            {conv.name || 'New Chat'}
                          </p>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditingConversation(conv.id, conv.name || 'New Chat');
                              }}
                              className="p-1.5 hover:bg-muted active:bg-muted rounded-md touch-manipulation"
                              aria-label="Edit chat name"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({ type: 'chat', id: conv.id, name: conv.name || 'New Chat' });
                              }}
                              className="p-1.5 hover:bg-destructive/20 active:bg-destructive/20 rounded-md touch-manipulation"
                              aria-label="Delete chat"
                            >
                              <svg className="h-4 w-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {getLastMessagePreview(conv)}
                        </p>
                      </>
                    )}
                  </div>
                ))
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
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground px-4 animate-in fade-in duration-500">
              <svg className="h-12 w-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-sm font-medium mb-1">No chats yet</p>
              <p className="text-xs opacity-70">Start a new conversation</p>
            </div>
          ) : (
            conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => editingConvId !== conv.id && setActiveConversationId(conv.id)}
              className={cn(
                "p-3 rounded-lg mb-1 transition-colors group",
                editingConvId === conv.id
                  ? "bg-muted"
                  : cn(
                    "cursor-pointer",
                    conv.id === activeConversationId
                      ? "bg-muted"
                      : "hover:bg-muted/50"
                  )
              )}
            >
              <div className="flex items-center justify-between gap-2">
                {editingConvId === conv.id ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveConversationName();
                        if (e.key === 'Escape') handleCancelEditing();
                      }}
                      onBlur={handleSaveConversationName}
                      autoFocus
                      className="flex-1 px-2 py-1 text-sm font-medium bg-background border border-border rounded"
                    />
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium truncate flex-1">
                      {conv.name || 'New Chat'}
                    </p>
                    <div className="flex items-center gap-1 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditingConversation(conv.id, conv.name || 'New Chat');
                        }}
                        className="p-1.5 hover:bg-muted active:bg-muted rounded-md touch-manipulation"
                        title="Edit name"
                        aria-label="Edit chat name"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm({ type: 'chat', id: conv.id, name: conv.name || 'New Chat' });
                        }}
                        className="p-1.5 hover:bg-destructive/20 active:bg-destructive/20 rounded-md touch-manipulation"
                        title="Delete chat"
                        aria-label="Delete chat"
                      >
                        <svg className="h-4 w-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
              {editingConvId !== conv.id && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {getLastMessagePreview(conv)}
                </p>
              )}
            </div>
          ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-dvh relative">
        <div className="absolute top-0 left-0 right-0 z-50">
          <ChatHeader
            onShowKnowledge={() => setShowKnowledgePanel(!showKnowledgePanel)}
            conversationName={activeConversation?.name}
            onShowMobileSidebar={() => setShowMobileSidebar(!showMobileSidebar)}
            onShowSearch={() => setShowSearch(!showSearch)}
          />
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="absolute top-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/40 p-4 animate-in slide-in-from-top duration-200">
            <div className="max-w-2xl mx-auto flex items-center gap-3">
              <div className="flex-1 relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in messages..."
                  className="w-full bg-background border border-border rounded-lg pl-10 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A7CFF]"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {searchQuery && `${filteredMessages.length} results`}
              </div>
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label="Close search"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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
              "pb-32 sm:pb-24" // Extra padding for mobile to account for badges and input
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

        <div className="absolute bottom-0 left-0 right-0 z-50 mb-[env(keyboard-inset-height,0px)] bg-background">
          <MessageInput
            onSendMessage={handleSendMessage}
            message={messageDraft}
            setMessage={setMessageDraft}
            isMobileView={isMobileView}
            knowledgeBases={knowledgeBases}
            selectedKnowledge={selectedKnowledge}
            onToggleKnowledge={handleToggleKnowledge}
          />
        </div>
      </div>

      {/* Knowledge Panel - Desktop (Overlay instead of fixed width) */}
      {showKnowledgePanel && !isMobile && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setShowKnowledgePanel(false)}
          />
          <div className="fixed top-0 right-0 bottom-0 w-96 border-l border-border/40 bg-background flex-col flex z-50 shadow-2xl animate-in slide-in-from-right duration-300">
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
                  title: "Uploading...",
                  description: `Uploading ${file.name}`,
                });

                const formData = new FormData();
                formData.append('file', file);
                formData.append('name', file.name);

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
                        title: "Upload Failed",
                        description: "No ID returned from server",
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
                      title: "Upload Successful",
                      description: `${file.name} has been uploaded`,
                    });
                  } else {
                    const errorText = await response.text();
                    toast({
                      title: "Upload Failed",
                      description: errorText || "Failed to upload document",
                      variant: "destructive",
                    });
                  }
                } catch (error) {
                  console.error('Upload error:', error);
                  toast({
                    title: "Upload Error",
                    description: "An unexpected error occurred",
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
                  <LoadingSpinner size="sm" className="text-white" />
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
                            {new Date(kb.createdAt).toLocaleDateString()}
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
                  toast({
                    title: "Uploading...",
                    description: `Uploading ${file.name}`,
                  });

                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('name', file.name);

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
                          title: "Upload Failed",
                          description: "No ID returned from server",
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
                        title: "Upload Successful",
                        description: `${file.name} has been uploaded`,
                      });
                    } else {
                      const errorText = await response.text();
                      toast({
                        title: "Upload Failed",
                        description: errorText || "Failed to upload document",
                        variant: "destructive",
                      });
                    }
                  } catch (error) {
                    console.error('Upload error:', error);
                    toast({
                      title: "Upload Error",
                      description: "An unexpected error occurred",
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
                    <LoadingSpinner size="sm" className="text-white" />
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
                              {new Date(kb.createdAt).toLocaleDateString()}
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
        onConfirm={() => {
          if (deleteConfirm) {
            if (deleteConfirm.type === 'chat') {
              handleDeleteConversation(deleteConfirm.id);
            } else {
              setKnowledgeBases(prev => prev.filter(k => k.id !== deleteConfirm.id));
              setSelectedKnowledge(prev => prev.filter(id => id !== deleteConfirm.id));
              toast({
                title: "Document Deleted",
                description: "The document has been removed",
              });
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

