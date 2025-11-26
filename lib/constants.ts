/**
 * Application Constants
 * Centralized configuration values for the application
 */

// AI Configuration
export const AI_CONFIG = {
  DEFAULT_MODEL: 'gemini-2.5-flash' as const,
  IMAGE_MODEL: 'gemini-2.5-flash-image-preview' as const,
  DEFAULT_ASSISTANT_NAME: 'AI Assistant' as const,
  MAX_TOKENS: 4096,
  TEMPERATURE: 0.7,
} as const;

// File Upload Limits
export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE_MB: 10,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  ALLOWED_TYPES: ['application/pdf', 'text/plain', 'text/markdown'] as const,
  ALLOWED_EXTENSIONS: ['.pdf', '.txt', '.md'] as const,
} as const;

// UI Constants
export const UI_CONFIG = {
  SIDEBAR_WIDTH_DESKTOP: 280,
  SIDEBAR_WIDTH_MOBILE: '100%',
  MESSAGE_MAX_WIDTH: '75%',
  CHAT_INPUT_MAX_HEIGHT: 200,
  ANIMATION_DURATION_MS: 300,
} as const;

// Rate Limiting
export const RATE_LIMIT = {
  WINDOW_MS: 60 * 1000, // 1 minute
  MAX_REQUESTS: 100,
} as const;

// Message Configuration
export const MESSAGE_CONFIG = {
  TYPING_INDICATOR_DELAY_MS: 500,
  AUTO_SCROLL_THRESHOLD_PX: 100,
  REACTION_PROBABILITY: 0.15,
  ALLOWED_REACTIONS: ['heart', 'like', 'laugh', 'emphasize', 'dislike', 'question'] as const,
} as const;

// Knowledge Base
export const KNOWLEDGE_BASE_CONFIG = {
  MAX_CONTEXT_LENGTH: 10000,
  CHUNK_SIZE: 1000,
  MAX_DOCUMENTS_PER_QUERY: 10,
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  CHAT: '/api/chat',
  CHATS: '/api/chats',
  KNOWLEDGE: '/api/knowledge',
  SHARE: '/api/share',
  HEALTH: '/api/health',
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  THEME: 'theme',
  DEVICE_ID: 'device-id',
  SOUND_ENABLED: 'sound-enabled',
} as const;

// Type exports for better type safety
export type AIModel = typeof AI_CONFIG.DEFAULT_MODEL | typeof AI_CONFIG.IMAGE_MODEL;
export type AllowedFileType = typeof UPLOAD_LIMITS.ALLOWED_TYPES[number];
export type ReactionType = typeof MESSAGE_CONFIG.ALLOWED_REACTIONS[number];
