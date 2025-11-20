# Google AdSense Setup Guide

This guide will help you set up Google AdSense advertising on your manga reader.

## Ad Providers Available

1. **Google AdSense** (Recommended) - Most popular, easy to set up, good revenue
2. **Media.net** - Alternative to AdSense
3. **PropellerAds** - Good for manga/anime sites
4. **Ezoic** - Requires more traffic but higher revenue

## Google AdSense Setup Steps

### 1. Create Google AdSense Account

1. Go to [Google AdSense](https://www.google.com/adsense/)
2. Sign up with your Google account
3. Add your website URL (`coxico.xyz`)
4. Wait for approval (can take 1-7 days)

### 2. Get Your AdSense Publisher ID

After approval, you'll get a Publisher ID that looks like: `ca-pub-XXXXXXXXXX`

### 3. Create Ad Units

1. In AdSense dashboard, go to **Ads** → **By ad unit**
2. Create two **Display ads**:
   - **Left Sidebar Ad** - Name it "Manga Reader Left"
   - **Right Sidebar Ad** - Name it "Manga Reader Right"
3. Choose **Display ad** format
4. Size: **160x600** (Skyscraper) or **300x600** (Half Page)
5. Copy the **Ad unit ID** for each (looks like: `1234567890`)

### 4. Configure Environment Variables

Add these to your `.env` file or deployment environment:

```env
VITE_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXX
VITE_ADSENSE_LEFT_SLOT=1234567890
VITE_ADSENSE_RIGHT_SLOT=0987654321
```

**For Production (Vercel/Railway):**
- Go to your deployment platform's environment variables
- Add the three variables above
- Redeploy your frontend

### 5. Update index.html

Replace `ca-pub-XXXXXXXXXX` in `frontend/index.html` with your actual Publisher ID:

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-YOUR-ACTUAL-ID"
     crossorigin="anonymous"></script>
```

### 6. Deploy and Test

1. Deploy your changes
2. Visit your manga reader page
3. Check browser console for any AdSense errors
4. Ads should appear on left and right sides (desktop only)

## Ad Placement

- **Left Side**: Sticky vertical ad (160px wide)
- **Right Side**: Sticky vertical ad (160px wide)
- **Mobile**: Ads are hidden on screens < 1024px (better UX)

## Troubleshooting

### Ads Not Showing?

1. **Check AdSense Approval**: Make sure your site is approved
2. **Check Environment Variables**: Ensure they're set correctly
3. **Check Browser Console**: Look for AdSense errors
4. **Ad Blockers**: Disable ad blockers for testing
5. **Wait Time**: New ads can take 24-48 hours to start showing

### Common Errors

- **"adsbygoogle.push() error"**: AdSense script not loaded - check index.html
- **"No slot ID"**: Environment variables not set
- **"Ad blocked"**: User has ad blocker enabled

## Revenue Tips

1. **Placement**: Current placement (left/right) is optimal for manga reading
2. **Ad Types**: Display ads work best for manga sites
3. **Traffic**: More page views = more revenue
4. **User Experience**: Don't add too many ads - current setup is balanced

## Alternative Ad Networks

If Google AdSense doesn't approve you or you want alternatives:

### Media.net
- Similar to AdSense
- Better approval rate
- Setup similar to AdSense

### PropellerAds
- Good for manga/anime sites
- Pop-under ads (less intrusive)
- Higher CPM rates

### Ezoic
- Requires 10k+ monthly visitors
- Uses AI to optimize ad placement
- Higher revenue potential

## Support

For AdSense issues, contact:
- Google AdSense Support: https://support.google.com/adsense
- Check AdSense Help Center for common issues

