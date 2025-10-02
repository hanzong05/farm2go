@echo off
REM Deploy Visual Search Edge Function to Supabase

echo 🚀 Deploying Visual Search Edge Function...
echo.

REM Set secrets
echo 📝 Setting Clarifai API secrets...
call npx supabase secrets set CLARIFAI_API_KEY=7199bd63d62e4d7888d0b088ebc0825f
call npx supabase secrets set CLARIFAI_MODEL_ID=food-item-recognition

REM Deploy function
echo.
echo 📦 Deploying function...
call npx supabase functions deploy visual-search --no-verify-jwt

echo.
echo ✅ Deployment complete!
echo.
echo The visual search feature should now work on web browsers without CORS issues.
pause
