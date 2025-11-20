# Google AdSense Configuration Guide

## Recommended Settings for Coxico

### Option 1: Auto Ads + Custom Sidebar Ads (Recommended)

**Auto Ads Settings:**
1. **Keep Auto ads ON** ✅
2. **Excluded Pages:**
   - Add pattern: `/manga/*/chapter/*` (excludes manga reader pages)
   - This prevents Auto ads from showing on manga reader pages where you have custom sidebar ads

**Ad Formats to Enable:**
- **In-page formats**: Enable (for homepage, browse pages)
- **Overlay formats**: Disable (can be intrusive)
- **Intent-driven formats**: Enable (for better targeting)

**Result:**
- Auto ads show on: Homepage, Browse, Popular, New Releases, Profile pages
- Custom sidebar ads show on: Manga Reader pages only
- No ad conflicts or duplicate ads

### Option 2: Custom Ads Only

**Auto Ads Settings:**
1. **Turn Auto ads OFF** ❌
2. Only your custom sidebar ads will show

**Result:**
- Custom sidebar ads only on manga reader
- No ads on other pages
- Full control over ad placement

## Step-by-Step Configuration

### To Exclude Manga Reader Pages:

1. In AdSense dashboard, go to **Ad settings** → **Auto ads**
2. Click on **"Excluded pages"** (the arrow next to it)
3. Click **"Add exclusion"**
4. Add URL pattern: `/manga/*/chapter/*`
5. Click **"Save"**
6. Click **"Apply to site"** at the bottom

### Recommended Ad Format Settings:

**In-page formats (1/3 enabled):**
- ✅ **In-article ads**: Enable (good for content pages)
- ❌ **In-feed ads**: Disable (can clutter manga lists)
- ❌ **Matched content**: Disable (not needed)

**Overlay formats (2/3 enabled):**
- ❌ **Anchor ads**: Disable (can be annoying)
- ❌ **Vignette ads**: Disable (full-screen ads are intrusive)
- ❌ **Sidebar ads**: Disable (you have custom ones)

**Intent-driven formats:**
- ✅ **Auto ads**: Enable (for better revenue)

## Why This Configuration?

1. **Better User Experience**: Custom sidebar ads don't interfere with reading
2. **More Revenue**: Auto ads on other pages + custom ads on reader = more ad space
3. **No Conflicts**: Excluding reader pages prevents duplicate ads
4. **Mobile Friendly**: Auto ads adapt better on mobile for non-reader pages

## Testing

After configuration:
1. Visit your homepage - should see Auto ads
2. Visit a manga reader page - should see ONLY custom sidebar ads (no Auto ads)
3. Check browser console for any AdSense errors

## Troubleshooting

**If you see ads on manga reader pages:**
- Check that exclusions are saved correctly
- Wait 24-48 hours for changes to propagate
- Clear browser cache

**If no ads showing:**
- Check that AdSense account is approved
- Verify environment variables are set
- Check browser console for errors

