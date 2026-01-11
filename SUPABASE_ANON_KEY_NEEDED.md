# ⚠️ ACTION REQUIRED: Add Your Supabase Anon Key

The email extraction is now configured to POST directly to Supabase REST API, but you need to add your Supabase anon key.

## 🔑 Get Your Supabase Anon Key

1. Go to https://app.supabase.com
2. Select your project: `wrayzjdnlimxzqcswots`
3. Go to **Settings** > **API**
4. Copy the **`anon` `public`** key (NOT the service_role key)

## 📝 Update popup.js

Open `popup.js` and update line 4:

**Current (line 4):**
```javascript
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // REPLACE THIS
```

**Replace with your actual anon key:**
```javascript
const SUPABASE_ANON_KEY = 'YOUR_ACTUAL_ANON_KEY_HERE';
```

## ✅ After Updating

1. Save the file
2. Go to `chrome://extensions/`
3. Click **Reload** on Lasker extension
4. Test email extraction again

---

**The anon key is safe to use in the extension** - it's public and protected by Row Level Security (RLS) policies.

