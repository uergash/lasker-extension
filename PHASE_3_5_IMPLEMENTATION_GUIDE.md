# Phase 3 & 5 Implementation Guide

Complete guide to implementing the backend (database + n8n workflows) for email extraction.

---

## 🎉 Current Status: **SYSTEM FULLY OPERATIONAL**

**✅ Extension Frontend:** Complete - emails are being submitted to Supabase  
**✅ Database Setup:** Complete - all migrations run successfully  
**✅ n8n Workflows:** Complete - processing emails and extracting insights  
**✅ End-to-End System:** Fully operational and production-ready!

**Architecture:** Extension → Supabase REST API → n8n (polling) → Process Insights → Dashboard

**Completed Date:** January 10, 2026

---

## ✅ Implementation Checklist - ALL COMPLETE

### ✅ Phase 0: Extension Frontend (COMPLETE)

- [x] Gmail content script with button injection
- [x] Email extraction and parsing
- [x] Extension popup with email preview
- [x] Direct Supabase REST API submission
- [x] Error handling and loading states
- [x] User email storage

### ✅ Phase 5: Database Setup (COMPLETE)

- [x] **Step 1:** Open Supabase Dashboard
- [x] **Step 2:** Go to SQL Editor
- [x] **Step 3:** Run migration 01 (create email_submissions table)
- [x] **Step 4:** Run migration 02 (add email_submission_id to insights)
- [x] **Step 5:** Run migration 03 (create helper functions)
- [x] **Step 6:** Verify tables exist
- [x] **Step 7:** Test with sample insert

### ✅ Phase 3: n8n Workflows (COMPLETE)

- [x] **Step 1:** Set up Supabase credentials in n8n
- [x] **Step 2:** Set up OpenAI credentials in n8n
- [x] **Step 3:** Create main workflow (Email Flow - Submission Processor)
- [x] **Step 4:** Create sub-workflow (Email Flow - Process Insights)
- [x] **Step 5:** Configure all nodes
- [x] **Step 6:** Test end-to-end
- [x] **Step 7:** Activate workflows
- [x] ~~**Step 8:** Update extension with webhook URL~~ (Not needed - using direct Supabase submission)

---

## 🗄️ Phase 5: Database Implementation

### Step 1: Access Supabase

1. Go to https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)

### Step 2: Run Migrations

**Run these in order:**

1. Open `supabase-migrations/01_create_email_submissions_table.sql`
2. Copy entire contents
3. Paste into SQL Editor
4. Click **Run**
5. Wait for success message

Repeat for:
- `02_add_email_submission_to_insights.sql`
- `03_create_helper_functions.sql`

### Step 3: Verify Success

Run this query to verify:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('email_submissions', 'insights');

-- Check column was added
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'insights' 
AND column_name = 'email_submission_id';

