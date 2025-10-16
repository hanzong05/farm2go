@echo off
echo ===================================
echo Clean Rebuild Script for Farm2Go
echo ===================================
echo.

echo Step 1: Uninstalling old app...
adb uninstall com.farm2go.app
echo.

echo Step 2: Cleaning Android build cache...
cd android
call gradlew clean
cd ..
echo.

echo Step 3: Deleting build directories...
rmdir /s /q android\app\build 2>nul
rmdir /s /q android\build 2>nul
echo.

echo Step 4: Rebuilding app...
echo This will take a few minutes...
call npx expo run:android
echo.

echo ===================================
echo Done! Check if map works now.
echo ===================================
pause
