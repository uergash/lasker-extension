# Supabase Database Migrations for Email Extraction

These SQL migration files add database support for email extraction functionality to your Lasker application.

## 📋 Migration Files

1. **`01_create_email_submissions_table.sql`**
   - Creates `email_submissions` table to store raw email data
   - Adds indexes for performance
   - Sets up Row Level Security (RLS) policies

2. **`02_add_email_submission_to_insights.sql`**
   - Adds `email_submission_id` column to `insights` table
   - Creates index for lookups
   - Links insights back to source emails

3. **`03_create_helper_functions.sql`**
   - `update_email_submission_status()` - Update processing status
   - `get_pending_email_submissions()` - Get emails to process
   - `is_thread_already_processed()` - Check for duplicate threads

## 🚀 How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://app.supabase.com
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste each migration file **in order** (01, 02, 03)
5. Click **Run** for each migration

### Option 2: Supabase CLI

If you have the Supabase CLI installed:

```bash
# Navigate to your project
cd "/Users/uergash/Desktop/Lasker Extention"

# Run migrations in order
supabase db reset
# Or run individually:
supabase db execute -f supabase-migrations/01_create_email_submissions_table.sql
supabase db execute -f supabase-migrations/02_add_email_submission_to_insights.sql
supabase db execute -f supabase-migrations/03_create_helper_functions.sql
```

### Option 3: psql (Direct Database Connection)

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase-migrations/01_create_email_submissions_table.sql

psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase-migrations/02_add_email_submission_to_insights.sql

psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase-migrations/03_create_helper_functions.sql
```

## ✅ Verify Migrations

After running migrations, verify they were successful:

```sql
-- Check if email_submissions table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'email_submissions';

-- Check if insights table has email_submission_id column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'insights' 
AND column_name = 'email_submission_id';

-- Check if helper functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%email%';
```

Expected results:
- `email_submissions` table exists ✅
- `insights.email_submission_id` column exists ✅
- 3 helper functions exist ✅

## 📊 Database Schema Overview

### email_submissions Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | User who submitted (FK to auth.users) |
| `from_email` | TEXT | Sender email address |
| `from_name` | TEXT | Sender display name |
| `subject` | TEXT | Email subject line |
| `body` | TEXT | Email body content |
| `email_date` | TIMESTAMPTZ | When email was sent |
| `thread_id` | TEXT | Gmail thread ID |
| `source` | TEXT | Source provider (gmail, outlook, etc.) |
| `source_url` | TEXT | Link back to email |
| `metadata` | JSONB | Additional data (labels, cc, bcc) |
| `processing_status` | TEXT | pending/processing/completed/failed |
| `insights_extracted` | INTEGER | Count of insights extracted |
| `error_message` | TEXT | Error details if processing failed |
| `created_at` | TIMESTAMPTZ | When submitted |
| `updated_at` | TIMESTAMPTZ | Last updated |
| `processed_at` | TIMESTAMPTZ | When processing completed |

### insights Table Updates

| Column | Type | Description |
|--------|------|-------------|
| `email_submission_id` | UUID | FK to email_submissions (nullable) |

## 🔐 Security (RLS Policies)

Row Level Security is enabled on `email_submissions`:

1. **Users can view their own submissions**
   - `SELECT` on records where `user_id = auth.uid()`

2. **Users can insert their own submissions**
   - `INSERT` where `user_id = auth.uid()`

3. **Service role has full access**
   - For n8n workflows to process emails
   - Use your Supabase `service_role` key in n8n

## 🧪 Test Data

Insert test data to verify setup:

```sql
-- Insert test email submission
INSERT INTO email_submissions (
  user_id,
  from_email,
  from_name,
  subject,
  body,
  email_date,
  thread_id,
  source,
  metadata
) VALUES (
  auth.uid(), -- Replace with actual user ID for testing
  'customer@example.com',
  'Jane Doe',
  'Feature Request - Dark Mode',
  'Hi team, we really need dark mode support. Our users are requesting it constantly.',
  NOW() - INTERVAL '1 day',
  'test-thread-123',
  'gmail',
  '{"labels": ["Important", "Customer Feedback"]}'::jsonb
);

-- Query to see it
SELECT * FROM email_submissions ORDER BY created_at DESC LIMIT 5;
```

## 🗑️ Rollback (if needed)

If you need to undo these migrations:

```sql
-- Drop helper functions
DROP FUNCTION IF EXISTS update_email_submission_status;
DROP FUNCTION IF EXISTS get_pending_email_submissions;
DROP FUNCTION IF EXISTS is_thread_already_processed;

-- Remove column from insights
ALTER TABLE insights DROP COLUMN IF EXISTS email_submission_id;

-- Drop table (WARNING: This will delete all data!)
DROP TABLE IF EXISTS email_submissions CASCADE;
```

## 📝 Notes

- Make sure your `insights` table exists before running migration 02
- Make sure your `auth.users` table exists (should be default in Supabase)
- The `service_role` policy requires you to use the service key (not anon key) in n8n
- Test with sample data before processing real emails

## 🆘 Troubleshooting

**Error: relation "insights" does not exist**
- Make sure your insights table is already created
- Check the table name matches exactly (case-sensitive)

**Error: foreign key constraint fails**
- Verify `auth.users` table exists
- Check that user_id references are valid UUIDs

**RLS blocks queries in n8n**
- Make sure you're using the `service_role` key in n8n, not the `anon` key
- Service role bypasses RLS policies

---

**Ready?** Run these migrations, then move on to Phase 3 (n8n workflows)!

