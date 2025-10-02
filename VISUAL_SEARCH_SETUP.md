# Visual Search Setup Guide

This guide will help you set up Clarifai API for the visual search feature in Farm2Go.

## Features

- **Image Upload**: Users can upload images from their gallery
- **Camera Capture**: Users can take photos directly with their camera
- **AI-Powered Analysis**: Clarifai API analyzes images to detect labels, categories, and objects
- **Web Support**: Works on both mobile (Expo) and web browsers using Supabase Edge Functions
- **Smart Product Matching**: Products are automatically matched based on detected labels and categories
- **Similarity Scoring**: Products are ranked by similarity to the uploaded image

## Setup Instructions

### 1. Get Clarifai API Key

1. Go to [Clarifai Portal](https://clarifai.com/)
2. Sign up or log in to your account
3. Go to Settings > Security
4. Create a Personal Access Token (PAT) or API Key
5. Copy the API key

### 2. Configure Environment Variables

Add the Clarifai API key to your `.env` file:

```env
EXPO_PUBLIC_CLARIFAI_API_KEY=your_api_key_here
EXPO_PUBLIC_CLARIFAI_MODEL_ID=food-item-recognition
```

### 3. Deploy Supabase Edge Function

The visual search feature uses a Supabase Edge Function to avoid CORS issues on web browsers.

**For Windows:**
```bash
deploy-visual-search.bat
```

**For Mac/Linux:**
```bash
chmod +x deploy-visual-search.sh
./deploy-visual-search.sh
```

**Or manually:**
```bash
# Set secrets
npx supabase secrets set CLARIFAI_API_KEY=your_api_key_here
npx supabase secrets set CLARIFAI_MODEL_ID=food-item-recognition

# Deploy function
npx supabase functions deploy visual-search --no-verify-jwt
```

### 4. Test the Feature

1. Start your app: `npm start` or `npx expo start`
2. Navigate to the marketplace
3. Click the camera button (floating action button) at the bottom right
4. Choose to upload an image or take a photo
5. The app will analyze the image and show similar products

## How It Works

### Image Analysis

The Clarifai API uses the `food-item-recognition` model to analyze images:

1. **Concept Detection**: Identifies food items, ingredients, and categories
   - Example: "tomato", "vegetable", "fresh produce", "red"

2. **Confidence Scores**: Each detected concept has a confidence score (0-1)
   - Higher scores indicate more confident predictions

### Product Matching Algorithm

The visual search service uses a scoring algorithm to match products:

1. **Category Match** (50 points): Direct match with product category
2. **Label Match** (10 points each): Labels found in product name/description
3. **Search Term Match** (5 points each): Web entities found in product details
4. **Confidence Multiplier**: Score is multiplied by the API's confidence level

Products with a score above 10 are shown, sorted by similarity.

## API Costs

Clarifai API pricing:
- **Community Plan**: 1,000 operations/month FREE
- **Essential Plan**: $30/month for 10,000 operations
- **Professional Plan**: Custom pricing for higher volumes

For development and small applications, the free tier is sufficient.

## Architecture

The visual search feature uses a backend proxy to avoid CORS issues:

1. **Mobile (Expo)**: Uses native image picker → Sends to Supabase Edge Function
2. **Web Browser**: Uses HTML file input → Sends to Supabase Edge Function
3. **Supabase Edge Function**: Proxies request to Clarifai API
4. **Clarifai API**: Analyzes image and returns concepts
5. **Frontend**: Processes results and matches products

## Troubleshooting

### "Failed to analyze image" Error

**Causes**:
- API key not configured or invalid
- Supabase Edge Function not deployed
- Network connectivity issues
- API quota exceeded

**Solutions**:
1. Double-check your API key is correct in Supabase secrets
2. Verify the Edge Function is deployed: `npx supabase functions list`
3. Check your internet connection
4. Review your API usage in Clarifai dashboard

### No Products Found

**Causes**:
- Image doesn't match any product categories
- Poor image quality
- Products database is empty

**Solutions**:
1. Try uploading a clearer image
2. Use images of fruits, vegetables, or other farm products
3. Ensure your products database has items

### Permission Errors

**Causes**:
- Camera or gallery permissions not granted

**Solutions**:
1. Go to app settings and grant camera/gallery permissions
2. Restart the app after granting permissions

## Extending the Feature

### Add More Categories

Edit `services/visualSearch.ts` and add categories to the `categoryMap`:

```typescript
const categoryMap: Record<string, string[]> = {
  your_category: ['keyword1', 'keyword2', 'keyword3'],
  // ...
};
```

### Customize Scoring

Modify the `calculateSimilarityScore` method to adjust weights:

```typescript
if (searchResult.categories.includes(product.category.toLowerCase())) {
  score += 100; // Increase category match weight
}
```

### Add More Detection Features

Google Cloud Vision API supports additional features:
- Face detection
- Logo detection
- Landmark detection
- Text detection (OCR)
- Safe search detection

Add them in the `analyzeImage` method:

```typescript
features: [
  { type: 'LABEL_DETECTION', maxResults: 10 },
  { type: 'WEB_DETECTION', maxResults: 10 },
  { type: 'TEXT_DETECTION' }, // Add text detection
],
```

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for sensitive data
3. **Implement API key rotation** regularly
4. **Set up API key restrictions** in Google Cloud Console
5. **Monitor API usage** to detect anomalies
6. **Use backend proxy** for production apps to hide API keys

## Resources

- [Clarifai Documentation](https://docs.clarifai.com/)
- [Clarifai Pricing](https://www.clarifai.com/pricing)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Expo ImagePicker Documentation](https://docs.expo.dev/versions/latest/sdk/imagepicker/)