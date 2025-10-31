-- Add isPinned column to Chat table
ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS "Chat_isPinned_idx" ON "Chat"("isPinned");
