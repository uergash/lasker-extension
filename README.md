# Lasker - Chrome Extension

A Chrome extension that captures customer insights from both voice recordings and email conversations. Automatically processes feedback into actionable product insights through your Supabase + n8n pipeline.

## Features

### Voice Recording
- **One-time email setup** - Stores user email locally for future recordings
- **Voice recording** - Record up to 2 minutes of audio feedback
- **Automatic transcription** - Audio is transcribed via Whisper API in the Supabase edge function
- **Seamless processing** - Recordings are automatically processed into insights by your n8n workflow

### Email Extraction (NEW)
- **Gmail integration** - Automatically detects when you're viewing an email in Gmail
- **One-click extraction** - Extract insights from customer emails with a single click
- **Smart parsing** - Removes signatures, quoted replies, and extracts key content
- **Email preview** - Review email details before submitting for processing
- **Multi-provider ready** - Architecture supports Outlook, Yahoo, and other providers

### General
- **Clean UI** - Modern, intuitive interface with visual feedback
- **Unified workflow** - Both voice and email insights flow through the same processing pipeline

## Architecture

### Voice Flow
```
Chrome Extension
    ↓ (POST audio + email)
Supabase Edge Function (submit-voice-insight)
    ↓ (Transcribe via Whisper API)
    ↓ (Insert to voice_submissions table)
n8n Workflow (Process Voice Submissions)
    ↓ (Extract insights + classify)
    ↓ (Insert to insights table)
```

### Email Flow
```
Gmail Interface
    ↓ (Extract email content)
Chrome Extension (Content Script)
    ↓ (Button click → Extract email data)
Extension Popup (Email Preview)
    ↓ (Confirm & submit)
n8n Webhook (Email Submission Processor)
    ↓ (Store in email_submissions table)
n8n Sub-workflow (Process Email Insights)
    ↓ (OpenAI extraction + 3-stage classification)
    ↓ (Insert to insights table with source="email")
```

## Setup Instructions

### 1. Generate Extension Icons

You need to create three PNG icon files:
- `icons/icon16.png` (16x16 pixels)
- `icons/icon48.png` (48x48 pixels)
- `icons/icon128.png` (128x128 pixels)

**Option A: Use the HTML generator**
1. Open `generate-icons.html` in your browser
2. Click the download buttons for each size
3. Save them in the `icons/` directory with the correct names

**Option B: Convert SVG to PNG**
1. Use an online tool or ImageMagick to convert `icons/icon.svg` to PNG at the required sizes
2. Save them in the `icons/` directory

**Option C: Create custom icons**
- Use any image editor to create microphone/voice-themed icons
- Ensure they are square PNG files at the specified sizes

### 2. Configure Webhook URLs (REQUIRED)

**Voice Function URL** - If your Supabase edge function URL is different, update it in `popup.js`:

```javascript
const VOICE_EDGE_FUNCTION_URL = 'https://your-project.supabase.co/functions/v1/submit-voice-insight';
```

**Email Webhook URL** - Update the n8n webhook URL for email submissions in `popup.js`:

```javascript
const EMAIL_WEBHOOK_URL = 'https://YOUR_N8N_INSTANCE/webhook/email-submission';
```

⚠️ **Important**: You must configure the `EMAIL_WEBHOOK_URL` before email extraction will work.

### 3. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the extension directory (`/Users/ubek/Jarvis Extention`)
5. The extension should now appear in your extensions list

### 4. Test the Extension

**Testing Voice Recording:**
1. Click the extension icon in your Chrome toolbar
2. Enter your work email when prompted
3. Click "Start Recording" and speak your feedback
4. Click "Stop Recording" when done (or wait for auto-stop at 2 minutes)
5. You should see a success message confirming submission

**Testing Email Extraction:**
1. Navigate to Gmail (mail.google.com)
2. Open any email
3. Look for the "Extract to Lasker" button in the Gmail toolbar
4. Click the button to extract the email
5. The extension popup will open with an email preview
6. Click "Extract Insights" to submit the email for processing
7. You should see a success message

## File Structure

