# Visual Search Setup Guide

This guide will help you set up Google Cloud Vision API for the visual search feature in Farm2Go.

## Features

- **Image Upload**: Users can upload images from their gallery
- **Camera Capture**: Users can take photos directly with their camera
- **AI-Powered Analysis**: Google Cloud Vision API analyzes images to detect labels, categories, and objects
- **Smart Product Matching**: Products are automatically matched based on detected labels and categories
- **Similarity Scoring**: Products are ranked by similarity to the uploaded image

## Setup Instructions

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable billing for your project (required for Vision API)

### 2. Enable Vision API

1. In the Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Cloud Vision API"
3. Click on it and press **Enable**

### 3. Create API Key

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **API Key**
3. Copy the generated API key
4. (Optional but recommended) Restrict the API key:
   - Click on the API key to edit
   - Under "API restrictions", select "Restrict key"
   - Choose "Cloud Vision API"
   - Save

### 4. Configure the App

1. Open `services/visualSearch.ts`
2. Replace `YOUR_GOOGLE_CLOUD_VISION_API_KEY` with your actual API key:

```typescript
const GOOGLE_VISION_API_KEY = 'YOUR_ACTUAL_API_KEY_HERE';
```

**Important Security Note**: For production apps, never hardcode API keys in your source code. Instead:
- Use environment variables (`.env` files)
- Store keys in secure backend services
- Use API key restrictions and monitoring

### 5. Test the Feature

1. Start your app: `npm start` or `npx expo start`
2. Navigate to the marketplace
3. Click the camera button (floating action button) at the bottom right
4. Choose to upload an image or take a photo
5. The app will analyze the image and show similar products

## How It Works

### Image Analysis

The Google Cloud Vision API provides two main detection features:

1. **Label Detection**: Identifies objects, concepts, and themes in the image
   - Example: "vegetable", "tomato", "red", "fresh produce"

2. **Web Detection**: Finds similar images on the web and provides entity information
   - Example: Best guess labels like "organic tomato" or "roma tomato"

### Product Matching Algorithm

The visual search service uses a scoring algorithm to match products:

1. **Category Match** (50 points): Direct match with product category
2. **Label Match** (10 points each): Labels found in product name/description
3. **Search Term Match** (5 points each): Web entities found in product details
4. **Confidence Multiplier**: Score is multiplied by the API's confidence level

Products with a score above 10 are shown, sorted by similarity.

## API Costs

Google Cloud Vision API pricing (as of 2024):
- First 1,000 requests/month: **FREE**
- 1,001-5,000,000 requests: $1.50 per 1,000 requests
- 5,000,001+ requests: $0.60 per 1,000 requests

For most small to medium applications, you'll stay within the free tier.

## Troubleshooting

### "Failed to analyze image" Error

**Causes**:
- API key not configured or invalid
- Vision API not enabled in Google Cloud
- Network connectivity issues
- API quota exceeded

**Solutions**:
1. Double-check your API key is correct
2. Verify Vision API is enabled in Google Cloud Console
3. Check your internet connection
4. Review your API usage in Google Cloud Console

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

- [Google Cloud Vision API Documentation](https://cloud.google.com/vision/docs)
- [Vision API Pricing](https://cloud.google.com/vision/pricing)
- [API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys)
- [Expo ImagePicker Documentation](https://docs.expo.dev/versions/latest/sdk/imagepicker/)