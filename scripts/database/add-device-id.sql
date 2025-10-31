-- Add deviceId column to Chat table
ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;

-- Add deviceId column to Knowledge table
ALTER TABLE "Knowledge" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS "Chat_deviceId_idx" ON "Chat"("deviceId");
CREATE INDEX IF NOT EXISTS "Knowledge_deviceId_idx" ON "Knowledge"("deviceId");

-- Update existing records to have a default deviceId (optional - assigns all existing chats to a "legacy" device)
-- You can skip this if you want to start fresh
UPDATE "Chat" SET "deviceId" = 'legacy_device' WHERE "deviceId" IS NULL;
UPDATE "Knowledge" SET "deviceId" = 'legacy_device' WHERE "deviceId" IS NULL;
