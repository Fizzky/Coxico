# AdSense Troubleshooting Guide

## Why Ads Aren't Showing

### 1. **Environment Variables Not Set** (Most Common)

The ads won't show if these environment variables aren't configured:

**Required Variables:**
- `VITE_ADSENSE_CLIENT_ID` - Your Publisher ID (e.g., `ca-pub-1234567890`)
- `VITE_ADSENSE_LEFT_SLOT` - Left sidebar ad unit ID (e.g., `1234567890`)
- `VITE_ADSENSE_RIGHT_SLOT` - Right sidebar ad unit ID (e.g., `0987654321`)

**How to Set:**
1. **For Production (Vercel):**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add all three variables
   - Redeploy

2. **For Production (Railway):**
   - Go to Railway Dashboard → Your Service → Variables
   - Add all three variables
   - Redeploy

3. **For Local Development:**
   - Create `.env` file in `frontend/` directory
   - Add the variables:
     ```
     VITE_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXX
     VITE_ADSENSE_LEFT_SLOT=1234567890
     VITE_ADSENSE_RIGHT_SLOT=0987654321
     ```
   - Restart dev server

### 2. **AdSense Script Not Updated in index.html**

The `index.html` file still has a placeholder Publisher ID.

**Fix:**
1. Open `frontend/index.html`
2. Find line 18:
   ```html
   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXX"
   ```
3. Replace `ca-pub-XXXXXXXXXX` with your actual Publisher ID
4. Rebuild and redeploy

### 3. **AdSense Account Not Approved**

If your AdSense account is still pending approval:
- Ads won't show until approved (usually 1-7 days)
- Check AdSense dashboard for approval status

### 4. **Ad Blockers**

Browser ad blockers will hide ads:
- Disable ad blockers for testing
- Users with ad blockers won't see ads (this is normal)

### 5. **Ad Units Not Created**

Make sure you've created the ad units in AdSense:
1. Go to AdSense → Ads → By ad unit
2. Create two "Display ads"
3. Copy the Ad unit IDs
4. Use those IDs in environment variables

### 6. **Check Browser Console**

Open browser console (F12) and look for:
- `AdSense: No valid ad slot provided` → Environment variables not set
- `AdSense: Client ID not set` → VITE_ADSENSE_CLIENT_ID not set
- `AdSense: Script not loaded` → AdSense script not in index.html
- Any AdSense errors → Check AdSense dashboard

## Quick Checklist

- [ ] AdSense account approved?
- [ ] Environment variables set in deployment platform?
- [ ] `index.html` updated with real Publisher ID?
- [ ] Ad units created in AdSense dashboard?
- [ ] Ad unit IDs added to environment variables?
- [ ] Site redeployed after setting variables?
- [ ] Ad blockers disabled for testing?
- [ ] Checking on desktop (ads hidden on mobile < 1024px)?

## Testing Steps

1. **Check Environment Variables:**
   ```javascript
   // In browser console, check:
   console.log('Client ID:', import.meta.env.VITE_ADSENSE_CLIENT_ID);
   console.log('Left Slot:', import.meta.env.VITE_ADSENSE_LEFT_SLOT);
   console.log('Right Slot:', import.meta.env.VITE_ADSENSE_RIGHT_SLOT);
   ```

2. **Check AdSense Script:**
   ```javascript
   // In browser console:
   console.log('AdSense loaded:', typeof window.adsbygoogle !== 'undefined');
   ```

3. **Check Ad Elements:**
   - Open browser DevTools (F12)
   - Go to Elements tab
   - Search for "adsbygoogle"
   - Should see `<ins class="adsbygoogle">` elements

## Still Not Working?

1. **Wait 24-48 hours** - New ad units can take time to start showing
2. **Check AdSense Dashboard** - Look for any policy violations or issues
3. **Verify URL** - Make sure your site URL matches what's registered in AdSense
4. **Check Traffic** - AdSense might not show ads if there's no traffic

