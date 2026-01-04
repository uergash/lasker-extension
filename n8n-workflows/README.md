# n8n Workflows for Email Extraction

This folder contains configurations and documentation for the n8n workflows that process email submissions into insights.

## 📊 Workflow Overview

```
Email Extraction Flow:

Chrome Extension
    ↓ POST email data
┌─────────────────────────────────────────┐
│  Main Workflow:                         │
│  "Email Flow - Submission Processor"    │
│  ├─ Webhook (receive email)             │
│  ├─ Validate input                      │
│  ├─ Insert to email_submissions         │
│  ├─ Execute sub-workflow                │
│  └─ Return response                     │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│  Sub-workflow:                          │
│  "Email Flow - Process Insights"        │
│  ├─ Extract metadata                    │
│  ├─ OpenAI: Extract insights            │
│  ├─ For each insight:                   │
│  │   ├─ Stage 1: Semantic search        │
│  │   ├─ Stage 2: Feature selection      │
│  │   ├─ Stage 3: Journey stage          │
│  │   └─ Enrichment                      │
│  ├─ Insert insights to Supabase         │
│  └─ Update submission status            │
└─────────────────────────────────────────┘
```

## 📁 Files in This Folder

1. **`01-main-workflow.json`** - Main webhook endpoint workflow
2. **`02-sub-workflow.json`** - Insight extraction sub-workflow  
3. **`node-configurations.md`** - Detailed node setup guide
4. **`openai-prompts.md`** - AI prompts for extraction and classification

## 🚀 Quick Start

### Step 1: Import Workflows into n8n

1. Go to your n8n instance
2. Click **Workflows** > **Add Workflow**
3. Click **⋮** (menu) > **Import from File**
4. Import `01-main-workflow.json`
5. Repeat for `02-sub-workflow.json`

### Step 2: Configure Credentials

You'll need to set up these credentials in n8n:

1. **Supabase API** (PostgreSQL)
   - Host: `[your-project-ref].supabase.co`
   - Database: `postgres`
   - User: `postgres`
   - Password: Your Supabase password
   - Port: `5432`
   - SSL: `require`

2. **OpenAI API**
   - API Key: Your OpenAI API key
   - Model: `gpt-4` or `gpt-3.5-turbo`

### Step 3: Update Configuration

Open the main workflow and update:

1. **Webhook URL** - Copy the webhook URL
2. **Supabase Connection** - Select your Supabase credentials
3. **OpenAI Connection** - Select your OpenAI credentials

### Step 4: Activate Workflows

1. Click **Active** toggle on both workflows
2. Test with a sample email from the Chrome extension

### Step 5: Update Extension

Update `popup.js` with your webhook URL:

```javascript
const EMAIL_WEBHOOK_URL = 'https://your-n8n-instance.com/webhook/email-submission';
```

## 📝 Workflow Details

### Main Workflow: "Email Flow - Submission Processor"

**Purpose:** Receives emails from Chrome extension, validates, stores, and triggers processing

**Nodes:**
1. Webhook - Receives POST requests
2. Set Variables - Extract and format data
3. Validate Input - Check required fields
4. Supabase Insert - Store in `email_submissions`
5. Execute Sub-workflow - Process insights
6. Update Status - Mark as completed
7. Return Response - Send success to extension

**Webhook Payload Expected:**
```json
{
  "type": "email",
  "email": {
    "from": { "name": "...", "email": "..." },
    "subject": "...",
    "body": "...",
    "date": "...",
    "threadId": "...",
    "labels": [],
    "sourceUrl": "..."
  },
  "metadata": {
    "userId": "user@example.com",
    "timestamp": "2026-01-04T...",
    "source": "gmail"
  }
}
```

### Sub-workflow: "Email Flow - Process Insights"

**Purpose:** Extracts insights from email using OpenAI and classifies them

