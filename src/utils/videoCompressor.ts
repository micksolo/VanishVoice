import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export class VideoCompressorUtil {
  /**
   * Since we can't use native compression libraries with Expo,
   * we'll focus on recording at the right quality from the start.
   * This is a placeholder that returns the original video.
   */
  static async compressVideo(
    inputUri: string,
    targetSizeMB: number = 10
  ): Promise<{ uri: string; originalSize: number; compressedSize: number }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(inputUri);
      const originalSizeMB = (fileInfo.size || 0) / 1024 / 1024;
      
      console.log(`[VideoCompressor] Original size: ${originalSizeMB.toFixed(2)}MB`);
      
      // If already small enough, return as is
      if (originalSizeMB <= targetSizeMB) {
        console.log(`[VideoCompressor] Video already within target size`);
        return {
          uri: inputUri,
          originalSize: fileInfo.size || 0,
          compressedSize: fileInfo.size || 0
        };
      }
      
      // Without native compression, we can't compress the video
      // The solution is to record at lower quality from the start
      console.warn(`[VideoCompressor] Video is ${originalSizeMB.toFixed(2)}MB - larger than target ${targetSizeMB}MB`);
      console.warn(`[VideoCompressor] Expo doesn't support video compression. Record at lower quality instead.`);
      
      return {
        uri: inputUri,
        originalSize: fileInfo.size || 0,
        compressedSize: fileInfo.size || 0
      };
      
    } catch (error) {
      console.error('[VideoCompressor] Error:', error);
      throw error;
    }
  }
  
  /**
   * Alternative: Re-record with lower quality settings
   */
  static getOptimizedRecordingOptions(duration: number = 30) {
    const targetBitrate = Platform.select({
      ios: 1500000,    // 1.5 Mbps on iOS (works well)
      android: 800000  // 800 Kbps on Android (more reliable)
    });
    
    const quality = Platform.select({
      ios: '720p',
      android: '480p'  // Lower quality on Android for smaller files
    });
    
    const expectedSizeMB = ((targetBitrate! * duration) / 8 / 1024 / 1024).toFixed(1);
    
    console.log(`[VideoCompressor] Recommended settings: ${quality} @ ${targetBitrate! / 1000}Kbps`);
    console.log(`[VideoCompressor] Expected size for ${duration}s: ~${expectedSizeMB}MB`);
    
    return {
      maxDuration: duration,
      videoQuality: quality,
      ...(Platform.OS === 'ios' ? {
        codec: 'avc1',
        videoBitrate: targetBitrate,
        videoStabilizationMode: 'auto',
      } : {
        // Android - try different approach
        quality: 0.5,  // Android Camera2 API quality (0-1)
        // Note: videoBitrate might not work on all Android devices
      }),
    };
  }
}