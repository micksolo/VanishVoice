import { supabase } from '../services/supabase';
import * as FileSystem from 'expo-file-system';

export const uploadAudio = async (localUri: string, userId: string): Promise<string | null> => {
  try {
    // Create a unique filename with .mp3 extension for compatibility
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const filename = `${userId}/${timestamp}_${randomId}.mp3`;

    // Read the file
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
      throw new Error('Audio file does not exist');
    }

    // Read file as base64 and convert to array buffer
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Convert base64 to array buffer
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to Supabase Storage with audio/mpeg mime type
    const { data, error } = await supabase.storage
      .from('voice-messages')
      .upload(filename, bytes.buffer, {
        contentType: 'audio/mpeg',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    console.log('Audio uploaded successfully:', filename);
    return filename;
  } catch (error) {
    console.error('Error uploading audio:', error);
    return null;
  }
};

export const getAudioUrl = (path: string): string => {
  // Get the public URL for the audio file
  const { data } = supabase.storage
    .from('voice-messages')
    .getPublicUrl(path);

  return data.publicUrl;
};

export const downloadAudio = async (path: string): Promise<string | null> => {
  try {
    // Get the public URL
    const publicUrl = getAudioUrl(path);
    
    // Create a local filename
    const localUri = `${FileSystem.cacheDirectory}voice_${Date.now()}.mp3`;
    
    // Download the file
    const downloadResult = await FileSystem.downloadAsync(publicUrl, localUri);
    
    if (downloadResult.status === 200) {
      return downloadResult.uri;
    }
    
    throw new Error('Failed to download audio');
  } catch (error) {
    console.error('Error downloading audio:', error);
    return null;
  }
};