'use client';

import { FormEvent, ChangeEvent, useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, SendHorizonal } from 'lucide-react';
import { Knowledge } from '@prisma/client';
import { soundEffects } from '@/lib/sound-effects';

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  onInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  selectedKnowledge: string[];
  knowledgeBases: Knowledge[];
  onToggleKnowledge: (id: string) => void;
  onShowKnowledgePanel?: () => void;
}

export default function ChatInput({
  input,
  isLoading,
  onInputChange,
  onSubmit,
  selectedKnowledge,
  knowledgeBases,
  onToggleKnowledge,
  onShowKnowledgePanel,
}: ChatInputProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle @ mention
    if (e.key === '@') {
      setShowMentions(true);
      setMentionSearch('');
      setCursorPosition(e.currentTarget.selectionStart + 1);
    }

    // Close mention menu on Escape
    if (e.key === 'Escape' && showMentions) {
      setShowMentions(false);
      e.preventDefault();
      return;
    }

    // Submit on Enter (without Shift) OR Ctrl/Cmd + Enter
    if (e.key === 'Enter' && !showMentions) {
      // Ctrl/Cmd + Enter always sends
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const form = e.currentTarget.form;
        if (form && input.trim()) {
          form.requestSubmit();
        }
        return;
      }

      // Plain Enter sends (Shift+Enter for new line)
      if (!e.shiftKey) {
        e.preventDefault();
        const form = e.currentTarget.form;
        if (form && input.trim()) {
          form.requestSubmit();
        }
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onInputChange(e);

    // Update mention search if mention menu is open
    if (showMentions) {
      const text = e.target.value;
      const lastAtIndex = text.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        const searchText = text.slice(lastAtIndex + 1, e.target.selectionStart);
        setMentionSearch(searchText);
      } else {
        setShowMentions(false);
      }
    }
  };

  const selectMention = (knowledge: Knowledge) => {
    // Add to selected knowledge
    if (!selectedKnowledge.includes(knowledge.id)) {
      onToggleKnowledge(knowledge.id);
    }

    // Remove @ mention from input
    const text = input;
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const newText = text.slice(0, lastAtIndex) + text.slice(cursorPosition);
      const event = {
        target: { value: newText }
      } as ChangeEvent<HTMLTextAreaElement>;
      onInputChange(event);
    }

    setShowMentions(false);
    textareaRef.current?.focus();
  };

  // Filter knowledge bases by mention search
  const filteredKnowledge = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Click outside to close mentions
  useEffect(() => {
    const handleClickOutside = () => setShowMentions(false);
    if (showMentions) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMentions]);

  const selectedKnowledgeObjects = knowledgeBases
    .filter(kb => selectedKnowledge.includes(kb.id));

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
      {/* Selected Knowledge Badges */}
      {selectedKnowledgeObjects.length > 0 && (
        <div className="px-3 sm:px-4 pt-2 sm:pt-3 flex flex-wrap gap-1.5 sm:gap-2">
          {selectedKnowledgeObjects.map(kb => (
            <div
              key={kb.id}
              className="flex items-center gap-1 px-2 py-1 bg-ios-blue/10 text-ios-blue rounded-full text-sm"
            >
              <Paperclip className="h-3 w-3" />
              <span>{kb.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={onSubmit} className="p-3 sm:p-4">
        <div className="flex items-end gap-2 max-w-3xl mx-auto relative">
          {/* @ Mention Dropdown */}
          {showMentions && filteredKnowledge.length > 0 && (
            <div className="absolute bottom-full left-12 mb-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-10">
              <div className="p-2 space-y-0.5 max-h-64 overflow-y-auto custom-scrollbar">
                {filteredKnowledge.map(kb => (
                  <button
                    key={kb.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectMention(kb);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-start gap-2.5 transition-colors"
                  >
                    <Paperclip className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate text-gray-900 dark:text-white">{kb.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {kb.originalFilename}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Documents Button */}
          <button
            type="button"
            onClick={onShowKnowledgePanel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-95 text-gray-600 dark:text-gray-400"
            aria-label="Documents"
            title="Add documents"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="message"
            disabled={isLoading}
            rows={1}
            className="flex-1 resize-none rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 max-h-32 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            style={{
              minHeight: '38px',
              height: 'auto',
            }}
          />

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white transition-all hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-500 active:scale-95"
            aria-label="Send message"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  message: string;
  setMessage: (text: string) => void;
  isMobileView?: boolean;
  knowledgeBases?: { id: string; name: string; content: string; createdAt: string }[];
  selectedKnowledge?: string[];
  onToggleKnowledge?: (id: string) => void;
}

export function MessageInput({
  onSendMessage,
  message,
  setMessage,
  isMobileView = false,
  knowledgeBases = [],
  selectedKnowledge = [],
  onToggleKnowledge,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  const handleSend = () => {
    if (message.trim()) {
      soundEffects.playSentSound();
      onSendMessage(message);
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = '32px';
        document.documentElement.style.setProperty('--dynamic-height', '64px');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle @ mention
    if (e.key === '@' && !showMentions) {
      setShowMentions(true);
      setMentionSearch('');
      setCursorPosition(e.currentTarget.selectionStart + 1);
    }

    // Close mention menu on Escape
    if (e.key === 'Escape' && showMentions) {
      setShowMentions(false);
      e.preventDefault();
      return;
    }

    // Submit on Enter (without Shift) OR Ctrl/Cmd + Enter
    if (e.key === 'Enter' && !showMentions) {
      // Ctrl/Cmd + Enter always sends
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (message.trim()) {
          handleSend();
          if (isMobileView && textareaRef.current) {
            textareaRef.current.blur();
          }
        }
        return;
      }

      // Plain Enter sends (Shift+Enter for new line)
      if (!e.shiftKey) {
        e.preventDefault();
        if (message.trim()) {
          handleSend();
          if (isMobileView && textareaRef.current) {
            textareaRef.current.blur();
          }
        }
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setMessage(newValue);

    // Update mention search if mention menu is open
    if (showMentions) {
      const lastAtIndex = newValue.lastIndexOf('@');
      if (lastAtIndex !== -1 && lastAtIndex < e.target.selectionStart) {
        const searchText = newValue.slice(lastAtIndex + 1, e.target.selectionStart);
        setMentionSearch(searchText);
      } else {
        setShowMentions(false);
      }
    }

    // Auto-resize textarea
    const element = e.target;
    element.style.height = 'auto';
    const contentHeight = element.scrollHeight;
    const height = Math.min(200, Math.max(32, contentHeight));
    const containerHeight = height + 32;

    element.style.height = `${height}px`;
    element.style.overflowY = height >= 200 ? 'auto' : 'hidden';
    document.documentElement.style.setProperty('--dynamic-height', `${containerHeight}px`);
  };

  const selectMention = (kb: { id: string; name: string }) => {
    // Add to selected knowledge
    if (onToggleKnowledge && !selectedKnowledge.includes(kb.id)) {
      onToggleKnowledge(kb.id);
    }

    // Remove @ mention from input
    const lastAtIndex = message.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const newText = message.slice(0, lastAtIndex) + message.slice(cursorPosition);
      setMessage(newText);
    }

    setShowMentions(false);
    textareaRef.current?.focus();
  };

  // Filter knowledge bases by mention search
  const filteredKnowledge = knowledgeBases.filter(kb =>
    kb?.name?.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Click outside to close mentions
  useEffect(() => {
    const handleClickOutside = () => setShowMentions(false);
    if (showMentions) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMentions]);

  // Auto-focus on desktop
  useEffect(() => {
    if (!isMobileView && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isMobileView]);

  const selectedKnowledgeBases = knowledgeBases
    .filter(kb => kb && kb.id && selectedKnowledge.includes(kb.id));

  return (
    <div className="border-t border-border/40 bg-background backdrop-blur-md shadow-lg">
      {/* Selected Knowledge Badges */}
      {selectedKnowledgeBases.length > 0 && (
        <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2 bg-background">
          {selectedKnowledgeBases.map(kb => (
            <div
              key={kb.id}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A7CFF]/10 text-[#0A7CFF] rounded-full text-sm"
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
              <span>{kb.name}</span>
              <button
                onClick={() => onToggleKnowledge && onToggleKnowledge(kb.id)}
                className="hover:text-[#0A7CFF]/80"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div
        className="w-full"
        style={{ height: "var(--dynamic-height, 64px)" }}
      >
        <div className="flex gap-2 p-4 h-full">
          <div className="relative w-full">
            {/* @ Mention Dropdown */}
            {showMentions && filteredKnowledge.length > 0 && (
              <div
                className="absolute bottom-full left-0 mb-2 w-full max-w-md bg-background border border-border rounded-xl shadow-xl overflow-hidden z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2 space-y-0.5 max-h-64 overflow-y-auto">
                  {filteredKnowledge.map(kb => (
                    <button
                      key={kb.id}
                      type="button"
                      onClick={() => selectMention(kb)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted flex items-start gap-2.5 transition-colors"
                    >
                      <svg className="h-4 w-4 mt-0.5 text-[#0A7CFF] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                        <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{kb.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {new Date(kb.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything"
              title="Press Enter to send, Shift+Enter for new line, Ctrl/Cmd+Enter to force send"
              rows={1}
              className="w-full bg-background/80 border border-muted-foreground/20 rounded-[18px] pl-4 pr-10 py-2 text-base sm:text-sm focus:outline-none disabled:opacity-50 resize-none touch-manipulation"
              style={{
                minHeight: '32px',
                WebkitTapHighlightColor: 'transparent',
                maxHeight: '200px',
                overflowY: 'hidden',
              }}
            />
            {/* Show send button for mobile when there's text */}
            {isMobileView && message.trim() && (
              <button
                type="button"
                onClick={handleSend}
                disabled={!message.trim()}
                className="absolute right-2 bottom-2 bg-[#0A7CFF] rounded-full p-1 text-white font-bold transition-colors"
                aria-label="Send message"
              >
                <svg
                  className="h-4 w-4"
                  strokeWidth={3}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path d="M5 12l14 0M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