```
Lasker Extention/
├── manifest.json                 # Extension configuration
├── popup.html                    # Extension popup UI
├── popup.css                     # Extension styling
├── popup.js                      # Extension logic (voice + email)
├── background.js                 # Service worker (message routing)
├── offscreen.html                # Offscreen document for recording
├── offscreen.js                  # Audio recording handler
├── content-scripts/
│   ├── gmail.js                 # Gmail detection & button injection
│   └── gmail.css                # Gmail UI styling
├── icons/
│   ├── icon16.png               # 16x16 icon (required)
│   ├── icon48.png               # 48x48 icon (required)
│   └── icon128.png              # 128x128 icon (required)
├── generate-icons.html           # Icon generator tool
└── README.md                    # This file
```

## Configuration

### Voice Recording URL

The extension is configured to use:
```
https://wrayzjdnlimxzqcswots.supabase.co/functions/v1/submit-voice-insight
```

To change this, edit the `VOICE_EDGE_FUNCTION_URL` constant in `popup.js`.

### Email Webhook URL

**Required Configuration**: You must set up an n8n webhook and update the URL in `popup.js`:

```javascript
const EMAIL_WEBHOOK_URL = 'https://YOUR_N8N_INSTANCE/webhook/email-submission';
```

The webhook should expect this payload format:
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

### Maximum Recording Duration

The extension enforces a 2-minute (120 seconds) maximum recording duration. This is configured in both:
- `popup.js`: `MAX_DURATION_SECONDS = 120`
- Edge function: `MAX_DURATION_SECONDS = 120`

## How It Works

### Voice Recording Flow

1. **First Use**: User enters their work email, which is stored locally using `chrome.storage.local`

2. **Recording**: 
   - User clicks "Start Recording"
   - Extension requests microphone permission
   - Audio is captured using MediaRecorder API (webm format)
   - Timer displays remaining time (countdown from 2 minutes)
   - Auto-stops at 2 minutes or when user clicks "Stop"

3. **Submission**:
   - Audio is converted to base64
   - POST request sent to Supabase edge function with:
     - `audio_base64`: Base64-encoded webm audio
     - `user_email`: User's email
     - `source_url`: Current tab URL (optional)
     - `user_agent`: Browser user agent (optional)
     - `duration_seconds`: Recording duration

4. **Processing**:
   - Edge function transcribes audio via Whisper API
   - Inserts transcript into `voice_submissions` table (status: pending)
   - n8n workflow processes pending submissions every 15 minutes
   - Insights are extracted, classified, and inserted into `insights` table

### Email Extraction Flow

1. **Gmail Detection**: 
   - Content script (`gmail.js`) automatically detects when viewing an email
   - Monitors URL changes and DOM updates (Gmail is a Single Page App)
   - Only activates in email view (not list view)

2. **Button Injection**:
   - "Extract to Lasker" button appears in Gmail's toolbar
   - Styled to match Gmail's native interface
   - Positioned near reply/forward buttons

3. **Email Extraction**:
   - User clicks "Extract to Lasker" button
   - Content script extracts:
     - Sender name and email
     - Subject line
     - Email body (last message in thread)
     - Date, thread ID, labels
   - Smart cleaning: removes signatures, quoted replies, common patterns
   - Stores data temporarily and opens extension popup

4. **Preview & Confirmation**:
   - Extension popup shows email preview:
     - From/To information
     - Subject line
     - Body snippet (first 200 chars)
   - User confirms by clicking "Extract Insights"

5. **Submission**:
   - POST request sent to n8n webhook with:
     - Full email data (from, subject, body, metadata)
     - User identification
     - Source information (Gmail thread ID, URL)

6. **Processing** (n8n):
   - Webhook receives email data
   - Stores in `email_submissions` table
   - Sub-workflow extracts insights using OpenAI
   - Three-stage classification (semantic search → feature → journey stage)
   - Insights inserted into `insights` table with `source="email"`

## Troubleshooting

### Voice Recording Issues

**Microphone Permission Denied**
- Click the extension icon
- Click the lock icon in the address bar
- Ensure microphone permission is allowed
- Refresh and try again

