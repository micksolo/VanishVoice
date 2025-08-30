"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressVideo = compressVideo;
exports.estimateCompressedSize = estimateCompressedSize;
exports.calculateOptimalSettings = calculateOptimalSettings;
exports.cleanupCompressedVideo = cleanupCompressedVideo;
exports.getVideoMetadata = getVideoMetadata;
const FileSystem = __importStar(require("expo-file-system"));
const expoGoCompat_1 = require("./expoGoCompat");
const DEFAULT_COMPRESSION_OPTIONS = {
    width: 1280, // 720p width
    height: 720, // 720p height
    bitrate: 2000000, // 2 Mbps
    minimumBitrate: 1000000, // 1 Mbps minimum
    maxSize: 10, // Target 10MB max
    compressionMethod: 'auto',
};
/**
 * Compress a video file with progress tracking
 * @param videoUri - The URI of the video to compress
 * @param onProgress - Progress callback function
 * @param options - Compression options
 * @returns Promise with compression result
 */
async function compressVideo(videoUri, onProgress, options = {}) {
    const startTime = Date.now();
    const mergedOptions = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };
    try {
        // Get original file size
        const originalFileInfo = await FileSystem.getInfoAsync(videoUri);
        if (!originalFileInfo.exists) {
            throw new Error('Video file not found');
        }
        const originalSize = originalFileInfo.size || 0;
        // Get compressor (real or mock depending on environment)
        const compressor = await (0, expoGoCompat_1.getCompressor)();
        // Show Expo Go limitation warning if applicable
        if (expoGoCompat_1.isExpoGo) {
            console.warn('🚧 Video compression in Expo Go mode - using original video');
        }
        else {
            // Log compression attempt
            console.log(`Starting video compression:
        Original size: ${(originalSize / 1024 / 1024).toFixed(2)}MB
        Target bitrate: ${mergedOptions.bitrate / 1000000}Mbps
        Target resolution: ${mergedOptions.width}x${mergedOptions.height}`);
        }
        // Compress the video
        const compressedUri = await compressor.Video.compress(videoUri, {
            compressionMethod: mergedOptions.compressionMethod,
            bitrate: mergedOptions.bitrate,
            minimumBitrate: mergedOptions.minimumBitrate,
            maxSize: mergedOptions.width,
            // Note: react-native-compressor uses maxSize for width in some versions
            // We'll handle resolution properly based on the library version
        }, (progress) => {
            // Progress is a number between 0 and 1
            const percent = Math.round(progress * 100);
            if (onProgress) {
                onProgress({
                    percent,
                    currentSize: originalSize * progress, // Estimate
                    estimatedSize: originalSize * 0.15, // Estimate 85% compression
                });
            }
        });
        // Get compressed file size
        const compressedFileInfo = await FileSystem.getInfoAsync(compressedUri);
        if (!compressedFileInfo.exists) {
            throw new Error('Compressed video file not found');
        }
        const compressedSize = compressedFileInfo.size || 0;
        const compressionRatio = expoGoCompat_1.isExpoGo ? 0 : ((originalSize - compressedSize) / originalSize) * 100;
        const duration = Date.now() - startTime;
        if (expoGoCompat_1.isExpoGo) {
            console.log(`Video compression skipped (Expo Go mode):
        Original size: ${(originalSize / 1024 / 1024).toFixed(2)}MB
        Duration: ${(duration / 1000).toFixed(1)}s`);
        }
        else {
            console.log(`Video compression complete:
        Compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)}MB
        Compression ratio: ${compressionRatio.toFixed(1)}%
        Duration: ${(duration / 1000).toFixed(1)}s`);
        }
        return {
            uri: compressedUri,
            originalSize,
            compressedSize: expoGoCompat_1.isExpoGo ? originalSize : compressedSize,
            compressionRatio,
            duration,
        };
    }
    catch (error) {
        console.error('Video compression failed:', error);
        throw new Error(`Failed to compress video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Estimate the compressed size of a video
 * @param originalSize - Original file size in bytes
 * @param targetBitrate - Target bitrate in bits per second
 * @param videoDuration - Video duration in seconds
 * @returns Estimated compressed size in bytes
 */
function estimateCompressedSize(originalSize, targetBitrate = DEFAULT_COMPRESSION_OPTIONS.bitrate, videoDuration = 30) {
    // Estimate based on bitrate and duration
    // Add 10% overhead for audio and container
    const estimatedSize = (targetBitrate * videoDuration) / 8 * 1.1;
    // If the estimate is larger than original, assume 85% compression
    if (estimatedSize >= originalSize) {
        return originalSize * 0.15;
    }
    return estimatedSize;
}
/**
 * Calculate optimal compression settings based on original video size and target
 * @param originalSize - Original file size in bytes
 * @param targetSize - Target file size in bytes
 * @param videoDuration - Video duration in seconds
 * @returns Optimal compression options
 */
function calculateOptimalSettings(originalSize, targetSize = 10 * 1024 * 1024, // 10MB default
videoDuration = 30) {
    // Calculate required bitrate to achieve target size
    // Account for 10% overhead
    const targetBitrate = (targetSize * 8) / videoDuration / 1.1;
    // Clamp bitrate between reasonable bounds
    const bitrate = Math.max(500000, // 500 Kbps minimum
    Math.min(targetBitrate, 4000000) // 4 Mbps maximum
    );
    // Adjust resolution based on bitrate
    let width = 1280;
    let height = 720;
    if (bitrate < 1000000) {
        // Use 480p for very low bitrates
        width = 854;
        height = 480;
    }
    else if (bitrate > 3000000) {
        // Allow 1080p for high bitrates
        width = 1920;
        height = 1080;
    }
    return {
        width,
        height,
        bitrate: Math.round(bitrate),
        minimumBitrate: Math.round(bitrate * 0.5),
        compressionMethod: 'auto',
    };
}
/**
 * Clean up temporary compressed video files
 * @param videoUri - URI of the video file to delete
 */
async function cleanupCompressedVideo(videoUri) {
    try {
        const fileInfo = await FileSystem.getInfoAsync(videoUri);
        if (fileInfo.exists) {
            await FileSystem.deleteAsync(videoUri, { idempotent: true });
            console.log('Cleaned up compressed video:', videoUri);
        }
    }
    catch (error) {
        console.error('Failed to cleanup compressed video:', error);
    }
}
/**
 * Get video metadata (duration, dimensions, etc.)
 * Note: This is a placeholder as react-native-compressor doesn't provide metadata
 * In a production app, you might use a different library for this
 */
async function getVideoMetadata(videoUri) {
    // For now, return empty metadata
    // In production, integrate a library like react-native-video or ffmpeg
    return {};
}
