-- Migration: Add email_submission_id to insights table
-- Links insights back to the original email they were extracted from

-- Add the column
ALTER TABLE insights 
ADD COLUMN IF NOT EXISTS email_submission_id UUID REFERENCES email_submissions(id) ON DELETE SET NULL;

-- Add index for lookups
CREATE INDEX IF NOT EXISTS idx_insights_email_submission 
  ON insights(email_submission_id);

-- Add comment
COMMENT ON COLUMN insights.email_submission_id IS 'References the email submission this insight was extracted from (if applicable)';

-- Update source column to include 'email' if not already there
-- Assuming your insights table has a 'source' column for tracking where insights came from
ALTER TABLE insights 
ALTER COLUMN source TYPE TEXT;

-- Add check constraint to ensure valid source values (optional)
-- ALTER TABLE insights 
-- ADD CONSTRAINT insights_source_check 
-- CHECK (source IN ('voice', 'email', 'manual', 'api', 'other'));