-- Check functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%email%';
```

**Expected:** 
- 2 tables found ✅
- 1 column found ✅
- 3 functions found ✅

### Step 4: Test Insert

```sql
INSERT INTO email_submissions (
  from_email,
  from_name,
  subject,
  body,
  source
) VALUES (
  'test@example.com',
  'Test User',
  'Test Email',
  'This is a test email for verification',
  'gmail'
) RETURNING *;
```

**Expected:** New row returned with UUID ✅

### Step 5: Get Your Service Role Key

**Important:** You'll need this for n8n

1. Go to **Settings** > **API**
2. Copy `service_role` key (NOT the `anon` key)
3. **Keep this secret!** This bypasses RLS

---

## 🤖 Phase 3: n8n Workflow Implementation

### Prerequisites

- [ ] n8n instance running
- [ ] Supabase migrations completed ⚠️ **Must complete Phase 5 first**
- [ ] OpenAI API key available
- [ ] Supabase service_role key available

### Important Notes

**Architecture Change:** The extension now submits emails directly to Supabase via REST API instead of an n8n webhook. This means:
- ✅ No webhook configuration needed in the extension
- ✅ Emails are stored immediately in `email_submissions` table
- 📊 n8n workflows **poll** the database for pending emails (instead of receiving webhook calls)
- 🔄 Main workflow triggers on schedule (e.g., every 5 minutes) to process pending emails

### Step 1: Set Up Credentials in n8n

#### 1a. Add Supabase (PostgreSQL) Credential

1. Go to **Credentials** in n8n
2. Click **Add Credential**
3. Select **Postgres**
4. Configure:

```
Name: Supabase - Lasker
Host: db.[YOUR-PROJECT-REF].supabase.co
Database: postgres
User: postgres
Password: [YOUR-SUPABASE-PASSWORD]
Port: 5432
SSL Mode: require
```

5. Click **Save**
6. Click **Test** to verify connection

#### 1b. Add OpenAI Credential

1. Click **Add Credential**
2. Select **OpenAI**
3. Configure:

```
Name: OpenAI - Lasker
API Key: [YOUR-OPENAI-API-KEY]
```

4. Click **Save**

### Step 2: Create Main Workflow

1. Click **Workflows** > **Add Workflow**
2. Name it: `Email Flow - Submission Processor`
3. Add nodes per `n8n-workflows/node-configurations.md`:
   - **Schedule Trigger** (trigger) - Run every 5 minutes
   - **Postgres** (query) - SELECT pending emails from `email_submissions`
   - **IF** - Check if emails found
   - **Execute Workflow** (call sub-workflow for each email)
   - **Postgres** (update) - Mark emails as processed/failed
4. Connect nodes in sequence
5. Configure each node per the guide

**Key Change:** Using **Schedule Trigger** instead of Webhook since emails come directly to Supabase

### Step 3: Configure Schedule

1. Click on the **Schedule Trigger** node
2. Set interval: **Every 5 minutes** (or as desired)
3. Activate workflow when ready

**No webhook URL needed!** Emails are already in the database.

### Step 4: Create Sub-Workflow

1. Click **Add Workflow**
2. Name it: `Email Flow - Process Insights`
3. Add nodes per `node-configurations.md`:
   - Workflow Trigger
   - Function (build context)
   - OpenAI (extract insights)
   - Function (parse insights)
   - Split Out Items
   - Postgres (semantic search)
   - OpenAI (feature matching)
   - OpenAI (journey stage)
   - Postgres (insert insights)
   - Aggregate
4. Connect nodes
5. Configure each node

### Step 5: Configure OpenAI Prompts

Use the exact prompts from `openai-prompts.md`:

1. Open the first OpenAI node (Extract Insights)
2. Paste the **System Message**
3. Paste the **User Message** template
4. Set Temperature: `0.3`
5. Set Max Tokens: `500`
6. Save

Repeat for other OpenAI nodes (Feature Matching, Journey Stage)

### Step 6: Test End-to-End

Since emails come from the extension, test by inserting a sample email directly:

**Option A: Use the Chrome Extension**
1. Go to Gmail
2. Open any email
3. Click "Extract to Lasker"
4. Confirm in popup
5. Check Supabase to see email inserted

**Option B: Insert Test Email via SQL**
```sql
INSERT INTO email_submissions (
  from_email,
  from_name,
  subject,
  body,
  source,
  processing_status
) VALUES (
  'jane@example.com',
  'Jane Doe',
  'Feature Request - Dark Mode',
  'Hi team, we really need dark mode support. All our users are asking for it. The bright interface hurts our eyes during night shifts.',
  'gmail',
  'pending'
) RETURNING *;
```

**Expected n8n Workflow Behavior:**
- Trigger runs every 5 minutes
- Finds pending email(s)
- Processes through sub-workflow
- Extracts insights
- Updates status to 'completed'

### Step 7: Verify in Database

Check that data was inserted:

```sql
-- Check email was stored
SELECT * FROM email_submissions 
ORDER BY created_at DESC LIMIT 1;

-- Check insights were extracted
SELECT * FROM insights 
WHERE email_submission_id IS NOT NULL
ORDER BY created_at DESC LIMIT 5;
```

### Step 8: Activate Workflows

1. Open both workflows
2. Toggle **Active** switch to ON
3. Workflows are now live!

---

## 🔌 Chrome Extension Status

### ✅ Extension Configuration Complete

The extension is already configured to submit directly to Supabase:

```javascript
const SUPABASE_URL = 'https://wrayzjdnlimxzqcswots.supabase.co';
const SUPABASE_ANON_KEY = 'eyJh...'; // Already configured
const EMAIL_SUBMISSIONS_URL = `${SUPABASE_URL}/rest/v1/email_submissions`;
```

**No changes needed!** The extension is production-ready once database migrations are complete.

### Test Extension Submission

1. Go to Gmail
2. Open any email
3. Click "Extract to Lasker" button
4. Extension popup should show email preview
5. Click "Extract Insights"
6. Should see success message!

### Verify Processing in Supabase

After n8n workflows process the emails:

```sql
SELECT 
  e.from_email,
  e.subject,
  e.processing_status,
  e.insights_extracted,
  e.created_at,
  e.processed_at,
  COUNT(i.id) as actual_insights
