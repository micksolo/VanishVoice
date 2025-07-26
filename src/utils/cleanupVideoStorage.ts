import { supabase } from '../services/supabase';

/**
 * Delete all videos from Supabase storage
 * Run this to clean up the videos bucket
 */
export async function deleteAllVideosFromStorage(): Promise<void> {
  try {
    console.log('[Cleanup] Starting video storage cleanup...');
    
    // List all folders in the videos bucket
    const { data: folders, error: listError } = await supabase.storage
      .from('videos')
      .list('', {
        limit: 1000,
        offset: 0,
      });
    
    if (listError) {
      console.error('[Cleanup] Error listing videos:', listError);
      return;
    }
    
    if (!folders || folders.length === 0) {
      console.log('[Cleanup] No videos found in storage');
      return;
    }
    
    console.log(`[Cleanup] Found ${folders.length} video folders to delete`);
    
    // Process each video folder
    let deletedCount = 0;
    for (const folder of folders) {
      if (folder.name && folder.id) {
        try {
          // List all files in this video folder
          const { data: files, error: filesError } = await supabase.storage
            .from('videos')
            .list(folder.name, {
              limit: 100,
              offset: 0,
            });
          
          if (filesError) {
            console.error(`[Cleanup] Error listing files in ${folder.name}:`, filesError);
            continue;
          }
          
          if (files && files.length > 0) {
            // Build array of file paths to delete
            const filePaths = files.map(file => `${folder.name}/${file.name}`);
            
            // Delete all files in this folder
            const { error: deleteError } = await supabase.storage
              .from('videos')
              .remove(filePaths);
            
            if (deleteError) {
              console.error(`[Cleanup] Error deleting files in ${folder.name}:`, deleteError);
            } else {
              deletedCount++;
              console.log(`[Cleanup] Deleted video folder: ${folder.name} (${files.length} files)`);
            }
          }
        } catch (error) {
          console.error(`[Cleanup] Error processing folder ${folder.name}:`, error);
        }
      }
    }
    
    console.log(`[Cleanup] Cleanup complete! Deleted ${deletedCount} video folders`);
    
    // Also clean up any files in the root directory
    const { data: rootFiles, error: rootError } = await supabase.storage
      .from('videos')
      .list('', {
        limit: 1000,
        offset: 0,
        search: '.enc,.json,.mp4'
      });
    
    if (!rootError && rootFiles) {
      const rootFilePaths = rootFiles
        .filter(file => file.name && !file.id) // Files have name but no id
        .map(file => file.name);
      
      if (rootFilePaths.length > 0) {
        const { error: deleteRootError } = await supabase.storage
          .from('videos')
          .remove(rootFilePaths);
        
        if (!deleteRootError) {
          console.log(`[Cleanup] Also deleted ${rootFilePaths.length} files from root directory`);
        }
      }
    }
    
  } catch (error) {
    console.error('[Cleanup] Unexpected error during cleanup:', error);
  }
}

/**
 * Get storage usage statistics
 */
export async function getVideoStorageStats(): Promise<void> {
  try {
    const { data: folders, error } = await supabase.storage
      .from('videos')
      .list('', {
        limit: 1000,
        offset: 0,
      });
    
    if (error) {
      console.error('[Stats] Error getting storage stats:', error);
      return;
    }
    
    let totalSize = 0;
    let fileCount = 0;
    
    if (folders) {
      for (const folder of folders) {
        if (folder.name) {
          const { data: files } = await supabase.storage
            .from('videos')
            .list(folder.name);
          
          if (files) {
            fileCount += files.length;
            // Note: Supabase doesn't return file sizes in list API
            // You'd need to track this separately or use a different method
          }
        }
      }
    }
    
    console.log(`[Stats] Videos bucket contains:`);
    console.log(`[Stats] - ${folders?.length || 0} video folders`);
    console.log(`[Stats] - ${fileCount} total files`);
  } catch (error) {
    console.error('[Stats] Error getting stats:', error);
  }
}