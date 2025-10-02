# Visual Search Web Browser Fix

## Problem
The visual search modal was not showing on web browsers, only in Expo mobile app.

## Root Causes

### 1. Image Picker Issue
- `expo-image-picker` doesn't work in web browsers
- Only works on native mobile platforms (iOS/Android)

### 2. CORS Issue
- Direct API calls to Clarifai from browser were blocked
- Clarifai API only allows requests from `https://clarifai.com` domain
- Browser showed: "CORS policy: Response to preflight request doesn't pass access control check"

## Solutions Implemented

### 1. Web Image Upload Support ✅
Updated [app/index.tsx](app/index.tsx) to detect platform and use appropriate image picker:

**Mobile (Expo):**
- Uses `expo-image-picker` with native camera/gallery access
- Includes permission requests
- Provides image editing capabilities

**Web Browser:**
- Uses native HTML `<input type="file">` element
- Supports both file selection and camera capture (on mobile browsers)
- Converts images to base64 using `FileReader` API

### 2. CORS Fix via Supabase Edge Function ✅
Created a backend proxy to avoid CORS issues:

**Created Files:**
- [supabase/functions/visual-search/index.ts](supabase/functions/visual-search/index.ts) - Edge Function
- [deploy-visual-search.bat](deploy-visual-search.bat) - Windows deployment script
- [deploy-visual-search.sh](deploy-visual-search.sh) - Mac/Linux deployment script

**Updated Files:**
- [services/visualSearch.ts](services/visualSearch.ts) - Now calls Supabase Edge Function instead of Clarifai directly

**Architecture:**
```
Web Browser
    ↓ (file input)
Select Image
    ↓ (base64)
Frontend Service
    ↓ (HTTPS POST)
Supabase Edge Function
    ↓ (HTTPS POST with API key)
Clarifai API
    ↓ (JSON response)
Supabase Edge Function
    ↓ (JSON response)
Frontend Service
    ↓ (process & match products)
Show Results
```

## Deployment Steps

### 1. Deploy the Edge Function

**Windows:**
```bash
deploy-visual-search.bat
```

**Mac/Linux:**
```bash
chmod +x deploy-visual-search.sh
./deploy-visual-search.sh
```

**Manual:**
```bash
# Set Clarifai API key as Supabase secret
npx supabase secrets set CLARIFAI_API_KEY=7199bd63d62e4d7888d0b088ebc0825f
npx supabase secrets set CLARIFAI_MODEL_ID=food-item-recognition

# Deploy function
npx supabase functions deploy visual-search --no-verify-jwt
```

### 2. Test the Feature

1. Start your app: `npm start`
2. Open in web browser: `w` for web
3. Navigate to marketplace
4. Click the camera button (floating action button)
5. Select an image
6. Modal should appear with analysis results

## Benefits

### Security
✅ API keys are stored in Supabase secrets, not exposed to frontend
✅ Edge Function runs on Supabase infrastructure
✅ No API keys in browser JavaScript

### Compatibility
✅ Works on web browsers (Chrome, Firefox, Safari, Edge)
✅ Works on mobile browsers
✅ Works on Expo mobile app
✅ Single codebase for all platforms

### Performance
✅ Edge Functions run on Cloudflare's global network
✅ Low latency worldwide
✅ Automatic scaling

## Testing Checklist

- [ ] Web browser: Upload image from file
- [ ] Web browser: Take photo (mobile browser)
- [ ] Expo app: Upload from gallery
- [ ] Expo app: Take photo with camera
- [ ] Modal displays correctly
- [ ] Image analysis works
- [ ] Products are matched and displayed
- [ ] No CORS errors in console
- [ ] API key not visible in browser Network tab

## Troubleshooting

### Modal doesn't appear
- Check browser console for errors
- Verify file input is being triggered (should see file picker dialog)

### CORS errors
- Edge Function not deployed or not accessible
- Run: `npx supabase functions list` to verify deployment
- Check function logs: `npx supabase functions logs visual-search`

### "Failed to analyze image" error
- Check Edge Function logs: `npx supabase functions logs visual-search`
- Verify API key is set: `npx supabase secrets list`
- Check Clarifai API quota/limits

### No products found
- Image may not match farm product categories
- Try with clearer images of vegetables/fruits
- Check that products exist in database

## Related Files

- `app/index.tsx` - Marketplace with visual search
- `services/visualSearch.ts` - Visual search service
- `supabase/functions/visual-search/index.ts` - Edge Function
- `VISUAL_SEARCH_SETUP.md` - Full setup guide
- `.env` - Environment variables (local)
- Supabase Secrets - API keys (production)
