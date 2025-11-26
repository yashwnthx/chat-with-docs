import { Message, Reaction, ReactionType } from "@/types";

type MessageQueueCallbacks = {
  onMessageGenerated: (
    messageId: string,
    content: string,
    sender: string,
    isComplete: boolean
  ) => void;
  onTypingStatusChange: (isTyping: boolean, sender: string) => void;
  onError: (error: Error) => void;
  onReactionGenerated?: (messageId: string, reaction: Reaction) => void;
};

export class AIMessageQueue {
  private callbacks: MessageQueueCallbacks;
  private processingQueue: Promise<void> = Promise.resolve();
  private chatId: string | null = null;
  private knowledgeIds: string[] = [];
  private onChatIdUpdate?: (chatId: string) => void;

  constructor(callbacks: MessageQueueCallbacks) {
    this.callbacks = callbacks;
  }

  setChatId(chatId: string | null) {
    this.chatId = chatId;
  }

  setKnowledgeIds(knowledgeIds: string[]) {
    this.knowledgeIds = knowledgeIds;
  }

  setOnChatIdUpdate(callback: (chatId: string) => void) {
    this.onChatIdUpdate = callback;
  }

  async enqueueMessage(
    userMessage: string,
    sender: string,
    conversationHistory: Message[],
    aiName: string
  ) {
    // Chain the new message processing after the current queue
    this.processingQueue = this.processingQueue.then(async () => {
      try {
        await this.processMessage(userMessage, sender, conversationHistory, aiName);
      } catch (error) {
        console.error("Error processing message:", error);
        this.callbacks.onError(
          error instanceof Error ? error : new Error("Unknown error")
        );
      }
    });
  }

  private async processMessage(
    userMessage: string,
    sender: string,
    conversationHistory: Message[],
    aiName: string
  ) {
    // Start typing indicator
    this.callbacks.onTypingStatusChange(true, aiName);

    try {
      // Convert conversation history to API format
      const messages = conversationHistory.map((msg) => ({
        role: msg.sender === "me" ? "user" : "assistant",
        content: msg.content,
      }));

      // Add the current user message
      messages.push({
        role: "user",
        content: userMessage,
      });

      // Call the API endpoint
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages,
          chatId: this.chatId,
          knowledgeIds: this.knowledgeIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      // Update chat ID from response header if available
      const newChatId = response.headers.get("X-Chat-Id");
      if (newChatId) {
        if (!this.chatId) {
          this.chatId = newChatId;
        }
        // Notify parent component of chat ID update
        if (this.onChatIdUpdate) {
          this.onChatIdUpdate(newChatId);
        }
      }

      // Handle streaming response using Vercel AI SDK format
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      const messageId = `ai-${Date.now()}`;

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          // Vercel AI SDK data stream format: "0:{"type":"text-delta","textDelta":"..."}"
          if (line.startsWith("0:")) {
            try {
              const data = JSON.parse(line.slice(2));
              if (data.type === "text-delta" && data.textDelta) {
                fullResponse += data.textDelta;
                this.callbacks.onMessageGenerated(
                  messageId,
                  fullResponse,
                  aiName,
                  false
                );
              } else if (data.type === "finish") {
                break;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      // Handle any remaining buffer
      if (buffer.trim()) {
        try {
          if (buffer.startsWith("0:")) {
            const data = JSON.parse(buffer.slice(2));
            if (data.type === "text-delta" && data.textDelta) {
              fullResponse += data.textDelta;
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Final complete message
      if (fullResponse) {
        this.callbacks.onMessageGenerated(messageId, fullResponse, aiName, true);
      }

      // Occasionally add a reaction (15% chance)
      if (Math.random() < 0.15 && this.callbacks.onReactionGenerated) {
        const reactionTypes: ReactionType[] = [
          "heart",
          "like",
          "laugh",
          "emphasize",
        ];
        const randomReaction =
          reactionTypes[Math.floor(Math.random() * reactionTypes.length)];

        // Get the last user message ID
        const lastUserMessage = conversationHistory
          .filter((m) => m.sender === sender)
          .pop();

        if (lastUserMessage) {
          setTimeout(() => {
            if (this.callbacks.onReactionGenerated) {
              this.callbacks.onReactionGenerated(lastUserMessage.id, {
                type: randomReaction,
                sender: aiName,
                timestamp: new Date().toISOString(),
              });
            }
          }, 1000 + Math.random() * 2000);
        }
      }
    } catch (error) {
      console.error("Error generating AI response:", error);
      this.callbacks.onError(
        error instanceof Error ? error : new Error("Failed to generate response")
      );
    } finally {
      // Stop typing indicator
      this.callbacks.onTypingStatusChange(false, aiName);
    }
  }

  clearQueue() {
    // Reset the processing queue
    this.processingQueue = Promise.resolve();
    this.callbacks.onTypingStatusChange(false, "");
  }
}
