@echo off
echo ================================
echo Farm2Go Production Debug Helper
echo ================================
echo.

echo Checking connected devices...
adb devices
echo.

echo Select an option:
echo 1. Build and install production APK with logs
echo 2. View live logs (ADB logcat)
echo 3. Export crash logs to file
echo 4. Clear logs and start fresh
echo 5. Check Google Maps in logs
echo.

set /p choice="Enter choice (1-5): "

if "%choice%"=="1" (
    echo.
    echo Building production APK...
    call npx expo run:android --variant release
    echo.
    echo Installing APK and starting logs...
    adb logcat -c
    adb logcat ^| findstr /C:"Farm2Go" /C:"ReactNative" /C:"AndroidRuntime" /C:"FATAL"
) else if "%choice%"=="2" (
    echo.
    echo Starting live logs (Press Ctrl+C to stop)...
    adb logcat -c
    adb logcat ^| findstr /C:"Farm2Go" /C:"ReactNative" /C:"AndroidRuntime" /C:"FATAL" /C:"ERROR"
) else if "%choice%"=="3" (
    echo.
    echo Exporting logs to crash_log.txt...
    adb logcat -d > crash_log.txt
    echo Done! Check crash_log.txt
    start crash_log.txt
) else if "%choice%"=="4" (
    echo.
    echo Clearing logs...
    adb logcat -c
    echo Logs cleared. Starting fresh log capture...
    adb logcat ^| findstr /C:"Farm2Go" /C:"ReactNative" /C:"AndroidRuntime" /C:"FATAL"
) else if "%choice%"=="5" (
    echo.
    echo Checking Google Maps logs...
    adb logcat ^| findstr /I /C:"google" /C:"maps" /C:"location"
) else (
    echo Invalid choice!
)

pause
