import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

interface WebCameraProps {
  onPhotoTaken: (photoUri: string) => void;
  type: 'id' | 'face';
}

export default function WebCamera({ onPhotoTaken, type }: WebCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showPermissionDenied, setShowPermissionDenied] = useState(false);
  const [isWebPlatform, setIsWebPlatform] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastError, setLastError] = useState<string>('');
  const [currentCamera, setCurrentCamera] = useState<'user' | 'environment'>('environment');
  const [actualCamera, setActualCamera] = useState<'user' | 'environment' | 'unknown'>('unknown');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Debug logging for state changes
  useEffect(() => {
    console.log('🔍 State Debug:', {
      isStreaming,
      hasPermission,
      showPermissionDenied,
      isInitializing,
      isWebPlatform
    });
  }, [isStreaming, hasPermission, showPermissionDenied, isInitializing, isWebPlatform]);

  useEffect(() => {
    const webPlatform = Platform.OS === 'web' || typeof window !== 'undefined';
    console.log('WebCamera Platform.OS:', Platform.OS, 'isWebPlatform:', webPlatform);
    setIsWebPlatform(webPlatform);

    // Set initial camera based on type
    setCurrentCamera(type === 'face' ? 'user' : 'environment');
  }, [type]);

  const stopCamera = useCallback(() => {
    console.log('📹 Stopping camera...');

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clean up video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    // Remove video element from container
    if (videoContainerRef.current) {
      const videoElement = videoContainerRef.current.querySelector('video');
      if (videoElement) {
        videoElement.remove();
      }
    }

    setIsStreaming(false);
    setIsInitializing(false);
    setShowPermissionDenied(false);
    setActualCamera('unknown');
    setSelectedDeviceId(null);
    console.log('📹 Camera stopped');
  }, []);

  const findBestCameraDevice = useCallback((devices: MediaDeviceInfo[], facingMode: 'user' | 'environment'): string | null => {
    console.log('🔍 Finding best camera device for facingMode:', facingMode);
    console.log('🔍 Available devices:', devices.map(d => ({
      deviceId: d.deviceId.substring(0, 8) + '...',
      label: d.label || 'Unnamed Camera',
      kind: d.kind
    })));

    // Filter for video input devices only
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    if (videoDevices.length === 0) {
      console.warn('❌ No video input devices found');
      return null;
    }

    // If only one camera available, use it regardless of facing mode
    if (videoDevices.length === 1) {
      console.log('ℹ️ Only one camera available, using it:', videoDevices[0].label);
      return videoDevices[0].deviceId;
    }

    // Enhanced keywords for better camera detection on mobile devices
    const backCameraKeywords = [
      'back', 'rear', 'environment', 'world', 'main', 'primary',
      'camera2', 'camera 1', 'camera1', 'wide', 'telephoto',
      'back facing', 'rear facing', 'outward', 'external'
    ];
    const frontCameraKeywords = [
      'front', 'user', 'face', 'selfie', 'facetime', 'inner',
      'camera0', 'camera 0', 'camera0', 'front facing',
      'forward', 'internal', 'self', 'portrait'
    ];

    if (facingMode === 'environment') {
      // Look for back camera by label
      const backCamera = videoDevices.find(device => {
        const label = device.label.toLowerCase();
        return backCameraKeywords.some(keyword => label.includes(keyword));
      });

      if (backCamera) {
        console.log('✅ Found back camera by label:', backCamera.label);
        return backCamera.deviceId;
      }

      // Try to find devices that explicitly don't match front camera keywords
      const nonFrontCameras = videoDevices.filter(device => {
        const label = device.label.toLowerCase();
        return !frontCameraKeywords.some(keyword => label.includes(keyword));
      });

      if (nonFrontCameras.length > 0) {
        console.log('✅ Found non-front camera as back camera:', nonFrontCameras[0].label);
        return nonFrontCameras[0].deviceId;
      }

      // If multiple cameras and no clear back camera found, try the last device
      if (videoDevices.length > 1) {
        console.log('⚠️ Using last device as back camera fallback:', videoDevices[videoDevices.length - 1].label);
        return videoDevices[videoDevices.length - 1].deviceId;
      }
    } else {
      // Look for front camera by label
      const frontCamera = videoDevices.find(device => {
        const label = device.label.toLowerCase();
        return frontCameraKeywords.some(keyword => label.includes(keyword));
      });

      if (frontCamera) {
        console.log('✅ Found front camera by label:', frontCamera.label);
        return frontCamera.deviceId;
      }

      // Try to find devices that explicitly don't match back camera keywords
      const nonBackCameras = videoDevices.filter(device => {
        const label = device.label.toLowerCase();
        return !backCameraKeywords.some(keyword => label.includes(keyword));
      });

      if (nonBackCameras.length > 0) {
        console.log('✅ Found non-back camera as front camera:', nonBackCameras[0].label);
        return nonBackCameras[0].deviceId;
      }

      // If multiple cameras and no clear front camera found, use the first device
      console.log('⚠️ Using first device as front camera fallback:', videoDevices[0].label);
      return videoDevices[0].deviceId;
    }

    // Last resort - use any available device
    console.log('⚠️ Using any available device as fallback:', videoDevices[0].label);
    return videoDevices[0].deviceId;
  }, []);

  const startCamera = useCallback(async () => {
    if (!isWebPlatform) return;

    setIsInitializing(true);
    console.log('✅ Clearing showPermissionDenied - starting camera');
    setShowPermissionDenied(false);
    setLastError(''); // Clear any previous errors
    console.log('📷 Starting camera initialization...');

    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported by this browser');
      }

      // Check if we're in a secure context (HTTPS or localhost)
      if (!window.isSecureContext && location.hostname !== 'localhost') {
        throw new Error('Camera access requires HTTPS. Please use a secure connection.');
      }

      // First, check if any video input devices are available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      console.log('📱 Available video devices:', videoDevices.map(d => ({
        label: d.label || 'Camera',
        deviceId: d.deviceId.substring(0, 8) + '...'
      })));

      setAvailableDevices(devices);

      if (videoDevices.length === 0) {
        throw new Error('No camera found on this device');
      }

      console.log(`📷 Attempting to use ${currentCamera} camera (${videoDevices.length} devices available)`);
      console.log('📷 Current camera state:', {
        currentCamera,
        type,
        isInitializing,
        isStreaming
      });

      // Find the best device for the requested camera
      const targetDeviceId = selectedDeviceId || findBestCameraDevice(devices, currentCamera);
      console.log('🎯 Target device ID:', targetDeviceId?.substring(0, 8) + '...');

      if (targetDeviceId) {
        setSelectedDeviceId(targetDeviceId);
      }

      // Try different constraint sets, starting with explicit device selection
      const constraintSets: MediaStreamConstraints[] = [];

      // If we found a specific device, try using it first with exact deviceId
      if (targetDeviceId) {
        constraintSets.push(
          // Try with exact device ID and minimal constraints for mobile compatibility
          {
            video: {
              deviceId: { exact: targetDeviceId }
            }
          },
          // Try with exact device ID and basic resolution
          {
            video: {
              deviceId: { exact: targetDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          },
          // Try with ideal device ID
          {
            video: {
              deviceId: { ideal: targetDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          }
        );
      }

      // Add facingMode-based constraints as fallbacks
      constraintSets.push(
        // Try with exact facingMode only (best for mobile switching)
        {
          video: {
            facingMode: { exact: currentCamera }
          }
        },
        // Try with exact facingMode and basic resolution
        {
          video: {
            facingMode: { exact: currentCamera },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        // Try with ideal facingMode
        {
          video: {
            facingMode: { ideal: currentCamera }
          }
        },
        // Try with just facingMode
        {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: currentCamera
          }
        },
        // Fallback to any camera with basic quality
        {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        // Final fallback with minimal constraints
        {
          video: true
        }
      );

      let stream: MediaStream | null = null;
      let lastError: Error | null = null;

      for (const constraints of constraintSets) {
        try {
          console.log('🔄 Trying camera with constraints:', constraints);
          stream = await navigator.mediaDevices.getUserMedia(constraints);

          // Log which camera we actually got
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            const settings = videoTrack.getSettings();
            const actualFacingMode = settings.facingMode || 'unknown';
            console.log('✅ Camera stream obtained:', {
              requestedFacingMode: currentCamera,
              actualFacingMode: actualFacingMode,
              matchesRequest: actualFacingMode === currentCamera,
              width: settings.width,
              height: settings.height,
              deviceId: settings.deviceId?.substring(0, 8) + '...' || 'unknown'
            });

            // Update actual camera state
            if (actualFacingMode === 'user' || actualFacingMode === 'environment') {
              setActualCamera(actualFacingMode);
            } else {
              setActualCamera('unknown');
            }

            // If we didn't get the requested camera, log a warning
            if (actualFacingMode !== currentCamera && actualFacingMode !== 'unknown') {
              console.warn(`⚠️ Requested ${currentCamera} camera but got ${actualFacingMode} camera`);
            }
          }
          break;
        } catch (error) {
          lastError = error as Error;
          console.warn('❌ Failed with constraints:', constraints, error);
        }
      }

      if (!stream) {
        throw lastError || new Error('Failed to access camera with any constraints');
      }

      // Create video element directly for better mobile compatibility
      console.log('📹 Creating video element...');

      if (typeof window !== 'undefined') {
        // Check immediately since container is now always rendered
        if (!videoContainerRef.current) {
          console.error('❌ Video container not found');
          setIsInitializing(false);
          console.log('❌ Setting showPermissionDenied to true - video container not found');
          setLastError('Video container not found');
          setShowPermissionDenied(true);
          return;
        }

        // Remove any existing video element
        const existingVideo = videoContainerRef.current.querySelector('video');
        if (existingVideo) {
          existingVideo.remove();
        }

        // Create new video element
        const videoElement = document.createElement('video');
        videoElement.style.width = '100vw';
        videoElement.style.height = '100vh';
        videoElement.style.objectFit = 'cover';
        videoElement.style.backgroundColor = '#000000';
        videoElement.style.position = 'absolute';
        videoElement.style.top = '0';
        videoElement.style.left = '0';
        videoElement.style.zIndex = '1';
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.muted = true;
        videoElement.controls = false;

        // Mobile-specific attributes
        videoElement.setAttribute('webkit-playsinline', 'true');
        videoElement.setAttribute('x-webkit-airplay', 'deny');

        console.log('📹 Setting up video element...');
        videoElement.srcObject = stream;

        // Wait for video to be ready before playing
        videoElement.onloadedmetadata = () => {
          console.log('📹 Video metadata loaded, starting playback...');
          videoElement.play().then(() => {
            console.log('📹 Video playback started successfully');
            setIsStreaming(true);
            setHasPermission(true);
            setIsInitializing(false);
          }).catch((playError) => {
            console.error('❌ Video play error:', playError);
            setIsInitializing(false);
            // Don't automatically set hasPermission to false for play errors
            // as the stream might be working fine
          });
        };

        // Store reference for later use
        videoRef.current = videoElement;
        streamRef.current = stream;

        // Add video to container
        videoContainerRef.current.appendChild(videoElement);

        // Fallback - try to play immediately
        try {
          await videoElement.play();
          console.log('📹 Video playing immediately');
          setIsStreaming(true);
          setHasPermission(true);
          setIsInitializing(false);
        } catch (playError) {
          console.log('📹 Immediate play failed, waiting for metadata...');
          // The onloadedmetadata handler will handle this
        }
      }
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      setIsInitializing(false);

      let errorMessage = 'Failed to access camera. ';
      let shouldShowPermissionDenied = false;

      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera access in your browser settings and refresh the page.';
        shouldShowPermissionDenied = true;
        setHasPermission(false);
      } else if (error.name === 'NotFoundError' || error.message.includes('No camera found')) {
        errorMessage += 'No camera was detected on this device. You can still upload a photo from your files using the "Choose File" option.';
        shouldShowPermissionDenied = true;
        setHasPermission(false);
      } else if (error.name === 'NotSupportedError') {
        errorMessage += 'Camera is not supported by this browser. Try using a modern browser like Chrome, Firefox, or Safari.';
        shouldShowPermissionDenied = true;
        setHasPermission(false);
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is being used by another application. Please close other camera applications and try again.';
        shouldShowPermissionDenied = true;
        setHasPermission(false);
      } else if (error.name === 'OverconstrainedError') {
        errorMessage += 'Camera constraints could not be satisfied. Try refreshing the page.';
        shouldShowPermissionDenied = true;
        setHasPermission(false);
      } else if (error.message.includes('HTTPS')) {
        errorMessage += 'This site needs to be accessed via HTTPS to use the camera. You can still upload photos using the "Choose File" option.';
        shouldShowPermissionDenied = true;
        setHasPermission(false);
      } else {
        errorMessage += 'Please check your camera permissions and try again. You can also use the "Choose File" option to upload a photo.';
        console.log('🤔 Unknown camera error - not showing permission denied UI');
        // For unknown errors, don't show permission denied UI
      }

      console.log('❌ Setting showPermissionDenied to:', shouldShowPermissionDenied, 'due to error:', error.name);
      setLastError(`${error.name}: ${error.message}`);
      setShowPermissionDenied(shouldShowPermissionDenied);
      Alert.alert('Camera Access Error', errorMessage, [{ text: 'OK' }]);
    }
  }, [isWebPlatform, type, currentCamera]);

  const switchCamera = useCallback(async () => {
    if (!isStreaming || isInitializing) return;

    const newCamera = currentCamera === 'user' ? 'environment' : 'user';
    console.log('📱 Switching camera from', currentCamera, 'to', newCamera);

    try {
      // Stop current camera first
      stopCamera();

      // Update camera state and reset selected device so it finds a new one
      setCurrentCamera(newCamera);
      setSelectedDeviceId(null); // Reset so it finds the best device for new camera

      // Wait a bit for cleanup, then restart with new camera
      setTimeout(async () => {
        console.log('📱 Starting camera with new setting:', newCamera);

        // Force re-enumeration of devices to ensure fresh device list
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          setAvailableDevices(devices);

          // Find the best device for the new camera setting
          const targetDeviceId = findBestCameraDevice(devices, newCamera);
          if (targetDeviceId) {
            setSelectedDeviceId(targetDeviceId);
            console.log('📱 Selected device for', newCamera, 'camera:', targetDeviceId.substring(0, 8) + '...');
          }
        } catch (enumError) {
          console.warn('Failed to enumerate devices during camera switch:', enumError);
        }

        // Start the camera with new settings
        startCamera();
      }, 300);
    } catch (error) {
      console.error('Error switching camera:', error);
    }
  }, [currentCamera, isStreaming, isInitializing, stopCamera, startCamera, findBestCameraDevice]);

  const takePhoto = useCallback(() => {
    if (!isWebPlatform || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    try {
      const context = canvas.getContext('2d');
      if (!context) {
        Alert.alert('Error', 'Unable to access canvas context');
        return;
      }

      // Set canvas dimensions based on video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // Draw the video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to blob and create URL
      canvas.toBlob((blob: Blob | null) => {
        if (blob) {
          const photoUri = URL.createObjectURL(blob);
          onPhotoTaken(photoUri);
          stopCamera();
        } else {
          Alert.alert('Error', 'Failed to capture photo');
        }
      }, 'image/jpeg', 0.8);
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  }, [isWebPlatform, onPhotoTaken, stopCamera]);

  const handleFileUpload = useCallback(() => {
    // Create file input dynamically
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        const photoUri = URL.createObjectURL(file);
        onPhotoTaken(photoUri);
      }
    };
    input.click();
  }, [onPhotoTaken]);

  if (!isWebPlatform) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header with type indicator */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {type === 'id' ? '📄 ID Document Verification' : '👤 Face Verification'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {type === 'id' 
            ? 'Position your ID clearly within the frame' 
            : 'Position your face within the oval guide'
          }
        </Text>
      </View>

      {/* Debug Panel - Hidden by default, toggle with button */}
      {showDebug && (
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>📱 Camera Debug Info:</Text>
          <Text style={styles.debugText}>
            • Stream: {isStreaming ? '✅ Active' : '❌ Inactive'}
          </Text>
          <Text style={styles.debugText}>
            • Permission: {hasPermission === null ? '⏳ Pending' : hasPermission ? '✅ Granted' : '❌ Denied'}
          </Text>
          <Text style={styles.debugText}>
            • Initializing: {isInitializing ? '⏳ Yes' : '✅ No'}
          </Text>
          <Text style={styles.debugText}>
            • Requested: {currentCamera === 'user' ? '📷 Front (user)' : '📷 Back (environment)'}
          </Text>
          <Text style={styles.debugText}>
            • Actual: {actualCamera === 'user' ? '📷 Front' : actualCamera === 'environment' ? '📷 Back' : '❓ Unknown'}
          </Text>
          <Text style={styles.debugText}>
            • Type: {type === 'face' ? '👤 Face' : '📄 ID'} verification
          </Text>
          <Text style={styles.debugText}>
            • Devices: {availableDevices.filter(d => d.kind === 'videoinput').length} camera(s)
          </Text>
          {selectedDeviceId && (
            <Text style={styles.debugText}>
              • Selected: {selectedDeviceId.substring(0, 8)}...
            </Text>
          )}
          {lastError && (
            <Text style={styles.debugTextError}>
              • Error: {lastError.split(':')[0]}
            </Text>
          )}
        </View>
      )}

      {/* Main action buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            isInitializing && styles.primaryButtonDisabled
          ]}
          onPress={startCamera}
          disabled={isInitializing}
          activeOpacity={0.8}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>
              {isInitializing ? '⏳' : '📷'}
            </Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.primaryButtonText}>
                {isInitializing ? 'Starting Camera...' : 'Use Camera'}
              </Text>
              <Text style={styles.buttonSubtext}>
                {isInitializing ? 'Please wait' : 'Live capture'}
              </Text>
            </View>
          </View>
          {isInitializing && (
            <ActivityIndicator size="small" color="#ffffff" style={styles.buttonSpinner} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleFileUpload}
          activeOpacity={0.8}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonIcon}>📁</Text>
            <View style={styles.buttonTextContainer}>
              <Text style={styles.secondaryButtonText}>Choose File</Text>
              <Text style={styles.buttonSubtext}>Upload from device</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Debug toggle button */}
      <TouchableOpacity
        style={styles.debugToggle}
        onPress={() => setShowDebug(!showDebug)}
        activeOpacity={0.7}
      >
        <Text style={styles.debugToggleText}>
          {showDebug ? '🔼' : '🔽'} Debug
        </Text>
      </TouchableOpacity>

      {/* Loading overlay */}
      {isInitializing && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingTitle}>Initializing Camera</Text>
            <Text style={styles.loadingSubtext}>
              Setting up your {currentCamera === 'user' ? 'front' : 'rear'} camera...
            </Text>
          </View>
        </View>
      )}

      {/* Fullscreen Video Container - Always render for ref access */}
      {React.createElement('div', {
        ref: videoContainerRef,
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#000000',
          display: isStreaming ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        },
      })}

      {/* Camera Guide Overlay */}
      {isStreaming && (
        <View style={styles.guideOverlay}>
          {type === 'id' ? (
            // Rectangle guide for ID
            <View style={styles.rectangleGuide}>
              <View style={styles.guideCorners}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              <View style={styles.guideTextContainer}>
                <Text style={styles.guideText}>Position your ID within this frame</Text>
                <Text style={styles.guideSubtext}>Make sure all corners are visible</Text>
              </View>
            </View>
          ) : (
            // Oval guide for face
            <View style={styles.ovalGuide}>
              <View style={styles.guideTextContainer}>
                <Text style={styles.guideText}>Position your face here</Text>
                <Text style={styles.guideSubtext}>Keep your face centered and well-lit</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {React.createElement('canvas', {
        ref: canvasRef,
        style: styles.hiddenCanvas,
      })}

      {/* Camera controls overlay */}
      {isStreaming && (
        <View style={styles.cameraControls}>
          {/* Top controls */}
          <View style={styles.topControls}>
            <TouchableOpacity
              style={styles.switchButton}
              onPress={switchCamera}
              activeOpacity={0.8}
            >
              <Text style={styles.controlIcon}>🔄</Text>
              <Text style={styles.switchButtonText}>
                {currentCamera === 'user' ? 'Switch to Back' : 'Switch to Front'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bottom controls */}
          <View style={styles.bottomControls}>
            <TouchableOpacity
              style={styles.cancelControlButton}
              onPress={stopCamera}
              activeOpacity={0.8}
            >
              <Text style={styles.controlIcon}>✕</Text>
              <Text style={styles.controlButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.captureControlButton}
              onPress={takePhoto}
              activeOpacity={0.8}
            >
              <View style={styles.captureInner} />
            </TouchableOpacity>

            <View style={styles.placeholderButton} />
          </View>
        </View>
      )}

      {/* Permission denied screen */}
      {showPermissionDenied && (
        <View style={styles.permissionScreen}>
          <View style={styles.permissionCard}>
            <Text style={styles.permissionIcon}>🚫</Text>
            <Text style={styles.permissionTitle}>Camera Access Required</Text>
            <Text style={styles.permissionMessage}>
              Camera access is needed for verification. Please allow camera permissions in your browser and try again.
            </Text>
            
            <TouchableOpacity
              style={styles.retryButton}
              onPress={startCamera}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>

            <View style={styles.alternativeSection}>
              <Text style={styles.alternativeTitle}>Alternative Option</Text>
              <Text style={styles.alternativeText}>
                You can still complete verification by uploading a photo from your device
              </Text>
              
              {React.createElement('input', {
                type: 'file',
                accept: 'image/*',
                capture: type === 'face' ? 'user' : 'environment',
                onChange: (e: Event) => {
                  const target = e.target as HTMLInputElement;
                  const file = target.files?.[0];
                  if (file) {
                    const photoUri = URL.createObjectURL(file);
                    onPhotoTaken(photoUri);
                  }
                },
                style: {
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  borderRadius: '8px',
                  border: '2px dashed #d1d5db',
                  backgroundColor: '#f9fafb',
                  cursor: 'pointer',
                  marginTop: '12px',
                },
              })}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 400,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    padding: 24,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  actionContainer: {
    padding: 24,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0.1,
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  buttonTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  buttonSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  buttonSpinner: {
    position: 'absolute',
    right: 20,
  },
  debugPanel: {
    backgroundColor: '#fef3c7',
    borderTopWidth: 3,
    borderTopColor: '#f59e0b',
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 8,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#78350f',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  debugTextError: {
    fontSize: 12,
    color: '#dc2626',
    marginBottom: 4,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  debugToggle: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 10,
  },
  debugToggleText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 4,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  cameraControls: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw' as any,
    height: '100vh' as any,
    justifyContent: 'space-between',
    zIndex: 1001,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  topControls: {
    alignItems: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  switchButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    backdropFilter: 'blur(10px)' as any,
  },
  switchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  controlIcon: {
    fontSize: 18,
    color: '#ffffff',
  },
  cancelControlButton: {
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  captureControlButton: {
    backgroundColor: '#ffffff',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureInner: {
    backgroundColor: '#ef4444',
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  controlButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  placeholderButton: {
    width: 60,
    height: 60,
  },
  guideOverlay: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw' as any,
    height: '100vh' as any,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
    paddingHorizontal: 20,
    paddingVertical: 20,
    pointerEvents: 'none' as any,
  } as ViewStyle,
  rectangleGuide: {
    width: '85%',
    height: '55%',
    maxWidth: 400,
    maxHeight: 250,
    borderWidth: 3,
    borderColor: '#10b981',
    borderStyle: 'solid',
    borderRadius: 16,
    justifyContent: 'flex-end',
    paddingBottom: 20,
    position: 'relative',
  },
  guideCorners: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#ffffff',
    borderWidth: 3,
  },
  topLeft: {
    top: -3,
    left: -3,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: -3,
    right: -3,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: -3,
    left: -3,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: -3,
    right: -3,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  ovalGuide: {
    width: '70%',
    height: '50%',
    maxWidth: 300,
    maxHeight: 400,
    borderWidth: 3,
    borderColor: '#10b981',
    borderStyle: 'solid',
    borderRadius: 150,
    justifyContent: 'flex-end',
    paddingBottom: 40,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  guideTextContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  guideText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  guideSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  permissionScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 200,
  },
  permissionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  permissionIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 24,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  alternativeSection: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 24,
  },
  alternativeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  alternativeText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  hiddenCanvas: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    opacity: 0,
  },
});