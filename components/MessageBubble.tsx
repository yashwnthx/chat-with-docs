'use client';

import { memo, useState } from 'react';
import { cn } from "@/lib/utils";
import { Message } from "@/types";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  message: Message;
  isTyping?: boolean;
  isLastUserMessage?: boolean;
  justSent?: boolean;
  isMobileView?: boolean;
  isFirstMessage?: boolean; // Add prop to identify first message
  animate?: boolean; // Only animate when explicitly requested to prevent flicker
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isTyping,
  isLastUserMessage,
  justSent,
  isMobileView = false,
  isFirstMessage = false,
  animate = false,
}: MessageBubbleProps) {
  const { theme, systemTheme } = useTheme();
  const effectiveTheme = theme === "system" ? systemTheme : theme;
  const isMe = message.sender === "me";
  const [showCopied, setShowCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setShowCopied(true);
      toast({
        title: "Copied!",
        description: "Message copied to clipboard",
      });
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy message",
        variant: "destructive",
      });
    }
  };

  const rightBubbleSvg =
    effectiveTheme === "dark"
      ? "/messages/message-bubbles/right-bubble-dark.svg"
      : "/messages/message-bubbles/right-bubble-light.svg";
  const leftBubbleSvg =
    effectiveTheme === "dark"
      ? "/messages/message-bubbles/left-bubble-dark.svg"
      : "/messages/message-bubbles/left-bubble-light.svg";
  const typingIndicatorSvg =
    effectiveTheme === "dark"
      ? "/messages/typing-bubbles/chat-typing-dark.svg"
      : "/messages/typing-bubbles/chat-typing-light.svg";

  const typingAnimation = `
  @keyframes blink {
    0% { opacity: 0.3; }
    20% { opacity: 1; }
    100% { opacity: 0.3; }
  }
  `;

  return (
    <div className={cn(
      "flex w-full flex-col relative z-10",
      animate && "animate-in fade-in slide-in-from-bottom-2 duration-300"
    )}>
      {/* Spacer before messages */}
      <div className="h-1 bg-background" />

      <div className="flex">
        {/* Left spacer for blue messages */}
        {isMe && <div className="flex-1 bg-background" />}

        {/* Message bubble container */}
        <div
          className={cn(
            "group relative max-w-[75%] break-words flex-none",
            isTyping
              ? "border-[17px] border-solid border-l-[22px] bg-gray-100 dark:bg-[#404040] text-gray-900 dark:text-gray-100"
              : isMe
              ? cn(
                  "border-[17px] border-solid border-r-[22px] text-white",
                  isMobileView
                    ? "bg-[#0A7CFF]"
                    : "bg-[linear-gradient(#47B5FF,#0A7CFF)] bg-fixed"
                )
              : "border-[17px] border-solid border-l-[22px] bg-gray-100 dark:bg-[#404040] text-gray-900 dark:text-gray-100"
          )}
          style={{
            borderImageSlice: isMe ? "31 43 31 31" : "31 31 31 43",
            borderImageSource: `url('${
              isMe
                ? rightBubbleSvg
                : isTyping
                ? typingIndicatorSvg
                : leftBubbleSvg
            }')`,
          }}
        >
              <div className={cn(!isTyping && "-my-2.5 -mx-1")}>
                {/* Add this to cover up the right border */}
                <div
                  className={cn(
                    "absolute border-r-[0.5px] border-background",
                    !isMe || isTyping ? "inset-[-17px]" : "inset-[-22px]"
                  )}
                />

                {/* Copy Button - Show on tap/hover */}
                {/* Position below message if it's the first one to avoid header overlap */}
                {!isTyping && (
                  <div className={cn(
                    "absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity z-50",
                    isFirstMessage ? "top-full mt-1" : "-top-8"
                  )}>
                    <button
                      onClick={handleCopyMessage}
                      className="text-[10px] text-muted-foreground px-2 py-0.5 rounded bg-background/90 backdrop-blur-sm hover:bg-background flex items-center gap-1 transition-colors shadow-sm border border-border/50"
                      title="Copy message"
                    >
                      {showCopied ? (
                        <>
                          <svg className="h-3 w-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {isTyping ? (
              <div className="flex flex-col">
                <div className="text-[14px] flex items-center">
                  <div className="flex items-center justify-center gap-[4px] bg-gray-100 dark:bg-[#404040]">
                    <style>{typingAnimation}</style>
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-gray-500 dark:bg-gray-300"
                      style={{ animation: "blink 1.4s infinite linear" }}
                    />
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-gray-500 dark:bg-gray-300"
                      style={{
                        animation: "blink 1.4s infinite linear 0.2s",
                      }}
                    />
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-gray-500 dark:bg-gray-300"
                      style={{
                        animation: "blink 1.4s infinite linear 0.4s",
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                {(() => {
                  // Extract sources from <<SOURCE: doc name | Page X>> or <<SOURCE: doc name>> tags
                  const sourceRegex = /<<SOURCE:\s*([^|>]+?)(?:\s*\|\s*([^>]+))?>>/g;
                  const extractedSources: Array<{ name: string; pages: string }> = [];
                  let match;
                  while ((match = sourceRegex.exec(message.content)) !== null) {
                    const sourceName = match[1].trim();
                    const pages = match[2]?.trim() || '';
                    if (sourceName) {
                      // Check if source already exists
                      const existing = extractedSources.find(s => s.name === sourceName);
                      if (existing) {
                        // Merge pages
                        if (pages && !existing.pages.includes(pages)) {
                          existing.pages = existing.pages ? `${existing.pages}, ${pages}` : pages;
                        }
                      } else {
                        extractedSources.push({ name: sourceName, pages });
                      }
                    }
                  }

                  // Remove source tags from displayed content
                  const cleanContent = message.content
                    .replace(/<<SOURCE:\s*[^>]+>>/g, '')
                    .trim();

                  return (
                    <>
                      <div className="text-[14px]">
                        {isMe ? (
                          <span className="whitespace-pre-wrap">{message.content}</span>
                        ) : (
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                              ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="ml-1">{children}</li>,
                              h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                              code: ({ children }) => <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-[13px]">{children}</code>,
                              pre: ({ children }) => <pre className="bg-black/10 dark:bg-white/10 p-2 rounded mb-2 overflow-x-auto text-[13px]">{children}</pre>,
                            }}
                          >
                            {cleanContent}
                          </ReactMarkdown>
                        )}
                      </div>

                      {/* Sources - clean iMessage style */}
                      {!isMe && extractedSources.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-gray-200/50 dark:border-gray-600/30">
                          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
                            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                              <path d="M4.33496 12.5V7.5C4.33496 7.13273 4.63273 6.83496 5 6.83496C5.36727 6.83496 5.66504 7.13273 5.66504 7.5V12.5C5.66504 14.8942 7.60585 16.835 10 16.835C12.3942 16.835 14.335 14.8942 14.335 12.5V5.83301C14.3348 4.35959 13.1404 3.16522 11.667 3.16504C10.1934 3.16504 8.99822 4.35948 8.99805 5.83301V12.5C8.99805 13.0532 9.44679 13.502 10 13.502C10.5532 13.502 11.002 13.0532 11.002 12.5V7.5C11.002 7.13273 11.2997 6.83496 11.667 6.83496C12.0341 6.83514 12.332 7.13284 12.332 7.5V12.5C12.332 13.7877 11.2877 14.832 10 14.832C8.71226 14.832 7.66797 13.7877 7.66797 12.5V5.83301C7.66814 3.62494 9.45888 1.83496 11.667 1.83496C13.875 1.83514 15.6649 3.62505 15.665 5.83301V12.5C15.665 15.6287 13.1287 18.165 10 18.165C6.87131 18.165 4.33496 15.6287 4.33496 12.5Z"/>
                            </svg>
                            References
                          </div>
                          <div className="space-y-1">
                            {extractedSources.map((source, index) => {
                              // Clean up document name - keep it readable
                              const cleanName = source.name
                                .replace(/^\[.*?\]\s*/, '')
                                .replace(/\s*\(\d+\s*pages?\)$/i, '')
                                .replace(/\.pdf$/i, '')
                                .replace(/^(PRI|PRIs|CVs)\s*(Modual|Module)\s*\d*\s*/i, '')
                                .replace(/_/g, ' ')
                                .trim();

                              // Format page numbers clearly
                              let pageDisplay = '';
                              if (source.pages) {
                                const cleaned = source.pages
                                  .replace(/Pages?\s*/gi, '')
                                  .replace(/Chapter\s*/gi, 'Ch. ')
                                  .trim();
                                if (cleaned) {
                                  // Check if it's multiple pages
                                  const hasMultiple = cleaned.includes(',') || cleaned.includes('-');
                                  pageDisplay = hasMultiple ? `Pages ${cleaned}` : `Page ${cleaned}`;
                                }
                              }

                              return (
                                <div
                                  key={index}
                                  className="flex items-start gap-1.5 text-[11px]"
                                >
                                  <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{index + 1}.</span>
                                  <span className="text-gray-700 dark:text-gray-200 font-medium">{cleanName}</span>
                                  {pageDisplay && (
                                    <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">
                                      — {pageDisplay}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Right spacer for gray messages */}
        {!isMe && <div className="flex-1 bg-background" />}
      </div>

      {/* Show "Delivered" for last message from current user */}
      {isMe && isLastUserMessage && !isTyping && (
        <div className="text-[10px] text-gray-500 pt-1 pr-1 bg-background text-right">
          <span className={cn(justSent && "animate-scale-in")}>Delivered</span>
        </div>
      )}

      {/* Spacer after messages */}
      <div className="h-1 bg-background" />
    </div>
  );
});
