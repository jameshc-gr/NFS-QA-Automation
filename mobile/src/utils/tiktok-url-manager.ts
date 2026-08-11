import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface TikTokVideoCollection {
  timestamp: string;
  buildInfo: string;
  platform: string;
  environment: string;
  totalVideos: number;
  urls: string[];
  duplicatesFound: number;
  sessionDuration: number; // in seconds
}

export interface UrlMismatchReport {
  timestamp: string;
  totalFromFeed: number;
  totalFromExcel: number;
  urlsInFeedButNotInExcel: string[];
  urlsInExcelButNotInFeed: string[];
  commonUrls: string[];
  matchPercentage: number;
}

/**
 * Utility class for managing TikTok video URL collection and comparison
 */
export class TikTokUrlManager {
  private collectedUrls: Set<string> = new Set();
  private duplicateCount: number = 0;
  private startTime: number = Date.now();

  /**
   * Add a URL to the collection with deduplication
   */
  addUrl(url: string): boolean {
    const normalized = this.normalizeUrl(url);
    
    if (!normalized) {
      return false;
    }

    if (this.collectedUrls.has(normalized)) {
      this.duplicateCount++;
      console.log(`[URLManager] Duplicate URL found: ${url}`);
      return false;
    }

    this.collectedUrls.add(normalized);
    console.log(`[URLManager] Added URL #${this.collectedUrls.size}: ${normalized}`);
    return true;
  }

  /**
   * Add multiple URLs at once
   */
  addUrls(urls: string[]): number {
    let added = 0;
    for (const url of urls) {
      if (this.addUrl(url)) {
        added++;
      }
    }
    return added;
  }

