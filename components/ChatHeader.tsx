'use client';

import { ThemeToggle } from "./theme-toggle";

interface ChatHeaderProps {
  onShowKnowledge?: () => void;
  conversationName?: string;
  onShowMobileSidebar?: () => void;
  onShowSearch?: () => void;
}

export function ChatHeader({ onShowKnowledge, conversationName, onShowMobileSidebar, onShowSearch }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 h-16 bg-background/50 backdrop-blur-md border-b border-border/40">
      <div className="flex items-center gap-2 flex-1">
        {onShowMobileSidebar && (
          <button
            onClick={onShowMobileSidebar}
            className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex items-center justify-center flex-1">
        <h1 className="text-sm font-semibold text-foreground truncate max-w-[200px]">
          {conversationName || 'Chat with Docs'}
        </h1>
      </div>
      <div className="flex items-center justify-end flex-1 gap-2">
        {onShowSearch && (
          <button
            onClick={onShowSearch}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Search Messages"
            title="Search in conversation (Cmd/Ctrl+F)"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        )}
        {onShowKnowledge && (
          <button
            onClick={onShowKnowledge}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Knowledge Base"
            title="Knowledge Base (Cmd/Ctrl+K)"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}