**Recording Not Starting**
- Check that your microphone is connected and working
- Ensure no other application is using the microphone
- Try refreshing the extension popup

**Voice Submission Fails**
- Check your internet connection
- Verify the edge function URL is correct
- Check browser console for error details (F12 → Console)
- Ensure the edge function is deployed and accessible

### Email Extraction Issues

**Button Not Appearing in Gmail**
- Refresh the Gmail page
- Make sure you're viewing an email (not the inbox list)
- Check that the extension is enabled in `chrome://extensions/`
- Check browser console (F12 → Console) for errors

**Email Extraction Fails**
- Verify the `EMAIL_WEBHOOK_URL` is configured in `popup.js`
- Check that the n8n webhook is accessible
- Verify the webhook is expecting the correct payload format
- Check browser console and n8n logs for errors

**Email Preview Shows Empty Content**
- Gmail's DOM structure may have changed
- Check browser console for extraction errors
- Try refreshing Gmail and reopening the email

### General Issues

**No Icons Showing**
- Ensure all three icon files exist in the `icons/` directory
- Verify file names match exactly: `icon16.png`, `icon48.png`, `icon128.png`
- Reload the extension after adding icons

**Extension Not Loading**
- Check that all required files are present
- Verify `manifest.json` is valid JSON
- Check for errors in `chrome://extensions/` with Developer mode enabled

## Development

### Testing Locally

1. Make changes to extension files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

### Debugging

1. Right-click the extension icon → "Inspect popup"
2. Use Chrome DevTools to debug JavaScript
3. Check the Console tab for errors
4. Check the Network tab to see API requests

## Security & Privacy

- **Email storage**: User email is stored locally in the browser (`chrome.storage.local`)
- **Voice data**: Audio is sent directly to your Supabase edge function
- **Email data**: Email content is extracted client-side and sent to your n8n instance
- **No third-party tracking**: No analytics or third-party services involved
- **Minimal permissions**: Extension only requests necessary permissions:
  - `storage`: Store user email and temporary email data
  - `activeTab`: Access current tab URL for context
  - `offscreen`: Record audio in background
  - `tabs`: Detect Gmail tabs
  - `host_permissions`: Access Gmail and your backend services
- **Gmail access**: Content script only activates on `mail.google.com`
- **Data retention**: Email data is cleared from local storage after submission

## Future Enhancements

Potential improvements for future versions:

**Email Features:**
- Outlook Web / Office 365 support
- Yahoo Mail, ProtonMail, FastMail support
- Batch email extraction (select multiple emails)
- Thread history preservation
- Attachment metadata extraction
- Customer/contact auto-linking

**Voice Features:**
- OAuth/SSO integration for automatic user identification
- Multi-product support (routing to different backends)
- Recording history/viewing past submissions
- Offline recording with sync when online
- Customizable recording duration limits

**General:**
- Dashboard view of submitted insights
- Real-time processing status
- Browser notifications when insights are processed
- Keyboard shortcuts for quick capture
- Dark mode support

## Next Steps

### Phase 1 (Current) ✅
- [x] Gmail detection and UI injection
- [x] Email extraction and parsing
- [x] Extension popup with email preview
- [x] Message passing between content script and extension

### Phase 2 (To Be Built)
- [ ] **n8n Workflow Setup**:
  - [ ] Create "Email Flow - Submission Processor" workflow
  - [ ] Create "Email Flow - Process Insights" sub-workflow
  - [ ] Set up webhook endpoint
  - [ ] Configure OpenAI integration
  - [ ] Set up three-stage classification
- [ ] **Database Setup**:
  - [ ] Create `email_submissions` table in Supabase
  - [ ] Add `email_submission_id` column to `insights` table
  - [ ] Set up indexes for performance

### Phase 3 (Future)
- [ ] Multi-provider support (Outlook, Yahoo, etc.)
- [ ] Thread detection and deduplication
- [ ] Customer auto-linking by email domain
- [ ] Advanced reply chain parsing

## License

Internal use for product intelligence platform.

