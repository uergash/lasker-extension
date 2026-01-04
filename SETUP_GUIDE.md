# Email Extraction Setup Guide

## ✅ Phase 1 Complete - What's Built

### Chrome Extension (Frontend)
✅ **Gmail Content Script** (`content-scripts/gmail.js`)
- Automatically detects when viewing emails in Gmail
- Injects "Extract to Lasker" button into Gmail toolbar
- Extracts email content (sender, subject, body, metadata)
- Smart cleaning: removes signatures, quoted replies
- Notification system for user feedback

✅ **Extension Popup Enhancement** (`popup.html`, `popup.js`, `popup.css`)
- New email preview view showing extracted email
- Confirmation flow before submission
- Reuses existing authentication (user email)
- Seamless integration with existing voice recording UI

✅ **Background Service Worker** (`background.js`)
- Message routing between content script and popup
- Temporary storage of pending email data
- Unified message handling for voice and email

✅ **Manifest Configuration** (`manifest.json`)
- Gmail host permissions
- Content script declarations
- Updated version to 1.1.0

## 🚧 Phase 2 - What You Need to Build

### n8n Workflow Setup

#### 1. Create Email Webhook Endpoint

**Workflow Name**: "Email Flow - Submission Processor"

**Webhook Configuration**:
- Method: POST
- Path: `/webhook/email-submission`
- Authentication: None (or add API key if needed)
- Response: JSON

**Expected Payload**:
```json
{
  "type": "email",
  "email": {
    "from": {
      "name": "Customer Name",
      "email": "customer@company.com"
    },
    "subject": "Feature Request - Dark Mode",
    "body": "Full email text content...",
    "date": "2026-01-04T10:30:00Z",
    "threadId": "gmail-thread-id",
    "labels": ["Important", "Customer Feedback"],
    "sourceUrl": "https://mail.google.com/..."
  },
  "metadata": {
    "userId": "your.email@company.com",
    "timestamp": "2026-01-04T12:00:00Z",
    "source": "gmail"
  }
}
```

#### 2. Main Workflow Steps

1. **Webhook Trigger** - Receive email submission
2. **Validate Input** - Check required fields
3. **Insert to Supabase** - Store in `email_submissions` table:
   ```sql
   INSERT INTO email_submissions (
     user_id,
     from_email,
     from_name,
     subject,
     body,
     email_date,
     thread_id,
     source,
     metadata,
     processing_status
   ) VALUES (...)
   ```
4. **Execute Sub-workflow** - Call "Email Flow - Process Insights"
5. **Return Response**:
   ```json
   {
     "success": true,
     "submission_id": "uuid",
     "insights_extracted": 3
   }
   ```

#### 3. Create Sub-workflow: "Email Flow - Process Insights"

**Model after**: Voice Flow - Process Insights (21 nodes)

**Key Steps**:

1. **Extract Email Metadata**
   - Parse sender, subject, body
   - Build context string

2. **OpenAI Extraction** (Similar to voice flow)
   - Prompt: Extract distinct insights from email
   - Model: GPT-4 or GPT-3.5-turbo
   - Output: Array of insights

3. **Three-Stage Classification** (Per insight)
   
   **Stage 1: Semantic Search**
   - Search against existing features
   - Return top 5 matches
   
   **Stage 2: Feature Selection**
   - OpenAI picks best matching feature
   - Or marks as "New Feature"
   
   **Stage 3: Journey Stage**
   - Classify: Awareness / Consideration / Purchase / Retention / Advocacy

4. **Enrichment**
   - Link to customer (via email domain lookup)
   - Link to user (via sender email)
   - Store original email reference

5. **Insert to Supabase**
   ```sql
   INSERT INTO insights (
     content,
     feature_id,
     journey_stage,
     source,
     email_submission_id,
     customer_id,
     user_id,
     created_at
   ) VALUES (...)
   ```

6. **Update Email Submission Status**
   ```sql
   UPDATE email_submissions
   SET processing_status = 'completed',
       insights_extracted = [count]
   WHERE id = [submission_id]
   ```

#### 4. Email-Specific Enhancements

**Thread Detection**:
```javascript
// Check if thread already processed
const existingSubmission = await supabase
  .from('email_submissions')
  .select('id')
  .eq('thread_id', emailData.threadId)
  .single();

if (existingSubmission) {
  // Skip or update
}
```

**Reply Chain Parsing**:
- Extract only new content (not quoted text)
- Already handled in content script, but validate in n8n

**Signature Removal**:
- Already handled in content script
- Add additional server-side cleaning if needed

### Supabase Database Setup

#### 1. Create `email_submissions` Table

```sql
CREATE TABLE email_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  email_date TIMESTAMPTZ,
  thread_id TEXT,
  source TEXT DEFAULT 'gmail', -- gmail, outlook, etc.
  metadata JSONB, -- labels, cc, bcc, etc.
  processing_status TEXT DEFAULT 'pending',
  insights_extracted INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_email_submissions_user_id ON email_submissions(user_id);
CREATE INDEX idx_email_submissions_thread_id ON email_submissions(thread_id);
CREATE INDEX idx_email_submissions_processing_status ON email_submissions(processing_status);
CREATE INDEX idx_email_submissions_created_at ON email_submissions(created_at);
```

