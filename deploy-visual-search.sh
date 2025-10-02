#!/bin/bash
# Deploy Visual Search Edge Function to Supabase

echo "🚀 Deploying Visual Search Edge Function..."

# Set secrets
echo "📝 Setting Clarifai API secrets..."
npx supabase secrets set CLARIFAI_API_KEY=7199bd63d62e4d7888d0b088ebc0825f
npx supabase secrets set CLARIFAI_MODEL_ID=food-item-recognition

# Deploy function
echo "📦 Deploying function..."
npx supabase functions deploy visual-search --no-verify-jwt

echo "✅ Deployment complete!"
echo ""
echo "The visual search feature should now work on web browsers without CORS issues."
