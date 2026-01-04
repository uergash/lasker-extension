-- Migration: Helper functions for email processing

-- Function: Update email submission status
CREATE OR REPLACE FUNCTION update_email_submission_status(
  submission_id UUID,
  new_status TEXT,
  insights_count INTEGER DEFAULT NULL,
  error_msg TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE email_submissions
  SET 
    processing_status = new_status,
    insights_extracted = COALESCE(insights_count, insights_extracted),
    error_message = error_msg,
    updated_at = NOW(),
    processed_at = CASE WHEN new_status IN ('completed', 'failed') THEN NOW() ELSE processed_at END
  WHERE id = submission_id;
END;
$$;

-- Function: Get pending email submissions for processing
CREATE OR REPLACE FUNCTION get_pending_email_submissions(
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  from_email TEXT,
  from_name TEXT,
  subject TEXT,
  body TEXT,
  email_date TIMESTAMPTZ,
  thread_id TEXT,
  source TEXT,
  source_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.user_id,
    e.from_email,
    e.from_name,
    e.subject,
    e.body,
    e.email_date,
    e.thread_id,
    e.source,
    e.source_url,
    e.metadata,
    e.created_at
  FROM email_submissions e
  WHERE e.processing_status = 'pending'
  ORDER BY e.created_at ASC
  LIMIT limit_count;
END;
$$;

-- Function: Check if email thread was already processed
CREATE OR REPLACE FUNCTION is_thread_already_processed(
  thread_id_param TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  exists_flag BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 
    FROM email_submissions 
    WHERE thread_id = thread_id_param 
    AND processing_status IN ('completed', 'processing')
  ) INTO exists_flag;
  
  RETURN exists_flag;
END;
$$;

-- Add comments
COMMENT ON FUNCTION update_email_submission_status IS 'Updates the processing status of an email submission';
COMMENT ON FUNCTION get_pending_email_submissions IS 'Returns email submissions waiting to be processed';
COMMENT ON FUNCTION is_thread_already_processed IS 'Checks if a Gmail thread has already been processed to avoid duplicates';

