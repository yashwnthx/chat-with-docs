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
                  // Extract sources from <<SOURCE: doc name>> tags in content
                  const sourceRegex = /<<SOURCE:\s*([^>]+)>>/g;
                  const extractedSources: string[] = [];
                  let match;
                  while ((match = sourceRegex.exec(message.content)) !== null) {
                    const sourceName = match[1].trim();
                    if (sourceName && !extractedSources.includes(sourceName)) {
                      extractedSources.push(sourceName);
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

                      {/* Sources Section - Show extracted sources for bot messages */}
                      {!isMe && extractedSources.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" clipRule="evenodd" d="M11.2598 2.25191C11.8396 2.25191 12.2381 2.24808 12.6201 2.33981L12.8594 2.40719C13.0957 2.48399 13.3228 2.5886 13.5352 2.71871L13.6582 2.79879C13.9416 2.99641 14.1998 3.25938 14.5586 3.61813L15.5488 4.60836L15.833 4.89449C16.0955 5.16136 16.2943 5.38072 16.4482 5.6318L16.5703 5.84957C16.6829 6.07074 16.7691 6.30495 16.8271 6.54684L16.8574 6.69137C16.918 7.0314 16.915 7.39998 16.915 7.90719V13.0839C16.915 13.7728 16.9157 14.3301 16.8789 14.7802C16.8461 15.1808 16.781 15.5417 16.6367 15.8779L16.5703 16.0205C16.3049 16.5413 15.9008 16.9772 15.4053 17.2812L15.1865 17.4033C14.8099 17.5951 14.4041 17.6745 13.9463 17.7119C13.4961 17.7487 12.9391 17.749 12.25 17.749H7.75C7.06092 17.749 6.50395 17.7487 6.05371 17.7119C5.65317 17.6791 5.29227 17.6148 4.95606 17.4707L4.81348 17.4033C4.29235 17.1378 3.85586 16.7341 3.55176 16.2382L3.42969 16.0205C3.23787 15.6439 3.15854 15.2379 3.12109 14.7802C3.08432 14.3301 3.08496 13.7728 3.08496 13.0839V6.91695C3.08496 6.228 3.08433 5.67086 3.12109 5.22066C3.1585 4.76296 3.23797 4.35698 3.42969 3.98043C3.73311 3.38494 4.218 2.90008 4.81348 2.59664C5.19009 2.40484 5.59593 2.32546 6.05371 2.28805C6.50395 2.25126 7.06091 2.25191 7.75 2.25191H11.2598ZM7.75 3.58199C7.03896 3.58199 6.54563 3.58288 6.16211 3.61422C5.78642 3.64492 5.575 3.70168 5.41699 3.78219C5.0718 3.95811 4.79114 4.23874 4.61524 4.58395C4.53479 4.74193 4.47795 4.95354 4.44727 5.32906C4.41595 5.71254 4.41504 6.20609 4.41504 6.91695V13.0839C4.41504 13.7947 4.41594 14.2884 4.44727 14.6718C4.47798 15.0472 4.53477 15.259 4.61524 15.417L4.68555 15.5429C4.86186 15.8304 5.11487 16.0648 5.41699 16.2187L5.54688 16.2744C5.69065 16.3258 5.88016 16.3636 6.16211 16.3867C6.54563 16.418 7.03898 16.4189 7.75 16.4189H12.25C12.961 16.4189 13.4544 16.418 13.8379 16.3867C14.2135 16.356 14.425 16.2992 14.583 16.2187L14.709 16.1474C14.9963 15.9712 15.2308 15.7189 15.3848 15.417L15.4414 15.2861C15.4927 15.1425 15.5297 14.953 15.5527 14.6718C15.5841 14.2884 15.585 13.7947 15.585 13.0839V8.55758L13.3506 8.30953C12.2572 8.18804 11.3976 7.31827 11.2881 6.22359L11.0234 3.58199H7.75ZM12.6113 6.09176C12.6584 6.56193 13.0275 6.93498 13.4971 6.98727L15.5762 7.21871C15.5727 7.13752 15.5686 7.07109 15.5615 7.01266L15.5342 6.85738C15.5005 6.7171 15.4501 6.58135 15.3848 6.45309L15.3145 6.32711C15.2625 6.24233 15.1995 6.16135 15.0928 6.04488L14.6084 5.54879L13.6182 4.55856C13.2769 4.21733 13.1049 4.04904 12.9688 3.94234L12.8398 3.8525C12.7167 3.77705 12.5853 3.71637 12.4482 3.67184L12.3672 3.6484L12.6113 6.09176Z"></path>
                            </svg>
                            <span className="font-medium">Source:</span>
                            <span className="text-gray-600 dark:text-gray-300">
                              {extractedSources.join(', ')}
                            </span>
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
