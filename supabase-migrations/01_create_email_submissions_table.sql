-- Migration: Create email_submissions table
-- This table stores raw email data captured from Gmail before processing

CREATE TABLE IF NOT EXISTS email_submissions (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User who submitted the email (references your users table)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Email sender information
  from_email TEXT NOT NULL,
  from_name TEXT,
  
  -- Email content
  subject TEXT,
  body TEXT NOT NULL,
  email_date TIMESTAMPTZ,
  
  -- Gmail metadata
  thread_id TEXT,
  source TEXT DEFAULT 'gmail', -- gmail, outlook, yahoo, etc.
  source_url TEXT, -- Link back to the email in Gmail
  
  -- Additional metadata (labels, cc, bcc, etc.)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Processing status
  processing_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  insights_extracted INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_submissions_user_id 
  ON email_submissions(user_id);

CREATE INDEX IF NOT EXISTS idx_email_submissions_thread_id 
  ON email_submissions(thread_id);

CREATE INDEX IF NOT EXISTS idx_email_submissions_processing_status 
  ON email_submissions(processing_status);

CREATE INDEX IF NOT EXISTS idx_email_submissions_created_at 
  ON email_submissions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_submissions_from_email 
  ON email_submissions(from_email);

-- Index for finding emails from same sender
CREATE INDEX IF NOT EXISTS idx_email_submissions_from_email_created 
  ON email_submissions(from_email, created_at DESC);

-- Composite index for pending emails query
CREATE INDEX IF NOT EXISTS idx_email_submissions_status_created 
  ON email_submissions(processing_status, created_at DESC);

-- Add comment
COMMENT ON TABLE email_submissions IS 'Stores raw email data captured from Gmail/Outlook/etc before processing into insights';

-- Enable Row Level Security (RLS)
ALTER TABLE email_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own email submissions
CREATE POLICY "Users can view their own email submissions"
  ON email_submissions
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own email submissions
CREATE POLICY "Users can insert their own email submissions"
  ON email_submissions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Service role can do anything (for n8n processing)
CREATE POLICY "Service role has full access to email submissions"
  ON email_submissions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Note: The last policy only applies when using the service_role key