  /**
   * Normalize a URL for comparison (remove query params, fragments, trailing slashes, etc)
   */
  private normalizeUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      return '';
    }

    try {
      // Decode if encoded
      let normalized = decodeURIComponent(url.trim());

      // Remove query params and fragments
      normalized = normalized.split('?')[0].split('#')[0];

      // Remove trailing slashes
      normalized = normalized.replace(/\/$/, '');

      // Remove protocol for comparison (http vs https)
      normalized = normalized.replace(/^https?:\/\//, '');

      return normalized;
    } catch (error) {
      console.error(`[URLManager] Failed to normalize URL: ${url}`, error);
      return '';
    }
  }

  /**
   * Get all collected URLs
   */
  getUrls(): string[] {
    return Array.from(this.collectedUrls);
  }

  /**
   * Get unique URL count
   */
  getUniqueCount(): number {
    return this.collectedUrls.size;
  }

  /**
   * Get duplicate count
   */
  getDuplicateCount(): number {
    return this.duplicateCount;
  }

  /**
   * Get session duration in seconds
   */
  getSessionDuration(): number {
    return Math.round((Date.now() - this.startTime) / 1000);
  }

  /**
   * Save collected URLs to a JSON file
   */
  async saveToFile(
    outputPath: string = 'mobile/.builds/tiktok-urls-collected.json',
    buildInfo: string = 'unknown',
    platform: string = 'unknown',
    environment: string = 'unknown'
  ): Promise<TikTokVideoCollection> {
    const fullPath = resolve(process.cwd(), outputPath);
    const data: TikTokVideoCollection = {
      timestamp: new Date().toISOString(),
      buildInfo,
      platform,
      environment,
      totalVideos: this.getUniqueCount(),
      urls: this.getUrls().sort(),
      duplicatesFound: this.getDuplicateCount(),
      sessionDuration: this.getSessionDuration()
    };

    writeFileSync(fullPath, JSON.stringify(data, null, 2));
    console.log(`[URLManager] Saved ${data.totalVideos} unique URLs to ${fullPath}`);
    return data;
  }

  /**
   * Load URLs from a previously saved collection file
   */
  static async loadFromFile(filePath: string): Promise<TikTokVideoCollection | null> {
    const fullPath = resolve(process.cwd(), filePath);
    if (!existsSync(fullPath)) {
      console.error(`[URLManager] File not found: ${fullPath}`);
      return null;
    }

    try {
      const content = readFileSync(fullPath, 'utf-8');
      return JSON.parse(content) as TikTokVideoCollection;
    } catch (error) {
      console.error(`[URLManager] Failed to load file: ${fullPath}`, error);
      return null;
    }
  }

  /**
   * Load and parse Excel file with TikTok URLs
   * Expects Excel file to have URLs in a specific column
   */
  static async loadUrlsFromExcel(
    excelFilePath: string,
    columnIndex: number = 0 // First column by default
  ): Promise<string[]> {
    try {
      // Try to use xlsx if available
      try {
        const xlsx = require('xlsx');
        const fullPath = resolve(process.cwd(), excelFilePath);
        if (!existsSync(fullPath)) {
          console.error(`[URLManager] Excel file not found: ${fullPath}`);
          return [];
        }

        const workbook = xlsx.readFile(fullPath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        const urls: string[] = [];
        for (const row of data) {
          if (row[columnIndex] && typeof row[columnIndex] === 'string') {
            const url = row[columnIndex].trim();
            if (url.includes('tiktok') || url.startsWith('http')) {
              urls.push(url);
            }
          }
        }

        console.log(`[URLManager] Loaded ${urls.length} URLs from Excel: ${excelFilePath}`);
        return urls;
      } catch (xlsxError) {
        console.log('[URLManager] xlsx not available, trying fallback methods');
        return [];
      }
    } catch (error) {
      console.error(`[URLManager] Failed to load Excel file:`, error);
      return [];
    }
  }

  /**
   * Compare collected URLs with Excel file URLs
   */
  async compareWithExcelFile(
    excelFilePath: string,
    columnIndex: number = 0
  ): Promise<UrlMismatchReport> {
    const excelUrls = await TikTokUrlManager.loadUrlsFromExcel(excelFilePath, columnIndex);
    const feedUrls = this.getUrls();

    // Normalize both sets
    const normalizedFeedUrls = new Set(feedUrls.map(u => this.normalizeUrl(u)));
    const normalizedExcelUrls = new Set(excelUrls.map(u => this.normalizeUrl(u)));

    // Find differences
    const urlsInFeedButNotInExcel = Array.from(normalizedFeedUrls).filter(
      url => !normalizedExcelUrls.has(url)
    );

    const urlsInExcelButNotInFeed = Array.from(normalizedExcelUrls).filter(
      url => !normalizedFeedUrls.has(url)
    );

    const commonUrls = Array.from(normalizedFeedUrls).filter(url => normalizedExcelUrls.has(url));

    const matchPercentage =
      normalizedExcelUrls.size > 0 ? Math.round((commonUrls.length / normalizedExcelUrls.size) * 100) : 0;

    const report: UrlMismatchReport = {
      timestamp: new Date().toISOString(),
      totalFromFeed: normalizedFeedUrls.size,
      totalFromExcel: normalizedExcelUrls.size,
      urlsInFeedButNotInExcel,
      urlsInExcelButNotInFeed,
      commonUrls,
      matchPercentage
    };

    return report;
  }

  /**
   * Save comparison report to file
   */
  static async saveReportToFile(
    report: UrlMismatchReport,
    outputPath: string = 'mobile/.builds/tiktok-urls-mismatch-report.json'
  ): Promise<void> {
    const fullPath = resolve(process.cwd(), outputPath);
    writeFileSync(fullPath, JSON.stringify(report, null, 2));
    console.log(`[URLManager] Saved mismatch report to ${fullPath}`);
  }

  /**
   * Generate a human-readable summary of the comparison
   */
  static generateReportSummary(report: UrlMismatchReport): string {
    const lines = [
      '===========================================',
      'TikTok URL VALIDATION REPORT',
      '===========================================',
      `Generated: ${report.timestamp}`,
      '',
      'SUMMARY:',
      `  URLs collected from feed: ${report.totalFromFeed}`,
      `  URLs in Excel reference:  ${report.totalFromExcel}`,
      `  Common URLs found:        ${report.commonUrls.length}`,
      `  Match percentage:         ${report.matchPercentage}%`,
      '',
      'ISSUES FOUND:',
      `  URLs in feed but NOT in Excel: ${report.urlsInFeedButNotInExcel.length}`,
      `  URLs in Excel but NOT in feed: ${report.urlsInExcelButNotInFeed.length}`,
      ''
    ];

    if (report.urlsInFeedButNotInExcel.length > 0) {
      lines.push('UNLISTED URLs IN FEED (potential issue):');
      report.urlsInFeedButNotInExcel.forEach((url, i) => {
        lines.push(`  ${i + 1}. ${url}`);
      });
      lines.push('');
    }

    if (report.urlsInExcelButNotInFeed.length > 0) {
      lines.push('URLs IN EXCEL BUT NOT FOUND IN FEED:');
      report.urlsInExcelButNotInFeed.forEach((url, i) => {
        lines.push(`  ${i + 1}. ${url}`);
      });
      lines.push('');
    }

    lines.push('===========================================');
    return lines.join('\n');
  }
}
