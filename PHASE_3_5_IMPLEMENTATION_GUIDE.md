# Phase 3 & 5 Implementation Guide

Complete guide to implementing the backend (database + n8n workflows) for email extraction.

---

## 📋 Implementation Checklist

### Phase 5: Database Setup (30 minutes)

- [ ] **Step 1:** Open Supabase Dashboard
- [ ] **Step 2:** Go to SQL Editor
- [ ] **Step 3:** Run migration 01 (create email_submissions table)
- [ ] **Step 4:** Run migration 02 (add email_submission_id to insights)
- [ ] **Step 5:** Run migration 03 (create helper functions)
- [ ] **Step 6:** Verify tables exist
- [ ] **Step 7:** Test with sample insert

### Phase 3: n8n Workflows (2-3 hours)

- [ ] **Step 1:** Set up Supabase credentials in n8n
- [ ] **Step 2:** Set up OpenAI credentials in n8n
- [ ] **Step 3:** Create main workflow (Email Flow - Submission Processor)
- [ ] **Step 4:** Create sub-workflow (Email Flow - Process Insights)
- [ ] **Step 5:** Configure all nodes
- [ ] **Step 6:** Test with cURL
- [ ] **Step 7:** Activate workflows
- [ ] **Step 8:** Update extension with webhook URL

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
- [ ] Supabase migrations completed
- [ ] OpenAI API key available
- [ ] Supabase service_role key available

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
3. Follow `n8n-workflows/node-configurations.md` to add nodes:
   - Webhook (trigger)
   - Set (extract variables)
   - Function (validate input)
   - Postgres (insert email_submissions)
   - Execute Workflow (call sub-workflow)
   - Postgres (update status)
   - Respond to Webhook
4. Connect nodes in sequence
5. Configure each node per the guide

### Step 3: Get Webhook URL

1. Click on the **Webhook** node
2. Copy the **Production URL**
3. Save this - you'll need it for the extension!

Example: `https://n8n.yourcompany.com/webhook/email-submission`

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

### Step 6: Test with cURL

Copy your webhook URL and test:

```bash
curl -X POST https://YOUR-N8N-URL/webhook/email-submission \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email",
    "email": {
      "from": {"name": "Jane Doe", "email": "jane@example.com"},
      "subject": "Feature Request - Dark Mode",
      "body": "Hi team, we really need dark mode support. All our users are asking for it. The bright interface hurts our eyes during night shifts.",
      "date": "2026-01-04T10:00:00Z",
      "threadId": "test-thread-456",
      "labels": ["Important"],
      "sourceUrl": "https://mail.google.com/mail/u/0/#inbox/test"
    },
    "metadata": {
      "userId": "your-email@example.com",
      "timestamp": "2026-01-04T10:05:00Z",
      "source": "gmail"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "submission_id": "uuid-here",
  "insights_extracted": 1,
  "message": "Email processed successfully"
}
```

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

## 🔌 Update Chrome Extension

### Step 1: Update Webhook URL

Edit `popup.js` (line 3):

```javascript
const EMAIL_WEBHOOK_URL = 'https://YOUR-N8N-URL/webhook/email-submission';
```

Replace `YOUR-N8N-URL` with your actual webhook URL from Step 3 above.

### Step 2: Reload Extension

1. Go to `chrome://extensions/`
2. Find Lasker extension
3. Click **Reload** (↻)

### Step 3: Test End-to-End

1. Go to Gmail
2. Open any email
3. Click "Extract to Lasker" button
4. Extension popup should show email preview
5. Click "Extract Insights"
6. Should see success message!

### Step 4: Verify in Supabase

```sql
SELECT 
  e.from_email,
  e.subject,
  e.processing_status,
  e.insights_extracted,
  COUNT(i.id) as actual_insights
FROM email_submissions e
LEFT JOIN insights i ON i.email_submission_id = e.id
GROUP BY e.id
ORDER BY e.created_at DESC
LIMIT 10;
```

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

**Webhook returns 404**
- Check workflow is Active
- Verify webhook path is correct
- Test webhook in n8n UI first

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
- Verify webhook URL is correct
- Test webhook directly with cURL first

**"Failed to submit email"**
- Check network tab in DevTools
- Verify CORS is enabled on n8n
- Check webhook returns proper response

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

## 🎯 Success Criteria

You'll know everything is working when:

- ✅ Database tables exist and accept inserts
- ✅ n8n workflows are active and accessible
- ✅ Test cURL request returns success
- ✅ Chrome extension button extracts emails
- ✅ Insights appear in Supabase insights table
- ✅ Email submissions marked as "completed"

---

## 🚀 Next Steps After Setup

1. **Monitor first 10 extractions** - Review quality
2. **Tune prompts** - Adjust based on your data
3. **Add feature taxonomy** - Build your feature list
4. **Set up dashboard** - Visualize extracted insights
5. **Train team** - Show how to use the tool
6. **Iterate** - Improve based on feedback

---

## 📞 Need Help?

Common issues and solutions are in:
- `supabase-migrations/README.md`
- `n8n-workflows/README.md`
- `n8n-workflows/node-configurations.md`

**Estimated Total Time:** 3-4 hours for complete setup

**Let's build!** 🚀

