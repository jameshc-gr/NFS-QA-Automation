import { spawn, exec } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export class NetworkInterceptor {
  private mitmproxySock: any = null;
  private logFile: string = '';
  private isRunning: boolean = false;

  /**
   * Start mitmproxy server with URL logging
   */
  async startProxy(port: number = 8080, logPath?: string): Promise<void> {
    if (this.isRunning) {
      console.log('[NetworkInterceptor] Proxy already running');
      return;
    }

    this.logFile = logPath || path.resolve(process.cwd(), 'mobile/.builds/network-traffic.log');
    
    console.log(`[NetworkInterceptor] Starting mitmproxy on port ${port}`);
    console.log(`[NetworkInterceptor] Logging to: ${this.logFile}`);

    // Create a Python script that mitmproxy will use to log requests
    const addonScript = path.resolve(process.cwd(), 'mobile/.builds/mitmproxy-addon.py');
    const addonContent = `
import re

class TikTokURLCapture:
    def __init__(self):
        self.log_file = "${this.logFile.replace(/\\/g, '\\\\')}"
    
    def request(self, flow):
        url = flow.request.pretty_url
        if 'tiktok' in url.lower() or 'video' in url.lower():
            with open(self.log_file, 'a') as f:
                f.write(url + '\\n')
            print(f"[TikTok] Captured: {url}")

addons = [TikTokURLCapture()]
`;
    
    writeFileSync(addonScript, addonContent);
    console.log(`[NetworkInterceptor] Created addon script: ${addonScript}`);

    return new Promise((resolve, reject) => {
      // Start mitmproxy with the addon
      const cmd = `/Users/jameshc/Library/Python/3.9/bin/mitmproxy -p ${port} -s "${addonScript}" --no-server 2>&1`;
      
      this.mitmproxySock = exec(cmd, (error, stdout, stderr) => {
        if (error && !this.isRunning) {
          console.error('[NetworkInterceptor] mitmproxy error:', error.message);
          reject(error);
        }
      });

      // Give mitmproxy time to start
      setTimeout(() => {
        this.isRunning = true;
        console.log('[NetworkInterceptor] Proxy started');
        resolve();
      }, 2000);
    });
  }

  /**
   * Stop the proxy server
   */
  async stopProxy(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('[NetworkInterceptor] Stopping proxy...');
    
    if (this.mitmproxySock) {
      this.mitmproxySock.kill();
    }

    this.isRunning = false;
    console.log('[NetworkInterceptor] Proxy stopped');
  }

  /**
   * Get all captured TikTok URLs from the log
   */
  async getCapturedUrls(): Promise<string[]> {
    if (!existsSync(this.logFile)) {
      return [];
    }

    try {
      const content = readFileSync(this.logFile, 'utf8');
      const urls = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && (line.includes('tiktok') || line.includes('vm.tiktok')));
      
      return [...new Set(urls)]; // Remove duplicates
    } catch (error) {
      console.error('[NetworkInterceptor] Error reading log file:', error);
      return [];
    }
  }

  /**
   * Clear the log file
   */
  clearLog(): void {
    if (existsSync(this.logFile)) {
      writeFileSync(this.logFile, '');
      console.log('[NetworkInterceptor] Log cleared');
    }
  }

  /**
   * Check if proxy is available on the system
   */
  static async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      exec('/Users/jameshc/Library/Python/3.9/bin/mitmproxy --version', (error) => {
        resolve(!error);
      });
    });
  }
}
