'use client';

import { FormEvent, ChangeEvent, useState, useRef, useEffect, memo } from 'react';
import { Knowledge } from '@prisma/client';
import { soundEffects } from '@/lib/sound-effects';
import { DocumentIcon } from './icons/AppleIcons';

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

const ChatInput = memo(function ChatInput({
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

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`; // max-h-32 = 128px

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

    // Remove the @ and any search text from input
    const text = input;
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      // Remove everything from @ onwards (the @ and search text)
      const beforeMention = text.slice(0, lastAtIndex);
      const newText = beforeMention;
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

  // Auto-resize textarea when input changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
    }
  }, [input]);

  const selectedKnowledgeObjects = knowledgeBases
    .filter(kb => selectedKnowledge.includes(kb.id));

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
      {/* Input Form */}
      <form onSubmit={onSubmit} className="p-3 sm:p-4">
        <div className="flex items-end gap-2 max-w-3xl mx-auto relative">
          {/* @ Mention Dropdown */}
          {showMentions && filteredKnowledge.length > 0 && (
            <div className="absolute bottom-full left-12 mb-2 w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden z-10">
              <div className="p-1.5 space-y-0.5 max-h-64 overflow-y-auto custom-scrollbar">
                {filteredKnowledge.map(kb => (
                  <button
                    key={kb.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectMention(kb);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.06] active:scale-[0.98] flex items-center gap-2.5 transition-all"
                  >
                    <svg className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" clipRule="evenodd" d="M11.2598 2.25191C11.8396 2.25191 12.2381 2.24808 12.6201 2.33981L12.8594 2.40719C13.0957 2.48399 13.3228 2.5886 13.5352 2.71871L13.6582 2.79879C13.9416 2.99641 14.1998 3.25938 14.5586 3.61813L15.5488 4.60836L15.833 4.89449C16.0955 5.16136 16.2943 5.38072 16.4482 5.6318L16.5703 5.84957C16.6829 6.07074 16.7691 6.30495 16.8271 6.54684L16.8574 6.69137C16.918 7.0314 16.915 7.39998 16.915 7.90719V13.0839C16.915 13.7728 16.9157 14.3301 16.8789 14.7802C16.8461 15.1808 16.781 15.5417 16.6367 15.8779L16.5703 16.0205C16.3049 16.5413 15.9008 16.9772 15.4053 17.2812L15.1865 17.4033C14.8099 17.5951 14.4041 17.6745 13.9463 17.7119C13.4961 17.7487 12.9391 17.749 12.25 17.749H7.75C7.06092 17.749 6.50395 17.7487 6.05371 17.7119C5.65317 17.6791 5.29227 17.6148 4.95606 17.4707L4.81348 17.4033C4.29235 17.1378 3.85586 16.7341 3.55176 16.2382L3.42969 16.0205C3.23787 15.6439 3.15854 15.2379 3.12109 14.7802C3.08432 14.3301 3.08496 13.7728 3.08496 13.0839V6.91695C3.08496 6.228 3.08433 5.67086 3.12109 5.22066C3.1585 4.76296 3.23797 4.35698 3.42969 3.98043C3.73311 3.38494 4.218 2.90008 4.81348 2.59664C5.19009 2.40484 5.59593 2.32546 6.05371 2.28805C6.50395 2.25126 7.06091 2.25191 7.75 2.25191H11.2598ZM7.75 3.58199C7.03896 3.58199 6.54563 3.58288 6.16211 3.61422C5.78642 3.64492 5.575 3.70168 5.41699 3.78219C5.0718 3.95811 4.79114 4.23874 4.61524 4.58395C4.53479 4.74193 4.47795 4.95354 4.44727 5.32906C4.41595 5.71254 4.41504 6.20609 4.41504 6.91695V13.0839C4.41504 13.7947 4.41594 14.2884 4.44727 14.6718C4.47798 15.0472 4.53477 15.259 4.61524 15.417L4.68555 15.5429C4.86186 15.8304 5.11487 16.0648 5.41699 16.2187L5.54688 16.2744C5.69065 16.3258 5.88016 16.3636 6.16211 16.3867C6.54563 16.418 7.03898 16.4189 7.75 16.4189H12.25C12.961 16.4189 13.4544 16.418 13.8379 16.3867C14.2135 16.356 14.425 16.2992 14.583 16.2187L14.709 16.1474C14.9963 15.9712 15.2308 15.7189 15.3848 15.417L15.4414 15.2861C15.4927 15.1425 15.5297 14.953 15.5527 14.6718C15.5841 14.2884 15.585 13.7947 15.585 13.0839V8.55758L13.3506 8.30953C12.2572 8.18804 11.3976 7.31827 11.2881 6.22359L11.0234 3.58199H7.75ZM12.6113 6.09176C12.6584 6.56193 13.0275 6.93498 13.4971 6.98727L15.5762 7.21871C15.5727 7.13752 15.5686 7.07109 15.5615 7.01266L15.5342 6.85738C15.5005 6.7171 15.4501 6.58135 15.3848 6.45309L15.3145 6.32711C15.2625 6.24233 15.1995 6.16135 15.0928 6.04488L14.6084 5.54879L13.6182 4.55856C13.2769 4.21733 13.1049 4.04904 12.9688 3.94234L12.8398 3.8525C12.7167 3.77705 12.5853 3.71637 12.4482 3.67184L12.3672 3.6484L12.6113 6.09176Z"></path>
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[13px] truncate text-gray-900 dark:text-white leading-tight">{kb.name}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
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
            onClick={(e) => {
              e.stopPropagation();
              onShowKnowledgePanel?.();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-95 text-gray-600 dark:text-gray-400"
            aria-label="Documents"
            title="Add documents"
            data-knowledge-button="true"
          >
            <DocumentIcon className="h-5 w-5" />
          </button>

          <div className="flex-1 relative">
            {/* Selected Knowledge Cards - ChatGPT Style */}
            {selectedKnowledgeObjects.length > 0 && (
              <div className="mb-3 -mt-2">
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2 px-1 no-scrollbar">
                  {selectedKnowledgeObjects.map((kb, index) => (
                    <div
                      key={kb.id}
                      className="group relative inline-block animate-in fade-in duration-200"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="relative overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all">
                        <div className="p-2 w-64">
                          <div className="flex flex-row items-center gap-2">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                              <div className="flex items-center justify-center rounded-lg h-10 w-10 shrink-0 bg-blue-500">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white">
                                  <path fillRule="evenodd" clipRule="evenodd" d="M11.2598 2.25191C11.8396 2.25191 12.2381 2.24808 12.6201 2.33981L12.8594 2.40719C13.0957 2.48399 13.3228 2.5886 13.5352 2.71871L13.6582 2.79879C13.9416 2.99641 14.1998 3.25938 14.5586 3.61813L15.5488 4.60836L15.833 4.89449C16.0955 5.16136 16.2943 5.38072 16.4482 5.6318L16.5703 5.84957C16.6829 6.07074 16.7691 6.30495 16.8271 6.54684L16.8574 6.69137C16.918 7.0314 16.915 7.39998 16.915 7.90719V13.0839C16.915 13.7728 16.9157 14.3301 16.8789 14.7802C16.8461 15.1808 16.781 15.5417 16.6367 15.8779L16.5703 16.0205C16.3049 16.5413 15.9008 16.9772 15.4053 17.2812L15.1865 17.4033C14.8099 17.5951 14.4041 17.6745 13.9463 17.7119C13.4961 17.7487 12.9391 17.749 12.25 17.749H7.75C7.06092 17.749 6.50395 17.7487 6.05371 17.7119C5.65317 17.6791 5.29227 17.6148 4.95606 17.4707L4.81348 17.4033C4.29235 17.1378 3.85586 16.7341 3.55176 16.2382L3.42969 16.0205C3.23787 15.6439 3.15854 15.2379 3.12109 14.7802C3.08432 14.3301 3.08496 13.7728 3.08496 13.0839V6.91695C3.08496 6.228 3.08433 5.67086 3.12109 5.22066C3.1585 4.76296 3.23797 4.35698 3.42969 3.98043C3.73311 3.38494 4.218 2.90008 4.81348 2.59664C5.19009 2.40484 5.59593 2.32546 6.05371 2.28805C6.50395 2.25126 7.06091 2.25191 7.75 2.25191H11.2598ZM7.75 3.58199C7.03896 3.58199 6.54563 3.58288 6.16211 3.61422C5.78642 3.64492 5.575 3.70168 5.41699 3.78219C5.0718 3.95811 4.79114 4.23874 4.61524 4.58395C4.53479 4.74193 4.47795 4.95354 4.44727 5.32906C4.41595 5.71254 4.41504 6.20609 4.41504 6.91695V13.0839C4.41504 13.7947 4.41594 14.2884 4.44727 14.6718C4.47798 15.0472 4.53477 15.259 4.61524 15.417L4.68555 15.5429C4.86186 15.8304 5.11487 16.0648 5.41699 16.2187L5.54688 16.2744C5.69065 16.3258 5.88016 16.3636 6.16211 16.3867C6.54563 16.418 7.03898 16.4189 7.75 16.4189H12.25C12.961 16.4189 13.4544 16.418 13.8379 16.3867C14.2135 16.356 14.425 16.2992 14.583 16.2187L14.709 16.1474C14.9963 15.9712 15.2308 15.7189 15.3848 15.417L15.4414 15.2861C15.4927 15.1425 15.5297 14.953 15.5527 14.6718C15.5841 14.2884 15.585 13.7947 15.585 13.0839V8.55758L13.3506 8.30953C12.2572 8.18804 11.3976 7.31827 11.2881 6.22359L11.0234 3.58199H7.75ZM12.6113 6.09176C12.6584 6.56193 13.0275 6.93498 13.4971 6.98727L15.5762 7.21871C15.5727 7.13752 15.5686 7.07109 15.5615 7.01266L15.5342 6.85738C15.5005 6.7171 15.4501 6.58135 15.3848 6.45309L15.3145 6.32711C15.2625 6.24233 15.1995 6.16135 15.0928 6.04488L14.6084 5.54879L13.6182 4.55856C13.2769 4.21733 13.1049 4.04904 12.9688 3.94234L12.8398 3.8525C12.7167 3.77705 12.5853 3.71637 12.4482 3.67184L12.3672 3.6484L12.6113 6.09176Z"></path>
                                </svg>
                              </div>
                            </div>
                            <div className="overflow-hidden flex-1">
                              <div className="truncate font-semibold text-sm text-gray-900 dark:text-gray-100">{kb.name}</div>
                              <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                                {(kb as any).fileType?.toUpperCase() || 'DOC'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="absolute end-1.5 top-1.5 inline-flex gap-1">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleKnowledge(kb.id);
                          }}
                          aria-label="Remove file"
                          className="transition-colors flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-white dark:bg-white/90 dark:text-black hover:bg-black dark:hover:bg-white"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="icon-sm">
                            <path d="M11.1152 3.91503C11.3868 3.73594 11.756 3.7658 11.9951 4.00488C12.2341 4.24395 12.264 4.61309 12.0849 4.88476L11.9951 4.99511L8.99018 7.99999L11.9951 11.0049L12.0849 11.1152C12.264 11.3869 12.2341 11.756 11.9951 11.9951C11.756 12.2342 11.3868 12.2641 11.1152 12.085L11.0048 11.9951L7.99995 8.99023L4.99506 11.9951C4.7217 12.2685 4.2782 12.2685 4.00483 11.9951C3.73146 11.7217 3.73146 11.2782 4.00483 11.0049L7.00971 7.99999L4.00483 4.99511L3.91499 4.88476C3.73589 4.61309 3.76575 4.24395 4.00483 4.00488C4.24391 3.7658 4.61305 3.73594 4.88471 3.91503L4.99506 4.00488L7.99995 7.00976L11.0048 4.00488L11.1152 3.91503Z"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="message"
              disabled={isLoading}
              rows={1}
              className="w-full resize-none rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 max-h-32 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all"
              style={{
                minHeight: '38px',
                height: 'auto',
                paddingTop: '10px',
                paddingBottom: '10px',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white transition-all hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-500 active:scale-95 shadow-sm"
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
});

export default ChatInput;

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  message: string;
  setMessage: (text: string) => void;
  isMobileView?: boolean;
  knowledgeBases?: { id: string; name: string; content: string; createdAt: string }[];
  selectedKnowledge?: string[];
  onToggleKnowledge?: (id: string) => void;
}

export const MessageInput = memo(function MessageInput({
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

    // Remove the @ and any search text from input
    const lastAtIndex = message.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      // Remove everything from @ onwards
      const beforeMention = message.slice(0, lastAtIndex);
      setMessage(beforeMention);
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
    <div className="bg-background backdrop-blur-md shadow-lg">
      {/* Selected Knowledge Cards - ChatGPT Style */}
      {selectedKnowledgeBases.length > 0 && (
        <div className="px-4 pt-3">
          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2 no-scrollbar">
            {selectedKnowledgeBases.map((kb, index) => (
              <div
                key={kb.id}
                className="group relative inline-block animate-in fade-in duration-200"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="relative overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all">
                  <div className="p-2 w-64">
                    <div className="flex flex-row items-center gap-2">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                        <div className="flex items-center justify-center rounded-lg h-10 w-10 shrink-0 bg-blue-500">
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white">
                            <path fillRule="evenodd" clipRule="evenodd" d="M11.2598 2.25191C11.8396 2.25191 12.2381 2.24808 12.6201 2.33981L12.8594 2.40719C13.0957 2.48399 13.3228 2.5886 13.5352 2.71871L13.6582 2.79879C13.9416 2.99641 14.1998 3.25938 14.5586 3.61813L15.5488 4.60836L15.833 4.89449C16.0955 5.16136 16.2943 5.38072 16.4482 5.6318L16.5703 5.84957C16.6829 6.07074 16.7691 6.30495 16.8271 6.54684L16.8574 6.69137C16.918 7.0314 16.915 7.39998 16.915 7.90719V13.0839C16.915 13.7728 16.9157 14.3301 16.8789 14.7802C16.8461 15.1808 16.781 15.5417 16.6367 15.8779L16.5703 16.0205C16.3049 16.5413 15.9008 16.9772 15.4053 17.2812L15.1865 17.4033C14.8099 17.5951 14.4041 17.6745 13.9463 17.7119C13.4961 17.7487 12.9391 17.749 12.25 17.749H7.75C7.06092 17.749 6.50395 17.7487 6.05371 17.7119C5.65317 17.6791 5.29227 17.6148 4.95606 17.4707L4.81348 17.4033C4.29235 17.1378 3.85586 16.7341 3.55176 16.2382L3.42969 16.0205C3.23787 15.6439 3.15854 15.2379 3.12109 14.7802C3.08432 14.3301 3.08496 13.7728 3.08496 13.0839V6.91695C3.08496 6.228 3.08433 5.67086 3.12109 5.22066C3.1585 4.76296 3.23797 4.35698 3.42969 3.98043C3.73311 3.38494 4.218 2.90008 4.81348 2.59664C5.19009 2.40484 5.59593 2.32546 6.05371 2.28805C6.50395 2.25126 7.06091 2.25191 7.75 2.25191H11.2598ZM7.75 3.58199C7.03896 3.58199 6.54563 3.58288 6.16211 3.61422C5.78642 3.64492 5.575 3.70168 5.41699 3.78219C5.0718 3.95811 4.79114 4.23874 4.61524 4.58395C4.53479 4.74193 4.47795 4.95354 4.44727 5.32906C4.41595 5.71254 4.41504 6.20609 4.41504 6.91695V13.0839C4.41504 13.7947 4.41594 14.2884 4.44727 14.6718C4.47798 15.0472 4.53477 15.259 4.61524 15.417L4.68555 15.5429C4.86186 15.8304 5.11487 16.0648 5.41699 16.2187L5.54688 16.2744C5.69065 16.3258 5.88016 16.3636 6.16211 16.3867C6.54563 16.418 7.03898 16.4189 7.75 16.4189H12.25C12.961 16.4189 13.4544 16.418 13.8379 16.3867C14.2135 16.356 14.425 16.2992 14.583 16.2187L14.709 16.1474C14.9963 15.9712 15.2308 15.7189 15.3848 15.417L15.4414 15.2861C15.4927 15.1425 15.5297 14.953 15.5527 14.6718C15.5841 14.2884 15.585 13.7947 15.585 13.0839V8.55758L13.3506 8.30953C12.2572 8.18804 11.3976 7.31827 11.2881 6.22359L11.0234 3.58199H7.75ZM12.6113 6.09176C12.6584 6.56193 13.0275 6.93498 13.4971 6.98727L15.5762 7.21871C15.5727 7.13752 15.5686 7.07109 15.5615 7.01266L15.5342 6.85738C15.5005 6.7171 15.4501 6.58135 15.3848 6.45309L15.3145 6.32711C15.2625 6.24233 15.1995 6.16135 15.0928 6.04488L14.6084 5.54879L13.6182 4.55856C13.2769 4.21733 13.1049 4.04904 12.9688 3.94234L12.8398 3.8525C12.7167 3.77705 12.5853 3.71637 12.4482 3.67184L12.3672 3.6484L12.6113 6.09176Z"></path>
                          </svg>
                        </div>
                      </div>
                      <div className="overflow-hidden flex-1">
                        <div className="truncate font-semibold text-sm text-gray-900 dark:text-gray-100">{kb.name}</div>
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {(kb as any).fileType?.toUpperCase() || 'DOC'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute end-1.5 top-1.5 inline-flex gap-1">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onToggleKnowledge) {
                        onToggleKnowledge(kb.id);
                      }
                    }}
                    aria-label="Remove file"
                    className="transition-colors flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-white dark:bg-white/90 dark:text-black hover:bg-black dark:hover:bg-white"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="icon-sm">
                      <path d="M11.1152 3.91503C11.3868 3.73594 11.756 3.7658 11.9951 4.00488C12.2341 4.24395 12.264 4.61309 12.0849 4.88476L11.9951 4.99511L8.99018 7.99999L11.9951 11.0049L12.0849 11.1152C12.264 11.3869 12.2341 11.756 11.9951 11.9951C11.756 12.2342 11.3868 12.2641 11.1152 12.085L11.0048 11.9951L7.99995 8.99023L4.99506 11.9951C4.7217 12.2685 4.2782 12.2685 4.00483 11.9951C3.73146 11.7217 3.73146 11.2782 4.00483 11.0049L7.00971 7.99999L4.00483 4.99511L3.91499 4.88476C3.73589 4.61309 3.76575 4.24395 4.00483 4.00488C4.24391 3.7658 4.61305 3.73594 4.88471 3.91503L4.99506 4.00488L7.99995 7.00976L11.0048 4.00488L11.1152 3.91503Z"></path>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div
        className="w-full"
        style={{ height: "var(--dynamic-height, 64px)" }}
      >
        <div className="flex gap-2 p-4 h-full">
          <div className="relative w-full">
            {showMentions && filteredKnowledge.length > 0 && (
              <div
                className="absolute bottom-full left-0 mb-2 w-full max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-1.5 space-y-0.5 max-h-64 overflow-y-auto">
                  {filteredKnowledge.map(kb => (
                    <button
                      key={kb.id}
                      type="button"
                      onClick={() => selectMention(kb)}
                      className="w-full text-left px-3 py-3 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.06] active:scale-[0.98] flex items-center gap-2.5 transition-all"
                    >
                      <svg className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" clipRule="evenodd" d="M11.2598 2.25191C11.8396 2.25191 12.2381 2.24808 12.6201 2.33981L12.8594 2.40719C13.0957 2.48399 13.3228 2.5886 13.5352 2.71871L13.6582 2.79879C13.9416 2.99641 14.1998 3.25938 14.5586 3.61813L15.5488 4.60836L15.833 4.89449C16.0955 5.16136 16.2943 5.38072 16.4482 5.6318L16.5703 5.84957C16.6829 6.07074 16.7691 6.30495 16.8271 6.54684L16.8574 6.69137C16.918 7.0314 16.915 7.39998 16.915 7.90719V13.0839C16.915 13.7728 16.9157 14.3301 16.8789 14.7802C16.8461 15.1808 16.781 15.5417 16.6367 15.8779L16.5703 16.0205C16.3049 16.5413 15.9008 16.9772 15.4053 17.2812L15.1865 17.4033C14.8099 17.5951 14.4041 17.6745 13.9463 17.7119C13.4961 17.7487 12.9391 17.749 12.25 17.749H7.75C7.06092 17.749 6.50395 17.7487 6.05371 17.7119C5.65317 17.6791 5.29227 17.6148 4.95606 17.4707L4.81348 17.4033C4.29235 17.1378 3.85586 16.7341 3.55176 16.2382L3.42969 16.0205C3.23787 15.6439 3.15854 15.2379 3.12109 14.7802C3.08432 14.3301 3.08496 13.7728 3.08496 13.0839V6.91695C3.08496 6.228 3.08433 5.67086 3.12109 5.22066C3.1585 4.76296 3.23797 4.35698 3.42969 3.98043C3.73311 3.38494 4.218 2.90008 4.81348 2.59664C5.19009 2.40484 5.59593 2.32546 6.05371 2.28805C6.50395 2.25126 7.06091 2.25191 7.75 2.25191H11.2598ZM7.75 3.58199C7.03896 3.58199 6.54563 3.58288 6.16211 3.61422C5.78642 3.64492 5.575 3.70168 5.41699 3.78219C5.0718 3.95811 4.79114 4.23874 4.61524 4.58395C4.53479 4.74193 4.47795 4.95354 4.44727 5.32906C4.41595 5.71254 4.41504 6.20609 4.41504 6.91695V13.0839C4.41504 13.7947 4.41594 14.2884 4.44727 14.6718C4.47798 15.0472 4.53477 15.259 4.61524 15.417L4.68555 15.5429C4.86186 15.8304 5.11487 16.0648 5.41699 16.2187L5.54688 16.2744C5.69065 16.3258 5.88016 16.3636 6.16211 16.3867C6.54563 16.418 7.03898 16.4189 7.75 16.4189H12.25C12.961 16.4189 13.4544 16.418 13.8379 16.3867C14.2135 16.356 14.425 16.2992 14.583 16.2187L14.709 16.1474C14.9963 15.9712 15.2308 15.7189 15.3848 15.417L15.4414 15.2861C15.4927 15.1425 15.5297 14.953 15.5527 14.6718C15.5841 14.2884 15.585 13.7947 15.585 13.0839V8.55758L13.3506 8.30953C12.2572 8.18804 11.3976 7.31827 11.2881 6.22359L11.0234 3.58199H7.75ZM12.6113 6.09176C12.6584 6.56193 13.0275 6.93498 13.4971 6.98727L15.5762 7.21871C15.5727 7.13752 15.5686 7.07109 15.5615 7.01266L15.5342 6.85738C15.5005 6.7171 15.4501 6.58135 15.3848 6.45309L15.3145 6.32711C15.2625 6.24233 15.1995 6.16135 15.0928 6.04488L14.6084 5.54879L13.6182 4.55856C13.2769 4.21733 13.1049 4.04904 12.9688 3.94234L12.8398 3.8525C12.7167 3.77705 12.5853 3.71637 12.4482 3.67184L12.3672 3.6484L12.6113 6.09176Z"></path>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[14px] truncate text-gray-900 dark:text-white leading-tight">{kb.name}</div>
                        <div className="text-[12px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
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
              className="w-full bg-background/80 border border-muted-foreground/20 rounded-[18px] pl-4 pr-10 py-2 text-base sm:text-sm focus:outline-none disabled:opacity-50 resize-none touch-manipulation transition-all"
              style={{
                minHeight: '32px',
                WebkitTapHighlightColor: 'transparent',
                maxHeight: '200px',
                overflowY: 'hidden',
                paddingTop: '8px',
              }}
            />
            {/* Show send button for mobile when there's text */}
            {isMobileView && message.trim() && (
              <button
                type="button"
                onClick={handleSend}
                disabled={!message.trim()}
                className="absolute right-2 bottom-2 bg-blue-500 rounded-full p-1 text-white font-bold transition-all hover:bg-blue-600 active:scale-95 shadow-sm"
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
});