#### 2. Update `insights` Table

```sql
-- Add email reference column
ALTER TABLE insights 
ADD COLUMN email_submission_id UUID REFERENCES email_submissions(id);

-- Index for lookups
CREATE INDEX idx_insights_email_submission ON insights(email_submission_id);
```

## 🔧 Configuration Required

### 1. Update Extension with Webhook URL

Edit `popup.js` line 3:

```javascript
const EMAIL_WEBHOOK_URL = 'https://YOUR_N8N_INSTANCE/webhook/email-submission';
```

Replace `YOUR_N8N_INSTANCE` with your actual n8n webhook URL.

### 2. Reload Extension

1. Go to `chrome://extensions/`
2. Find "Lasker" extension
3. Click the refresh icon ↻

## 🧪 Testing the Extension

### Step 1: Load Extension
```bash
cd "/Users/uergash/Desktop/Lasker Extention"
# Extension files are ready - just reload in Chrome
```

1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Reload" on the Lasker extension

### Step 2: Test Gmail Integration

1. Open Gmail: https://mail.google.com
2. Click on any email to open it
3. Look for "Extract to Lasker" button in the toolbar
4. Click the button
5. Extension popup should open with email preview

### Step 3: Configure Webhook (before full test)

Before clicking "Extract Insights" button, you need to:
1. Set up the n8n webhook (see Phase 2 above)
2. Update `EMAIL_WEBHOOK_URL` in `popup.js`
3. Reload the extension

### Step 4: Full End-to-End Test

1. Extract an email from Gmail
2. Confirm in popup
3. Check n8n execution log
4. Verify data in `email_submissions` table
5. Verify insights in `insights` table

## 📊 What Gets Extracted

From a typical customer email:

**Input** (Gmail):
```
From: Sarah Johnson <sarah@startup.com>
Subject: Feature Request - Bulk Export

Hi there,

We love your product but really need the ability to export 
all our data at once. Currently we have to export each 
item individually which takes forever.

Also, it would be great to have CSV format support.

Best regards,
Sarah
```

**Extracted Data**:
```json
{
  "from": {
    "name": "Sarah Johnson",
    "email": "sarah@startup.com"
  },
  "subject": "Feature Request - Bulk Export",
  "body": "We love your product but really need...",
  "date": "2026-01-04T10:30:00Z",
  "threadId": "18cf2a3b...",
  "labels": ["Customer Feedback"],
  "sourceUrl": "https://mail.google.com/..."
}
```

**Processed Insights** (n8n → Supabase):
1. "Need bulk data export functionality" → Feature: Data Export → Stage: Consideration
2. "Want CSV format support" → Feature: Export Formats → Stage: Consideration

## 🎯 Next Steps Priority

1. **Immediate**: Set up n8n webhook endpoint
2. **Required**: Create `email_submissions` table
3. **Required**: Build n8n processing workflow
4. **Configuration**: Update `EMAIL_WEBHOOK_URL` in extension
5. **Testing**: Full end-to-end test with real email
6. **Optional**: Add thread deduplication logic
7. **Optional**: Enhance with customer auto-linking

## 🐛 Troubleshooting

### Button Not Showing
- Clear browser cache and reload Gmail
- Check console: F12 → Console tab
- Verify content script is loaded: `[Lasker] Gmail content script loaded`

### Email Extraction Fails
- Check if `EMAIL_WEBHOOK_URL` is configured
- Verify n8n webhook is accessible (test with curl/Postman)
- Check browser console for errors
- Check n8n execution logs

### Empty Email Body
- Gmail's DOM may have changed
- Check console for extraction errors
- Try different types of emails (plain text vs HTML)

## 📝 Files Modified/Created

**New Files**:
- `content-scripts/gmail.js` - Gmail integration (406 lines)
- `content-scripts/gmail.css` - Gmail button styling

**Modified Files**:
- `manifest.json` - Added content scripts and permissions
- `popup.html` - Added email preview view
- `popup.js` - Added email submission logic
- `popup.css` - Added email preview styling
- `background.js` - Added email message handling
- `README.md` - Comprehensive documentation

**Total Changes**: 995 insertions, 37 deletions across 8 files

## 🚀 Future Enhancements (Phase 3+)

- **Outlook Web Support**: Extend to Outlook.com
- **Yahoo Mail Support**: Additional email provider
- **Batch Extraction**: Select multiple emails
- **Smart Threading**: Detect and link email threads
- **Customer Auto-link**: Match by email domain
- **Attachment References**: Extract attachment metadata
- **Keyboard Shortcuts**: Quick extraction hotkey

---

**Questions?** Check the main [README.md](README.md) for detailed documentation.

