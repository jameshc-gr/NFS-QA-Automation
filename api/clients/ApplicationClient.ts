type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApplicationClientOptions {
  baseUrl: string;
  apiKey?: string;
  bearerToken?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

export class ApplicationClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly bearerToken?: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(options: ApplicationClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.bearerToken = options.bearerToken;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 500;
  }

  async getAddress(applicationId: string) {
    return this.request('GET', `/api/application/address`, {
      query: { id: applicationId }
    });
  }

  async updateAddress(applicationId: string, body: Record<string, unknown>) {
    return this.request('POST', `/api/application/address`, {
      query: { id: applicationId },
      body
    });
  }

  async getApplication(applicationId: string) {
    return this.request('GET', `/api/application`, {
      query: { id: applicationId }
    });
  }

  async updateApplication(applicationId: string, body: Record<string, unknown>) {
    return this.request('PATCH', `/api/application`, {
      query: { id: applicationId },
      body
    });
  }

  private async request(method: HttpMethod, route: string, options: RequestOptions = {}): Promise<any> {
    const url = new URL(`${this.baseUrl}${route}`);

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (typeof value !== 'undefined') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    if (this.bearerToken) {
      headers.Authorization = `Bearer ${this.bearerToken}`;
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const canRetry = response.status >= 500 && attempt < this.maxRetries;
      if (canRetry) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * (attempt + 1)));
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`${method} ${url.pathname} failed with ${response.status}: ${errorBody}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return response.json();
      }

      return response.text();
    }

    throw new Error(`Request failed after ${this.maxRetries + 1} attempts: ${method} ${url.pathname}`);
  }
}
