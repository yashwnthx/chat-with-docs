-- Create tables manually in Supabase SQL Editor
-- Go to https://supabase.com/dashboard/project/thtmqxxribdlvdwvblvh/sql/new
-- Copy and paste this entire SQL

-- Chat table
CREATE TABLE IF NOT EXISTS "Chat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL UNIQUE,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Chat_sessionId_idx" ON "Chat"("sessionId");
CREATE INDEX IF NOT EXISTS "Chat_updatedAt_idx" ON "Chat"("updatedAt");
CREATE INDEX IF NOT EXISTS "Chat_isActive_idx" ON "Chat"("isActive");

-- Message table
CREATE TABLE IF NOT EXISTS "Message" (
    "id" SERIAL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "modelUsed" TEXT,
    "sources" TEXT,
    "imageUrl" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Message_chatId_idx" ON "Message"("chatId");
CREATE INDEX IF NOT EXISTS "Message_timestamp_idx" ON "Message"("timestamp");

-- Knowledge table
CREATE TABLE IF NOT EXISTS "Knowledge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "originalFilename" TEXT NOT NULL DEFAULT '',
    "filePath" TEXT,
    "fileType" TEXT NOT NULL DEFAULT 'txt',
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "documentCount" INTEGER NOT NULL DEFAULT 0,
    "hasImages" BOOLEAN NOT NULL DEFAULT false,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Knowledge_isActive_idx" ON "Knowledge"("isActive");
CREATE INDEX IF NOT EXISTS "Knowledge_createdAt_idx" ON "Knowledge"("createdAt");

-- KnowledgeOnChat junction table
CREATE TABLE IF NOT EXISTS "KnowledgeOnChat" (
    "chatId" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    PRIMARY KEY ("chatId", "knowledgeId"),
    CONSTRAINT "KnowledgeOnChat_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeOnChat_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "Knowledge"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
