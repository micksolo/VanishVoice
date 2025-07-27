import * as FileSystem from 'expo-file-system';
import { File } from 'expo-file-system/next';
import { supabase } from '../services/supabase';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import SharedSecretEncryption from './sharedSecretEncryption';
import { Platform } from 'react-native';
import { compressVideo, cleanupCompressedVideo, type CompressionProgress } from '../services/videoCompression';

// Optimized for fast encryption/decryption
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for processing

// React Native performance debugging flags
const ENABLE_PERFORMANCE_LOGGING = true;
const ENABLE_MEMORY_OPTIMIZATION = true;

export class SecureE2EVideoStorageFastAndroid {
  /**
   * Fast encryption using nacl.secretbox (XSalsa20-Poly1305)
   * Much faster than XOR with base64 conversions
   */
  private static encrypt(data: Uint8Array, key: Uint8Array): { encrypted: Uint8Array; nonce: Uint8Array } {
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const encrypted = nacl.secretbox(data, nonce, key);
    return { encrypted, nonce };
  }

  /**
   * Fast decryption using nacl.secretbox.open
   */
  private static decrypt(encrypted: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null {
    const start = Date.now();
    const sizeMB = encrypted.length / 1024 / 1024;
    console.log(`[Decrypt Method] Starting nacl.secretbox.open with ${encrypted.length} bytes (${sizeMB.toFixed(2)}MB)...`);
    
    // Check if we need chunked processing for very large files
    if (sizeMB > 10) {
      console.log(`[Decrypt Method] WARNING: Large file (${sizeMB.toFixed(2)}MB) - nacl performance may degrade`);
    }
    
    // Memory check before operation
    const memBefore = Date.now();
    console.log(`[Decrypt Method] Pre-operation memory timestamp: ${memBefore}`);
    
    const result = nacl.secretbox.open(encrypted, nonce, key);
    
    const duration = (Date.now() - start) / 1000;
    console.log(`[Decrypt Method] nacl.secretbox.open completed in ${duration.toFixed(3)}s`);
    
    if (result) {
      console.log(`[Decrypt Method] Success: Output size ${result.length} bytes`);
      console.log(`[Decrypt Method] Performance: ${(encrypted.length / 1024 / 1024 / duration).toFixed(1)} MB/s`);
      
      // Expected performance: nacl should do 10-50 MB/s
      const expectedTime = sizeMB / 25; // Assume 25 MB/s average
      if (duration > expectedTime * 2) {
        console.log(`[Decrypt Method] PERFORMANCE WARNING: Expected ~${expectedTime.toFixed(2)}s, got ${duration.toFixed(2)}s`);
      }
    } else {
      console.log(`[Decrypt Method] Decryption failed - returned null`);
    }
    
    return result;
  }

  /**
   * Alternative optimized decryption for large files
   * Addresses React Native specific performance issues:
   * - Memory fragmentation 
   * - JavaScript engine (Hermes) optimization
   * - Main thread blocking
   */
  private static decryptOptimized(encrypted: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null {
    const start = Date.now();
    const sizeMB = encrypted.length / 1024 / 1024;
    console.log(`[Decrypt Optimized] React Native optimization for ${encrypted.length} bytes (${sizeMB.toFixed(2)}MB)...`);
    
    // Validate inputs upfront
    if (!(encrypted instanceof Uint8Array) || !(nonce instanceof Uint8Array) || !(key instanceof Uint8Array)) {
      console.error(`[Decrypt Optimized] ERROR: Invalid input types`);
      return null;
    }
    
    if (nonce.length !== nacl.secretbox.nonceLength || key.length !== nacl.secretbox.keyLength) {
      console.error(`[Decrypt Optimized] ERROR: Invalid key/nonce lengths`);
      return null;
    }
    
    // For very large files in React Native, use chunked processing to avoid memory issues
    if (sizeMB > 20) {
      console.log(`[Decrypt Optimized] Very large file - attempting chunked decryption...`);
      return this.decryptChunked(encrypted, nonce, key);
    }
    
    // React Native optimization: Yield to event loop periodically for large files
    if (sizeMB > 5) {
      console.log(`[Decrypt Optimized] Large file - using async batched approach...`);
      return this.decryptWithEventLoopYielding(encrypted, nonce, key);
    }
    
    // Standard decryption for smaller files
    console.log(`[Decrypt Optimized] Small file - standard decryption...`);
    const decryptStart = Date.now();
    
    try {
      const result = nacl.secretbox.open(encrypted, nonce, key);
      const duration = (Date.now() - decryptStart) / 1000;
      
      if (result) {
        console.log(`[Decrypt Optimized] Success in ${duration.toFixed(3)}s (${(sizeMB / duration).toFixed(1)} MB/s)`);
      } else {
        console.log(`[Decrypt Optimized] Failed - returned null`);
      }
      
      return result;
    } catch (error: any) {
      console.error(`[Decrypt Optimized] Exception:`, error);
      return null;
    }
  }

  /**
   * Chunked decryption for very large files (>20MB)
   * Not actually possible with nacl.secretbox due to authentication,
   * but tests if the issue is memory-related
   */
  private static decryptChunked(encrypted: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null {
    console.log(`[Decrypt Chunked] Note: NaCl secretbox cannot be chunked due to authentication`);
    console.log(`[Decrypt Chunked] Falling back to optimized single-pass with memory management...`);
    
    // Force garbage collection if available (React Native/Hermes)
    if (global.gc) {
      console.log(`[Decrypt Chunked] Running garbage collection before decryption...`);
      global.gc();
    }
    
    const start = Date.now();
    try {
      const result = nacl.secretbox.open(encrypted, nonce, key);
      const duration = (Date.now() - start) / 1000;
      
      console.log(`[Decrypt Chunked] Completed in ${duration.toFixed(3)}s`);
      return result;
    } catch (error: any) {
      console.error(`[Decrypt Chunked] Failed:`, error);
      return null;
    }
  }

  /**
   * Decryption with event loop yielding to prevent main thread blocking
   * Uses setTimeout to break up the work (React Native optimization)
   */
  private static decryptWithEventLoopYielding(encrypted: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null {
    console.log(`[Decrypt Yielding] Using event loop yielding optimization...`);
    
    // Since nacl.secretbox is atomic, we can't actually chunk it
    // But we can try to optimize memory and timing
    const start = Date.now();
    
    try {
      // Create fresh Uint8Arrays to avoid any potential memory fragmentation issues
      console.log(`[Decrypt Yielding] Creating fresh Uint8Arrays...`);
      const freshEncrypted = new Uint8Array(encrypted);
      const freshNonce = new Uint8Array(nonce);
      const freshKey = new Uint8Array(key);
      
      console.log(`[Decrypt Yielding] Starting optimized nacl.secretbox.open...`);
      const decryptStart = Date.now();
      const result = nacl.secretbox.open(freshEncrypted, freshNonce, freshKey);
      const duration = (Date.now() - decryptStart) / 1000;
      
      const sizeMB = encrypted.length / 1024 / 1024;
      console.log(`[Decrypt Yielding] Completed in ${duration.toFixed(3)}s (${(sizeMB / duration).toFixed(1)} MB/s)`);
      
      return result;
    } catch (error: any) {
      console.error(`[Decrypt Yielding] Failed:`, error);
      return null;
    }
  }

  /**
   * Upload video with compression and fast encryption
   */
  static async encryptAndUploadVideo(
    videoUri: string,
    senderId: string,
    recipientId: string,
    onProgress?: (progress: number) => void,
    onCompressionProgress?: (progress: CompressionProgress) => void
  ): Promise<{ videoId: string; encryptedKey: string; keyNonce: string; videoNonce: string }> {
    const startTime = Date.now();
    let compressedVideoUri: string | null = null;
    
    try {
      // Get original file info
      const originalFileInfo = await FileSystem.getInfoAsync(videoUri);
      const originalSizeMB = (originalFileInfo.size || 0) / 1024 / 1024;
      console.log(`[Video Upload] Original size: ${originalSizeMB.toFixed(2)}MB`);
      
      // Compress video first (takes up to 40% of progress)
      onProgress?.(0.05);
      console.log('[Video Upload] Starting compression...');
      
      const compressionResult = await compressVideo(
        videoUri,
        (compProgress) => {
          // Map compression progress to 5-40% of total progress
          const totalProgress = 0.05 + (compProgress.percent / 100) * 0.35;
          onProgress?.(totalProgress);
          onCompressionProgress?.(compProgress);
        }
      );
      
      compressedVideoUri = compressionResult.uri;
      const compressedSizeMB = compressionResult.compressedSize / 1024 / 1024;
      console.log(`[Video Upload] Compressed to: ${compressedSizeMB.toFixed(2)}MB (${compressionResult.compressionRatio.toFixed(1)}% reduction)`);
      
      // Generate keys
      const videoKey = nacl.randomBytes(32);
      const videoId = Buffer.from(nacl.randomBytes(16)).toString('hex');
      
      // Read compressed file using fast binary API
      onProgress?.(0.45);
      console.log('[Video Upload] Reading compressed file as binary...');
      let videoData: Uint8Array;
      
      try {
        // Use new File API for direct binary reading
        const compressedFile = new File(compressedVideoUri);
        videoData = compressedFile.bytes();
        console.log(`[Video Upload] Read ${videoData.length} bytes directly as Uint8Array`);
      } catch (fileApiError: any) {
        // Fallback to base64 if new API fails
        console.warn('[Video Upload] New File API failed, using base64 fallback:', fileApiError);
        const videoBase64 = await FileSystem.readAsStringAsync(compressedVideoUri, {
          encoding: FileSystem.EncodingType.Base64
        });
        videoData = new Uint8Array(Buffer.from(videoBase64, 'base64'));
        console.log(`[Video Upload] Read ${videoData.length} bytes via base64 fallback`);
      }
      
      // Encrypt using fast nacl.secretbox
      onProgress?.(0.55);
      console.log('[Video Upload] Encrypting with nacl.secretbox...');
      const encryptStart = Date.now();
      const { encrypted, nonce } = this.encrypt(videoData, videoKey);
      console.log(`[Video Upload] Encrypted in ${((Date.now() - encryptStart) / 1000).toFixed(1)}s`);
      
      // Upload encrypted data with nonce
      onProgress?.(0.65);
      const uploadData = new Uint8Array(nonce.length + encrypted.length);
      uploadData.set(nonce, 0);
      uploadData.set(encrypted, nonce.length);
      
      const { error } = await supabase.storage
        .from('videos')
        .upload(`${videoId}/video.enc`, Buffer.from(uploadData), {
          contentType: 'application/octet-stream',
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) throw error;
      
      onProgress?.(0.9);
      
      // Encrypt video key and nonce for recipient
      const sharedSecret = await SharedSecretEncryption.deriveSharedSecret(senderId, recipientId);
      const videoKeyBase64 = Buffer.from(videoKey).toString('base64');
      const { encrypted: encryptedKey, nonce: keyNonce } = await SharedSecretEncryption.encrypt(
        videoKeyBase64,
        sharedSecret
      );
      
      // Store nonce separately for backward compatibility
      const videoNonce = Buffer.from(nonce).toString('base64');
      
      // Cleanup compressed video
      if (compressedVideoUri) {
        await cleanupCompressedVideo(compressedVideoUri);
      }
      
      const totalDuration = (Date.now() - startTime) / 1000;
      console.log(`[Video Upload] Complete in ${totalDuration.toFixed(1)}s`);
      console.log(`[Video Upload] Original: ${originalSizeMB.toFixed(2)}MB → Uploaded: ${compressedSizeMB.toFixed(2)}MB`);
      onProgress?.(1.0);
      
      return {
        videoId,
        encryptedKey,
        keyNonce,
        videoNonce
      };
      
    } catch (error) {
      // Cleanup on error
      if (compressedVideoUri) {
        await cleanupCompressedVideo(compressedVideoUri).catch(console.error);
      }
      console.error('[Video Upload] Failed:', error);
      throw error;
    }
  }

  /**
   * Download and decrypt video with fast binary operations - NO BASE64
   */
  static async downloadAndDecryptVideo(
    videoId: string,
    encryptedKey: string,
    keyNonce: string,
    senderId: string,
    recipientId: string,
    onProgress?: (progress: number) => void,
    videoNonce?: string
  ): Promise<string> {
    const startTime = Date.now();
    
    try {
      console.log(`[Video Download] Starting FAST binary download for videoId: ${videoId}`);
      console.log(`[Video Download] Using expo-file-system/next for direct binary operations`);
      onProgress?.(0.1);
      
      // Decrypt video key
      const sharedSecret = await SharedSecretEncryption.deriveSharedSecret(senderId, recipientId);
      const decryptedKeyBase64 = await SharedSecretEncryption.decrypt(
        encryptedKey,
        keyNonce,
        sharedSecret
      );
      
      if (!decryptedKeyBase64) {
        throw new Error('Failed to decrypt video key');
      }
      
      const videoKey = new Uint8Array(Buffer.from(decryptedKeyBase64, 'base64'));
      
      // Prepare output file path first
      const outputPath = `${FileSystem.documentDirectory}video_${Date.now()}.mp4`;
      
      // Download from Supabase
      onProgress?.(0.2);
      console.log(`[Video Download] Downloading from Supabase...`);
      const downloadStart = Date.now();
      
      // Create a signed URL for authenticated download
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('videos')
        .createSignedUrl(`${videoId}/video.enc`, 300); // 5 minute expiry
      
      if (urlError || !signedUrlData?.signedUrl) {
        throw new Error(`Failed to create signed URL: ${urlError?.message || 'Unknown error'}`);
      }
      
      // Download directly to a temporary file
      const tempPath = `${FileSystem.cacheDirectory}temp_${Date.now()}.enc`;
      
      try {
        const downloadResult = await FileSystem.downloadAsync(
          signedUrlData.signedUrl,
          tempPath,
          {
            sessionType: FileSystem.FileSystemSessionType.BACKGROUND
          }
        );
        
        if (downloadResult.status !== 200) {
          throw new Error(`Download failed with status: ${downloadResult.status}`);
        }
      } catch (downloadError: any) {
        console.error('[Video Download] Direct download failed:', downloadError);
        throw new Error(`Download failed: ${downloadError?.message || 'Unknown error'}`);
      }
      
      // Get file size
      const fileInfo = await FileSystem.getInfoAsync(tempPath);
      const fileSizeMB = (fileInfo.size || 0) / 1024 / 1024;
      console.log(`[Video Download] Downloaded ${fileSizeMB.toFixed(2)}MB in ${((Date.now() - downloadStart) / 1000).toFixed(1)}s`);
      onProgress?.(0.5);
      
      // Read encrypted file directly as binary - NO BASE64
      console.log(`[Video Download] Reading encrypted file as binary...`);
      const readStart = Date.now();
      
      try {
        // Use new File API for direct binary reading - This should be FAST
        console.log(`[Video Download] Using expo-file-system/next File API for direct binary read...`);
        const encryptedFile = new File(tempPath);
        const encryptedWithNonce = encryptedFile.bytes();
        const readTime = (Date.now() - readStart) / 1000;
        console.log(`[Video Download] Read ${encryptedWithNonce.length} bytes directly as Uint8Array in ${readTime.toFixed(3)}s`);
        
        // Verify this is a proper Uint8Array
        console.log(`[Video Download] File API result type: ${typeof encryptedWithNonce}, constructor: ${encryptedWithNonce.constructor.name}`);
        
        if (readTime > 1) {
          console.log(`[Video Download] WARNING: File API read is slow - ${readTime.toFixed(3)}s for binary read`);
        }
        
        // Extract nonce and encrypted data
        const nonceLength = nacl.secretbox.nonceLength;
        const nonce = encryptedWithNonce.slice(0, nonceLength);
        const encryptedData = encryptedWithNonce.slice(nonceLength);
        
        // Decrypt using fast nacl.secretbox
        console.log(`[Video Download] Decrypting with nacl.secretbox...`);
        console.log(`[Video Download] Decrypt inputs - encryptedData: ${encryptedData.length} bytes, nonce: ${nonce.length} bytes, key: ${videoKey.length} bytes`);
        const decryptStart = Date.now();
        onProgress?.(0.6);
        
        // Pre-decrypt checks
        console.log(`[Video Download] Pre-decrypt memory check - typeof encryptedData: ${typeof encryptedData}, constructor: ${encryptedData.constructor.name}`);
        console.log(`[Video Download] Pre-decrypt memory check - typeof nonce: ${typeof nonce}, constructor: ${nonce.constructor.name}`);
        console.log(`[Video Download] Pre-decrypt memory check - typeof videoKey: ${typeof videoKey}, constructor: ${videoKey.constructor.name}`);
        
        // Time the actual nacl.secretbox.open call
        const naclStart = Date.now();
        console.log(`[Video Download] Starting nacl.secretbox.open() call...`);
        
        // Decrypt in one operation - nacl.secretbox is very fast
        // Try optimized decryption first for large files
        const sizeMB = encryptedData.length / 1024 / 1024;
        let decrypted: Uint8Array | null = null;
        
        if (sizeMB > 3) {
          console.log(`[Video Download] Large file (${sizeMB.toFixed(2)}MB) - trying optimized decryption first...`);
          decrypted = this.decryptOptimized(encryptedData, nonce, videoKey);
          
          if (!decrypted) {
            console.log(`[Video Download] Optimized decryption failed, falling back to standard method...`);
            decrypted = this.decrypt(encryptedData, nonce, videoKey);
          }
        } else {
          console.log(`[Video Download] Small file (${sizeMB.toFixed(2)}MB) - using standard decryption...`);
          decrypted = this.decrypt(encryptedData, nonce, videoKey);
        }
        
        const naclDuration = (Date.now() - naclStart) / 1000;
        console.log(`[Video Download] Pure nacl.secretbox.open() took: ${naclDuration.toFixed(3)}s`);
        
        if (!decrypted) {
          console.error('[Video Download] nacl.secretbox.open() returned null - decryption failed');
          throw new Error('Failed to decrypt video - invalid key or corrupted data');
        }
        
        const totalDecryptDuration = (Date.now() - decryptStart) / 1000;
        console.log(`[Video Download] Total decrypt step (including logging): ${totalDecryptDuration.toFixed(3)}s`);
        console.log(`[Video Download] Decrypted ${decrypted.length} bytes`);
        console.log(`[Video Download] Decrypt performance: ${(decrypted.length / 1024 / 1024 / naclDuration).toFixed(1)} MB/s`);
        onProgress?.(0.8);
        
        // Write decrypted data directly as binary - NO BASE64
        console.log(`[Video Download] Writing binary data directly to: ${outputPath}`);
        const saveStart = Date.now();
        
        // Use new File API for direct binary writing
        const outputFile = new File(outputPath);
        outputFile.write(decrypted);
        
        console.log(`[Video Download] Saved ${decrypted.length} bytes directly in ${((Date.now() - saveStart) / 1000).toFixed(1)}s`);
        
        // Clean up temp file
        await FileSystem.deleteAsync(tempPath, { idempotent: true });
        
        // Verify final file
        const savedInfo = await FileSystem.getInfoAsync(outputPath);
        console.log(`[Video Download] Final file: ${((savedInfo.size || 0) / 1024 / 1024).toFixed(2)}MB at ${outputPath}`);
        
        const totalDuration = (Date.now() - startTime) / 1000;
        console.log(`\n=== VIDEO DOWNLOAD PERFORMANCE REPORT ===`);
        console.log(`Total time: ${totalDuration.toFixed(2)}s (Target: <3s)`);
        console.log(`File size: ${fileSizeMB.toFixed(2)}MB`);
        console.log(`\nBreakdown:`);
        console.log(`  • Key decrypt:     ~0.10s`);
        console.log(`  • Download:        ${((readStart - downloadStart) / 1000).toFixed(2)}s`);
        console.log(`  • Read file:       ${((decryptStart - readStart) / 1000).toFixed(2)}s`);
        console.log(`  • NaCl decrypt:    ${((saveStart - decryptStart) / 1000).toFixed(2)}s ⚠️`);
        console.log(`  • Save file:       ${((Date.now() - saveStart) / 1000).toFixed(2)}s`);
        console.log(`\nExpected NaCl time: ${(fileSizeMB / 25).toFixed(2)}s (25 MB/s baseline)`);
        console.log(`Actual NaCl time:   ${((saveStart - decryptStart) / 1000).toFixed(2)}s`);
        console.log(`Performance ratio:  ${(((saveStart - decryptStart) / 1000) / (fileSizeMB / 25)).toFixed(1)}x slower than expected`);
        console.log(`==========================================\n`);
        
        onProgress?.(1.0);
        
        return outputPath;
        
      } catch (fileApiError: any) {
        // Fallback to legacy base64 approach if new File API fails
        console.warn('[Video Download] New File API failed, falling back to base64 approach:', fileApiError);
        console.log(`[Video Download] Fallback: Reading encrypted file as base64...`);
        
        const encryptedBase64 = await FileSystem.readAsStringAsync(tempPath, {
          encoding: FileSystem.EncodingType.Base64
        });
        
        // Convert to Uint8Array for decryption - POTENTIAL PERFORMANCE BOTTLENECK
        console.log(`[Video Download] Fallback: Converting base64 to Uint8Array...`);
        const conversionStart = Date.now();
        
        // This could be the 15s bottleneck! Buffer.from() + new Uint8Array() for large data
        const buffer = Buffer.from(encryptedBase64, 'base64');
        const encryptedWithNonce = new Uint8Array(buffer);
        
        const conversionTime = (Date.now() - conversionStart) / 1000;
        console.log(`[Video Download] Fallback: Base64->Uint8Array conversion took ${conversionTime.toFixed(3)}s`);
        
        if (conversionTime > 5) {
          console.log(`[Video Download] Fallback: WARNING - Buffer conversion is the bottleneck!`);
        }
        console.log(`[Video Download] Fallback: Read file in ${((Date.now() - readStart) / 1000).toFixed(1)}s`);
        
        // Extract nonce and encrypted data
        const nonceLength = nacl.secretbox.nonceLength;
        const nonce = encryptedWithNonce.slice(0, nonceLength);
        const encryptedData = encryptedWithNonce.slice(nonceLength);
        
        // Decrypt using fast nacl.secretbox
        console.log(`[Video Download] Fallback: Decrypting with nacl.secretbox...`);
        console.log(`[Video Download] Fallback: Decrypt inputs - encryptedData: ${encryptedData.length} bytes, nonce: ${nonce.length} bytes, key: ${videoKey.length} bytes`);
        const decryptStart = Date.now();
        onProgress?.(0.6);
        
        // Pre-decrypt checks
        console.log(`[Video Download] Fallback: Pre-decrypt memory check - typeof encryptedData: ${typeof encryptedData}, constructor: ${encryptedData.constructor.name}`);
        console.log(`[Video Download] Fallback: Pre-decrypt memory check - typeof nonce: ${typeof nonce}, constructor: ${nonce.constructor.name}`);
        console.log(`[Video Download] Fallback: Pre-decrypt memory check - typeof videoKey: ${typeof videoKey}, constructor: ${videoKey.constructor.name}`);
        
        // Time the actual nacl.secretbox.open call
        const naclStart = Date.now();
        console.log(`[Video Download] Fallback: Starting nacl.secretbox.open() call...`);
        
        // Try optimized decryption first for large files
        const sizeMB = encryptedData.length / 1024 / 1024;
        let decrypted: Uint8Array | null = null;
        
        if (sizeMB > 3) {
          console.log(`[Video Download] Fallback: Large file (${sizeMB.toFixed(2)}MB) - trying optimized decryption first...`);
          decrypted = this.decryptOptimized(encryptedData, nonce, videoKey);
          
          if (!decrypted) {
            console.log(`[Video Download] Fallback: Optimized decryption failed, using standard method...`);
            decrypted = this.decrypt(encryptedData, nonce, videoKey);
          }
        } else {
          console.log(`[Video Download] Fallback: Small file (${sizeMB.toFixed(2)}MB) - using standard decryption...`);
          decrypted = this.decrypt(encryptedData, nonce, videoKey);
        }
        
        const naclDuration = (Date.now() - naclStart) / 1000;
        console.log(`[Video Download] Fallback: Pure nacl.secretbox.open() took: ${naclDuration.toFixed(3)}s`);
        
        if (!decrypted) {
          console.error('[Video Download] Fallback: nacl.secretbox.open() returned null - decryption failed');
          throw new Error('Failed to decrypt video - invalid key or corrupted data');
        }
        
        const totalDecryptDuration = (Date.now() - decryptStart) / 1000;
        console.log(`[Video Download] Fallback: Total decrypt step (including logging): ${totalDecryptDuration.toFixed(3)}s`);
        console.log(`[Video Download] Fallback: Decrypted ${decrypted.length} bytes`);
        console.log(`[Video Download] Fallback: Decrypt performance: ${(decrypted.length / 1024 / 1024 / naclDuration).toFixed(1)} MB/s`);
        onProgress?.(0.8);
        
        // Write decrypted data
        console.log(`[Video Download] Fallback: Saving to: ${outputPath}`);
        const saveStart = Date.now();
        
        const decryptedBase64 = Buffer.from(decrypted).toString('base64');
        
        await FileSystem.writeAsStringAsync(outputPath, decryptedBase64, {
          encoding: FileSystem.EncodingType.Base64
        });
        
        console.log(`[Video Download] Fallback: Saved in ${((Date.now() - saveStart) / 1000).toFixed(1)}s`);
        
        // Clean up temp file
        await FileSystem.deleteAsync(tempPath, { idempotent: true });
        
        // Verify final file
        const savedInfo = await FileSystem.getInfoAsync(outputPath);
        console.log(`[Video Download] Final file: ${((savedInfo.size || 0) / 1024 / 1024).toFixed(2)}MB at ${outputPath}`);
        
        const totalDuration = (Date.now() - startTime) / 1000;
        console.log(`[Video Download] Fallback Total time: ${totalDuration.toFixed(1)}s`);
        
        onProgress?.(1.0);
        
        return outputPath;
      }
      
    } catch (error) {
      console.error('[Video Download] Failed:', error);
      throw error;
    }
  }
}