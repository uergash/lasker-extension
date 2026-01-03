# Voice Insight Capture - Chrome Extension

A Chrome extension that allows users to record voice feedback (up to 2 minutes) and automatically process it into product insights through your existing Supabase + n8n pipeline.

## Features

- **One-time email setup** - Stores user email locally for future recordings
- **Voice recording** - Record up to 2 minutes of audio feedback
- **Automatic transcription** - Audio is transcribed via Whisper API in the Supabase edge function
- **Seamless processing** - Recordings are automatically processed into insights by your n8n workflow
- **Clean UI** - Modern, intuitive interface with visual feedback

## Architecture

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

### 2. Configure Edge Function URL (if needed)

If your Supabase edge function URL is different, update it in `popup.js`:

```javascript
const EDGE_FUNCTION_URL = 'https://your-project.supabase.co/functions/v1/submit-voice-insight';
```

### 3. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the extension directory (`/Users/ubek/Jarvis Extention`)
5. The extension should now appear in your extensions list

### 4. Test the Extension

1. Click the extension icon in your Chrome toolbar
2. Enter your work email when prompted
3. Click "Start Recording" and speak your feedback
4. Click "Stop Recording" when done (or wait for auto-stop at 2 minutes)
5. You should see a success message confirming submission

## File Structure

```
Jarvis Extention/
├── manifest.json          # Extension configuration
├── popup.html             # Extension popup UI
├── popup.css              # Extension styling
├── popup.js               # Extension logic
├── icons/
│   ├── icon.svg          # Source SVG icon
│   ├── icon16.png        # 16x16 icon (required)
│   ├── icon48.png        # 48x48 icon (required)
│   └── icon128.png       # 128x128 icon (required)
├── generate-icons.html    # Icon generator tool
└── README.md             # This file
```

## Configuration

### Edge Function URL

The extension is configured to use:
```
https://wrayzjdnlimxzqcswots.supabase.co/functions/v1/submit-voice-insight
```

To change this, edit the `EDGE_FUNCTION_URL` constant in `popup.js`.

### Maximum Recording Duration

The extension enforces a 2-minute (120 seconds) maximum recording duration. This is configured in both:
- `popup.js`: `MAX_DURATION_SECONDS = 120`
- Edge function: `MAX_DURATION_SECONDS = 120`

## How It Works

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

## Troubleshooting

### Microphone Permission Denied
- Click the extension icon
- Click the lock icon in the address bar
- Ensure microphone permission is allowed
- Refresh and try again

### Recording Not Starting
- Check that your microphone is connected and working
- Ensure no other application is using the microphone
- Try refreshing the extension popup

### Submission Fails
- Check your internet connection
- Verify the edge function URL is correct
- Check browser console for error details (F12 → Console)
- Ensure the edge function is deployed and accessible

### No Icons Showing
- Ensure all three icon files exist in the `icons/` directory
- Verify file names match exactly: `icon16.png`, `icon48.png`, `icon128.png`
- Reload the extension after adding icons

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

## Security Notes

- Email is stored locally in the browser (chrome.storage.local)
- Audio is sent directly to your Supabase edge function
- No third-party services are involved in the recording process
- The extension only requests necessary permissions (storage, activeTab)

## Future Enhancements

Potential improvements for future versions:
- OAuth/SSO integration for automatic user identification
- Multi-product support (routing to different backends)
- Recording history/viewing past submissions
- Offline recording with sync when online
- Customizable recording duration limits

## License

Internal use for Thrive product intelligence platform.

