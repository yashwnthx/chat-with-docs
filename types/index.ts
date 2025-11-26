export type GeminiModel = "text" | "image";

export interface Recipient {
  id: string;
  name: string;
  avatar?: string;
  bio?: string;
  title?: string;
}

export type ReactionType =
  | "heart"
  | "like"
  | "dislike"
  | "laugh"
  | "emphasize"
  | "question";

export interface Reaction {
  type: ReactionType;
  sender: string;
  timestamp: string;
}

export interface Message {
  id: string;
  content: string;
  htmlContent?: string; // For TipTap editor content
  sender: "me" | "bot" | "system" | string;
  timestamp: string;
  reactions?: Reaction[];
  type?: "text" | "image" | "system" | "silenced";
  imageUrl?: string; // For generated images
  mentions?: { id: string; name: string }[];
  sources?: string; // JSON string or comma-separated list of sources
}

export interface KnowledgeBase {
  id: string;
  name: string;
  content?: string;
  documentCount?: number;
  uploadedAt?: string;
  createdAt?: string;
}

export interface Conversation {
  id: string;
  name?: string; // Optional custom name
  recipients: Recipient[]; // Will be AI Assistant
  messages: Message[];
  lastMessageTime: string;
  unreadCount?: number;
  pinned?: boolean;
  hideAlerts?: boolean;
  isTyping?: boolean;
  model?: GeminiModel; // "text" or "image" - optional, defaults to text
  knowledgeBase?: KnowledgeBase; // Optional knowledge base for context
}
