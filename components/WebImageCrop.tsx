import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface WebImageCropProps {
  imageUri: string;
  /** width / height ratio — 4/3 for ID, 1 for face */
  aspectRatio: number;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

// Web-only: image crop using HTML5 Canvas + drag-to-reposition
export default function WebImageCrop({ imageUri, aspectRatio, onCrop, onCancel }: WebImageCropProps) {
  if (Platform.OS !== 'web') return null;

  const canvasRef = useRef<any>(null);
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Display container size
  const containerW = Math.min(600, (typeof window !== 'undefined' ? window.innerWidth : 600) - 48);
  const containerH = Math.round(containerW / aspectRatio);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setNaturalW(img.naturalWidth);
      setNaturalH(img.naturalHeight);
      // Center the image initially
      const scale = Math.max(containerW / img.naturalWidth, containerH / img.naturalHeight);
      const scaledW = img.naturalWidth * scale;
      const scaledH = img.naturalHeight * scale;
      setOffsetX(-(scaledW - containerW) / 2);
      setOffsetY(-(scaledH - containerH) / 2);
    };
    img.src = imageUri;
  }, [imageUri]);

  // Compute display scale so image covers the container
  const scale = naturalW && naturalH
    ? Math.max(containerW / naturalW, containerH / naturalH)
    : 1;
  const scaledW = naturalW * scale;
  const scaledH = naturalH * scale;

  // Clamp offsets so the image always covers the crop area
  const clampX = (x: number) => Math.min(0, Math.max(x, containerW - scaledW));
  const clampY = (y: number) => Math.min(0, Math.max(y, containerH - scaledH));

  const handleMouseDown = (e: any) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY };
  };
  const handleMouseMove = (e: any) => {
    if (!dragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffsetX(clampX(dragStart.current.ox + dx));
    setOffsetY(clampY(dragStart.current.oy + dy));
  };
  const handleMouseUp = () => setDragging(false);

  const handleTouchStart = (e: any) => {
    const t = e.touches[0];
    setDragging(true);
    dragStart.current = { x: t.clientX, y: t.clientY, ox: offsetX, oy: offsetY };
  };
  const handleTouchMove = (e: any) => {
    if (!dragging || !dragStart.current) return;
    const t = e.touches[0];
    const dx = t.clientX - dragStart.current.x;
    const dy = t.clientY - dragStart.current.y;
    setOffsetX(clampX(dragStart.current.ox + dx));
    setOffsetY(clampY(dragStart.current.oy + dy));
  };

  const handleCrop = () => {
    if (typeof window === 'undefined' || !naturalW) return;
    const canvas = document.createElement('canvas');
    const outputW = 800;
    const outputH = Math.round(outputW / aspectRatio);
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Source rectangle in natural image coordinates
    const srcX = (-offsetX / scaledW) * naturalW;
    const srcY = (-offsetY / scaledH) * naturalH;
    const srcW = (containerW / scaledW) * naturalW;
    const srcH = (containerH / scaledH) * naturalH;

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputW, outputH);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      onCrop(dataUrl);
    };
    img.src = imageUri;
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Drag to reposition, then tap "Use Photo"</Text>

      {/* Crop viewport — rendered via inline HTML on web */}
      {React.createElement('div', {
        style: {
          width: containerW,
          height: containerH,
          overflow: 'hidden',
          position: 'relative',
          cursor: dragging ? 'grabbing' : 'grab',
          borderRadius: 8,
          border: '2px solid #10b981',
          userSelect: 'none',
          touchAction: 'none',
        },
        onMouseDown: handleMouseDown,
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
        onMouseLeave: handleMouseUp,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleMouseUp,
      },
        React.createElement('img', {
          src: imageUri,
          draggable: false,
          style: {
            position: 'absolute',
            left: offsetX,
            top: offsetY,
            width: scaledW,
            height: scaledH,
            pointerEvents: 'none',
          },
        }),
        // Corner guides
        React.createElement('div', {
          style: {
            position: 'absolute', inset: 0,
            boxShadow: 'inset 0 0 0 2px rgba(16,185,129,0.8)',
            pointerEvents: 'none',
          }
        }),
      )}

      <Text style={styles.hint}>Drag the image to position the crop area</Text>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cropBtn} onPress={handleCrop} activeOpacity={0.8}>
          <Text style={styles.cropText}>Use Photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 400,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  cancelText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  cropBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#10b981',
    alignItems: 'center',
  },
  cropText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '700',
  },
});
