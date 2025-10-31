-- IMPORTANT: Run this script in Supabase SQL Editor to add device isolation

-- First, ensure id columns are properly set up with auto-increment
-- This fixes the "null value in column id" error

-- For Chat table
DO $$
BEGIN
  -- Check if id column exists and is integer type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Chat' AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    -- Create sequence if it doesn't exist
    CREATE SEQUENCE IF NOT EXISTS "Chat_id_seq";

    -- Alter id column to use sequence
    ALTER TABLE "Chat" ALTER COLUMN "id" SET DEFAULT nextval('"Chat_id_seq"');
    ALTER SEQUENCE "Chat_id_seq" OWNED BY "Chat"."id";

    -- Set sequence to max existing id + 1
    PERFORM setval('"Chat_id_seq"', COALESCE((SELECT MAX(id) FROM "Chat"), 0) + 1, false);
  END IF;
END $$;

-- For Knowledge table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Knowledge' AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS "Knowledge_id_seq";
    ALTER TABLE "Knowledge" ALTER COLUMN "id" SET DEFAULT nextval('"Knowledge_id_seq"');
    ALTER SEQUENCE "Knowledge_id_seq" OWNED BY "Knowledge"."id";
    PERFORM setval('"Knowledge_id_seq"', COALESCE((SELECT MAX(id) FROM "Knowledge"), 0) + 1, false);
  END IF;
END $$;

-- For Message table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Message' AND column_name = 'id' AND data_type = 'integer'
  ) THEN
    CREATE SEQUENCE IF NOT EXISTS "Message_id_seq";
    ALTER TABLE "Message" ALTER COLUMN "id" SET DEFAULT nextval('"Message_id_seq"');
    ALTER SEQUENCE "Message_id_seq" OWNED BY "Message"."id";
    PERFORM setval('"Message_id_seq"', COALESCE((SELECT MAX(id) FROM "Message"), 0) + 1, false);
  END IF;
END $$;

-- Now add deviceId columns
ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE "Knowledge" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS "Chat_deviceId_idx" ON "Chat"("deviceId");
CREATE INDEX IF NOT EXISTS "Knowledge_deviceId_idx" ON "Knowledge"("deviceId");

-- Update existing records to have a default deviceId
UPDATE "Chat" SET "deviceId" = 'legacy_device' WHERE "deviceId" IS NULL;
UPDATE "Knowledge" SET "deviceId" = 'legacy_device' WHERE "deviceId" IS NULL;

-- Verify the changes
SELECT 'Chat table setup:' as info,
  (SELECT column_default FROM information_schema.columns WHERE table_name = 'Chat' AND column_name = 'id') as id_default,
  (SELECT COUNT(*) FROM "Chat") as total_chats,
  (SELECT COUNT(DISTINCT "deviceId") FROM "Chat") as unique_devices;

SELECT 'Knowledge table setup:' as info,
  (SELECT column_default FROM information_schema.columns WHERE table_name = 'Knowledge' AND column_name = 'id') as id_default,
  (SELECT COUNT(*) FROM "Knowledge") as total_knowledge,
  (SELECT COUNT(DISTINCT "deviceId") FROM "Knowledge") as unique_devices;
