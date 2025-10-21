import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

export interface UploadedFile {
  url: string;
  path: string;
  type: 'image' | 'document';
  size: number;
  name: string;
}

class FileUploadService {
  private bucketName = 'chat-attachments';

  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(
    fileUri: string,
    fileName: string,
    mimeType: string,
    userId: string
  ): Promise<UploadedFile> {
    try {
      console.log('📤 Starting file upload:', { fileName, mimeType });

      // Determine file type
      const fileType = mimeType.startsWith('image/') ? 'image' : 'document';

      // Generate unique file path
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${userId}/${timestamp}_${sanitizedFileName}`;

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Get file size
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      const fileSize = (fileInfo as any).size || 0;

      console.log('📊 File info:', { size: fileSize, path: filePath });

      // Convert base64 to ArrayBuffer
      const arrayBuffer = decode(base64);

      // Upload to Supabase Storage using REST API (better compatibility with Expo Go)
      console.log('📡 Uploading to bucket:', this.bucketName);
      console.log('📡 File path:', filePath);
      console.log('📡 Content type:', mimeType);

      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('User not authenticated');
      }

      // Use fetch API for better Expo Go compatibility
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://demo.supabase.co';
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${this.bucketName}/${filePath}`;

      console.log('📡 Upload URL:', uploadUrl);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': mimeType,
          'x-upsert': 'false',
        },
        body: arrayBuffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const uploadResult = await response.json();
      console.log('✅ File uploaded successfully:', uploadResult);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      return {
        url: urlData.publicUrl,
        path: filePath,
        type: fileType,
        size: fileSize,
        name: fileName,
      };
    } catch (error) {
      console.error('❌ File upload error:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Supabase Storage
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        console.error('❌ Delete error:', error);
        return false;
      }

      console.log('✅ File deleted successfully:', filePath);
      return true;
    } catch (error) {
      console.error('❌ File delete error:', error);
      return false;
    }
  }

  /**
   * Get file size limit in bytes (50MB default)
   */
  getMaxFileSize(): number {
    return 50 * 1024 * 1024; // 50MB
  }

  /**
   * Check if file size is within limit
   */
  async isFileSizeValid(fileUri: string): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      const fileSize = (fileInfo as any).size || 0;
      return fileSize <= this.getMaxFileSize();
    } catch (error) {
      console.error('Error checking file size:', error);
      return false;
    }
  }
}

export const fileUploadService = new FileUploadService();
