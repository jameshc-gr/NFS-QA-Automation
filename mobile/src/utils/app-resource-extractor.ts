import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export class AppResourceExtractor {
  /**
   * Extract tiktok_videos.json from the iOS app bundle
   */
  static async extractTikTokVideosFromBundle(appPath: string): Promise<any[]> {
    try {
      // For simulator apps, the .app bundle contains the resources
      // Try to find and read the tiktok_videos.json file
      const possiblePaths = [
        path.join(appPath, 'tiktok_videos.json'),
        path.join(appPath, 'Resources', 'tiktok_videos.json'),
        path.join(appPath, 'SuperApp', 'Resources', 'tiktok_videos.json')
      ];

      for (const filePath of possiblePaths) {
        if (existsSync(filePath)) {
          console.log(`[AppResourceExtractor] Found tiktok_videos.json at: ${filePath}`);
          const content = readFileSync(filePath, 'utf8');
          const parsed = JSON.parse(content);
          console.log(`[AppResourceExtractor] Loaded ${parsed.length} videos from app resources`);
          return parsed;
        }
      }

      console.log('[AppResourceExtractor] tiktok_videos.json not found in app bundle');
      console.log('[AppResourceExtractor] Tried paths:', possiblePaths);
      return [];
    } catch (error) {
      console.error('[AppResourceExtractor] Error extracting resources:', error);
      return [];
    }
  }

  /**
   * Get URLs from the extracted videos
   */
  static extractUrls(videos: any[]): string[] {
    return videos
      .filter(v => v.url)
      .map(v => v.url as string);
  }

  /**
   * Get the reference URLs that should be in the TikTok feed
   */
  static async getReferenceUrls(appPath: string): Promise<string[]> {
    const videos = await this.extractTikTokVideosFromBundle(appPath);
    return this.extractUrls(videos);
  }
}