**Nodes:**
1. Workflow Trigger - Receives data from main workflow
2. Build Context - Format email for OpenAI
3. OpenAI Extract Insights - Get distinct insights
4. Split Out Items - Process each insight individually
5. Stage 1: Semantic Search - Find top 5 features
6. Stage 2: Feature Selection - Pick best match
7. Stage 3: Journey Stage - Classify awareness/consideration/etc.
8. Enrichment - Link to customer/user
9. Supabase Insert - Store insights
10. Aggregate Results - Count insights
11. Return to Main - Send count back

## 🧪 Testing

### Test with cURL

```bash
curl -X POST https://your-n8n-instance.com/webhook/email-submission \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email",
    "email": {
      "from": {"name": "Jane Doe", "email": "jane@example.com"},
      "subject": "Feature Request",
      "body": "We need dark mode support",
      "date": "2026-01-04T10:00:00Z",
      "threadId": "test-123",
      "labels": [],
      "sourceUrl": "https://mail.google.com/..."
    },
    "metadata": {
      "userId": "your-email@example.com",
      "timestamp": "2026-01-04T10:00:00Z",
      "source": "gmail"
    }
  }'
```

### Expected Response

```json
{
  "success": true,
  "submission_id": "uuid-here",
  "insights_extracted": 2,
  "message": "Email processed successfully"
}
```

## 🔧 Customization

### Adjust OpenAI Model

In the OpenAI nodes, you can change:
- Model: `gpt-4` (more accurate) vs `gpt-3.5-turbo` (faster/cheaper)
- Temperature: `0.3` (more consistent) vs `0.7` (more creative)
- Max Tokens: Adjust based on expected response length

### Modify Classification Logic

Edit the prompts in `openai-prompts.md` to match your:
- Feature taxonomy
- Journey stages
- Classification criteria

### Add Email Filtering

Add a filter node after validation to:
- Skip certain sender domains
- Only process emails with specific labels
- Filter by date range

## 📊 Monitoring

### Check Workflow Executions

1. Go to **Executions** in n8n
2. Filter by workflow name
3. Review success/failure rates
4. Check execution logs for errors

### Query Database

```sql
-- Check processing status
SELECT 
  processing_status, 
  COUNT(*) 
FROM email_submissions 
GROUP BY processing_status;

-- View recent emails
SELECT 
  from_email,
  subject,
  processing_status,
  insights_extracted,
  created_at
FROM email_submissions
ORDER BY created_at DESC
LIMIT 10;

-- Find failed processing
SELECT *
FROM email_submissions
WHERE processing_status = 'failed'
ORDER BY created_at DESC;
```

## 🆘 Troubleshooting

### Webhook Returns 404
- Check that workflow is **Active**
- Verify webhook URL is correct
- Test webhook in n8n interface

### No Insights Extracted
- Check OpenAI API key is valid
- Review OpenAI node execution logs
- Verify prompts are correctly formatted

### Database Errors
- Check Supabase credentials
- Verify tables exist (run migrations)
- Check RLS policies (use service_role key)

### Duplicate Processing
- Enable thread ID checking
- Use `is_thread_already_processed()` function
- Add deduplication logic in validation

## 📈 Performance Tips

1. **Batch Processing** - Process multiple pending emails at once
2. **Caching** - Cache feature list for semantic search
3. **Async Processing** - Don't make extension wait for full processing
4. **Error Handling** - Add retry logic for failed extractions
5. **Rate Limiting** - Respect OpenAI rate limits

## 🔗 Next Steps

After setting up workflows:

1. ✅ Run database migrations (Phase 5)
2. ✅ Import and configure n8n workflows (Phase 3)
3. ✅ Test with sample emails
4. ✅ Update extension with webhook URL
5. ✅ Monitor first real extractions
6. 📊 Build dashboard to view extracted insights
7. 🔄 Iterate on prompts based on results

---

**Need help?** See detailed node configurations in `node-configurations.md`