FROM email_submissions e
LEFT JOIN insights i ON i.email_submission_id = e.id
GROUP BY e.id
ORDER BY e.created_at DESC
LIMIT 10;
```

**Expected Results:**
- `processing_status`: 'completed' (was 'pending')
- `insights_extracted`: Number > 0
- `processed_at`: Timestamp populated
- `actual_insights`: Matching count in insights table

---

## 🐛 Troubleshooting

### Database Issues

**Error: Table does not exist**
- Re-run migrations in correct order
- Check spelling (email_submissions, not email_submission)

**Error: Permission denied**
- Check you're using service_role key in n8n
- Verify RLS policies are set up correctly

### n8n Issues

**Workflow not processing emails**
- Check workflow is Active (toggle in n8n)
- Verify schedule trigger is enabled
- Check workflow execution history for errors
- Ensure Supabase credentials are correct

**OpenAI errors**
- Verify API key is correct
- Check rate limits (upgrade plan if needed)
- Test with simpler prompts first

**No insights extracted**
- Check OpenAI node execution logs
- Verify response is valid JSON
- Test prompts in ChatGPT first

### Extension Issues

**Button click does nothing**
- Check browser console for errors (F12)
- Verify Supabase URL is correct in `popup.js`
- Check that database tables exist

**"Failed to submit email"**
- Check network tab in DevTools (F12)
- Verify Supabase anon key is correct
- Check that `email_submissions` table exists
- Verify RLS policies allow inserts

---

## 📊 Monitoring & Maintenance

### Daily Checks

```sql
-- Processing stats
SELECT 
  processing_status,
  COUNT(*) as count,
  AVG(insights_extracted) as avg_insights
FROM email_submissions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY processing_status;

-- Failed processing
SELECT * FROM email_submissions
WHERE processing_status = 'failed'
AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Weekly Review

1. Review extracted insights quality
2. Check for duplicate threads
3. Optimize prompts based on results
4. Monitor OpenAI costs

### Monthly Tasks

1. Review feature classification accuracy
2. Update prompts based on patterns
3. Add new features to taxonomy
4. Clean up old test data

---

## ✅ Success Criteria - ALL MET

### Phase 5: Database ✅ COMPLETE
- ✅ Database tables exist and accept inserts
- ✅ Test SQL insert works
- ✅ Functions are created

### Extension + Database ✅ COMPLETE
- ✅ Chrome extension button extracts emails
- ✅ Email appears in `email_submissions` table with status 'pending'
- ✅ No errors in browser console

### Full System ✅ COMPLETE
- ✅ n8n workflows are active and running
- ✅ Pending emails are processed within 5 minutes
- ✅ Insights appear in Supabase `insights` table
- ✅ Email submissions marked as "completed"
- ✅ `insights_extracted` count matches actual insights

**🎉 System is fully operational and production-ready!**

---

## 🚀 Now That You're Live - Optimization & Growth

### Immediate Actions (First Week)
1. **Monitor first 10-20 extractions** - Review quality and accuracy
2. **Verify classification accuracy** - Check feature and journey stage assignments
3. **Test edge cases** - Try different email types (complaints, feature requests, praise)
4. **Train your team** - Show them how to use the extension

### Optimization (First Month)
1. **Tune OpenAI prompts** - Adjust based on actual data patterns
2. **Build feature taxonomy** - Add features specific to your product
3. **Review and merge duplicates** - Consolidate similar insights
4. **Adjust processing frequency** - Speed up or slow down n8n schedule

### Scale & Enhance (Ongoing)
1. **Set up dashboard** - Visualize extracted insights (Metabase, Retool, etc.)
2. **Add email providers** - Extend to Outlook, Yahoo, etc.
3. **Implement thread tracking** - Connect related email conversations
4. **Customer auto-linking** - Associate insights with specific customers
5. **Build notification system** - Alert team to high-priority insights
6. **Export capabilities** - Weekly reports, CSV exports, integrations

---

## 📞 Need Help?

Common issues and solutions are in:
- `supabase-migrations/README.md`
- `n8n-workflows/README.md`
- `n8n-workflows/node-configurations.md`

**Estimated Total Time:** 3-4 hours for complete setup

**Let's build!** 🚀

