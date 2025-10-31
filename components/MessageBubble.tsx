'use client';

import { memo, useState } from 'react';
import { cn } from "@/lib/utils";
import { Message } from "@/types";
import { useTheme } from "next-themes";
import { FormattedMessage } from "./FormattedMessage";
import { useToast } from "@/hooks/use-toast";

interface MessageBubbleProps {
  message: Message;
  isTyping?: boolean;
  isLastUserMessage?: boolean;
  justSent?: boolean;
  isMobileView?: boolean;
  isFirstMessage?: boolean; // Add prop to identify first message
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isTyping,
  isLastUserMessage,
  justSent,
  isMobileView = false,
  isFirstMessage = false
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
    <div className="flex w-full flex-col relative z-10">
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
                <div className="text-[14px] whitespace-pre-wrap">
                  {isMe ? (
                    message.content
                  ) : (
                    <FormattedMessage content={message.content} sources={message.sources} />
                  )}
                </div>
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
