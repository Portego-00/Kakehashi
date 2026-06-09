import { startupDiagnostics } from "./startupDiagnostics";
import { isPortegoUsername } from "./portegoAccess";

/**
 * API Call Debugger
 * 
 * Tracks all WaniKani API calls to help understand rate limit issues and caching behavior.
 * 
 * Features:
 * - Tracks every API call with timestamp, endpoint, params, and result
 * - Shows cache hits vs API calls
 * - Displays rate limit headers from responses
 * - Calculates calls per minute
 * - Groups calls by endpoint for analysis
 */

export type ApiCallInfo = {
  id: string;
  timestamp: number;
  endpoint: string;
  params?: Record<string, any>;
  cacheHit: boolean;
  httpStatus?: number;
  duration: number;
  rateLimitRemaining?: number;
  rateLimitLimit?: number;
  rateLimitReset?: number;
  error?: string;
};

export type ApiTimelineResponse = {
  status: number;
  ok: boolean;
  contentType: string | null;
  headers: Record<string, string>;
  bodyPreview: string | null;
  bodySize: number;
  bodyTruncated: boolean;
};

export type ApiTimelineEntry = {
  id: string;
  timestamp: number;
  startedAt: number;
  completedAt: number;
  duration: number;
  method: string;
  operation: string;
  url: string;
  path: string;
  params?: Record<string, string | string[]>;
  requestHeaders?: Record<string, string>;
  requestBody?: unknown;
  response?: ApiTimelineResponse;
  error?: string;
};

export type ApiTimelineExport = {
  exportedAt: string;
  summary: {
    totalRequests: number;
    errorCount: number;
    averageDurationMs: number;
    slowestRequests: {
      url: string;
      method: string;
      duration: number;
      status?: number;
      error?: string;
    }[];
    byPath: Record<
      string,
      {
        count: number;
        averageDurationMs: number;
        errorCount: number;
      }
    >;
  };
  entries: ApiTimelineEntry[];
};

type NetworkLogInput = {
  method: string;
  requestUrl: string;
  operation: string;
  durationMs: number;
  requestInit?: RequestInit;
  response?: Response;
  error?: unknown;
};

class ApiDebugger {
  private calls: ApiCallInfo[] = [];
  private timelineEntries: ApiTimelineEntry[] = [];
  private enabled: boolean = __DEV__;
  private timelineEnabled: boolean = __DEV__;
  private readonly maxCalls = 5000;
  private readonly maxTimelineEntries = 2000;
  private readonly maxBodyPreviewLength = 12000;
  
  /**
   * Log an API call
   */
  logCall(info: Omit<ApiCallInfo, 'id' | 'timestamp'>): ApiCallInfo {
    const call: ApiCallInfo = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...info,
    };
    
    this.calls.push(call);
    if (this.calls.length > this.maxCalls) {
      this.calls.splice(0, this.calls.length - this.maxCalls);
    }

    startupDiagnostics.recordApiCall({
      timestamp: call.timestamp,
      endpoint: call.endpoint,
      cacheHit: call.cacheHit,
      httpStatus: call.httpStatus,
      duration: call.duration,
      params: call.params as Record<string, unknown> | undefined,
      rateLimitRemaining: call.rateLimitRemaining,
      rateLimitLimit: call.rateLimitLimit,
      rateLimitReset: call.rateLimitReset,
      error: call.error,
    });
    
    if (this.enabled && !startupDiagnostics.shouldSuppressApiCallLogs()) {
      this.printCall(call);
    }
    
    return call;
  }

  async logNetworkCall(info: NetworkLogInput): Promise<ApiTimelineEntry | null> {
    if (!this.timelineEnabled) {
      return null;
    }

    const completedAt = Date.now();
    const startedAt = completedAt - Math.max(0, info.durationMs);
    const normalizedMethod = info.method.toUpperCase();
    const normalizedUrl = this.normalizeUrl(info.requestUrl);
    const { path, params } = this.extractUrlParams(normalizedUrl);
    const requestHeaders = this.normalizeRequestHeaders(info.requestInit?.headers);
    const requestBody = this.normalizeRequestBody(info.requestInit?.body);

    const timelineEntry: ApiTimelineEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      timestamp: startedAt,
      startedAt,
      completedAt,
      duration: Math.max(0, info.durationMs),
      method: normalizedMethod,
      operation: info.operation,
      url: normalizedUrl,
      path,
      params: Object.keys(params).length > 0 ? params : undefined,
      requestHeaders: requestHeaders && Object.keys(requestHeaders).length > 0 ? requestHeaders : undefined,
      requestBody,
      error: this.normalizeErrorMessage(info.error),
    };

    if (info.response) {
      timelineEntry.response = await this.captureResponse(info.response);
    }

    this.timelineEntries.push(timelineEntry);
    if (this.timelineEntries.length > this.maxTimelineEntries) {
      this.timelineEntries.splice(
        0,
        this.timelineEntries.length - this.maxTimelineEntries
      );
    }

    return timelineEntry;
  }

  private async captureResponse(response: Response): Promise<ApiTimelineResponse> {
    const contentType = response.headers.get("content-type");
    let bodyPreview: string | null = null;
    let bodySize = 0;
    let bodyTruncated = false;

    try {
      const responseText = await response.clone().text();
      bodySize = responseText.length;
      if (responseText.length > this.maxBodyPreviewLength) {
        bodyPreview = responseText.slice(0, this.maxBodyPreviewLength);
        bodyTruncated = true;
      } else {
        bodyPreview = responseText;
      }
    } catch (error) {
      bodyPreview = `[Uncaptured body: ${this.normalizeErrorMessage(error) ?? "unknown error"}]`;
    }

    return {
      status: response.status,
      ok: response.ok,
      contentType,
      headers: this.normalizeResponseHeaders(response.headers),
      bodyPreview,
      bodySize,
      bodyTruncated,
    };
  }

  private normalizeRequestHeaders(
    headers?: HeadersInit
  ): Record<string, string> | undefined {
    if (!headers) {
      return undefined;
    }

    const normalized = new Headers(headers);
    const out: Record<string, string> = {};
    normalized.forEach((value, key) => {
      out[key.toLowerCase()] = this.sanitizeHeaderValue(key, value);
    });
    return out;
  }

  private normalizeResponseHeaders(headers: Headers): Record<string, string> {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key.toLowerCase()] = value;
    });
    return out;
  }

  private normalizeRequestBody(body: RequestInit["body"]): unknown {
    if (body === null || body === undefined) {
      return undefined;
    }

    if (typeof body === "string") {
      return this.truncateString(body);
    }

    if (body instanceof URLSearchParams) {
      return this.truncateString(body.toString());
    }

    if (typeof FormData !== "undefined" && body instanceof FormData) {
      const fields: Record<string, string> = {};
      body.forEach((value, key) => {
        if (typeof value === "string") {
          fields[key] = this.truncateString(value);
        } else {
          fields[key] = "[binary]";
        }
      });
      return fields;
    }

    if (typeof Blob !== "undefined" && body instanceof Blob) {
      return `[blob:${body.type || "unknown"}:${body.size}]`;
    }

    return this.truncateString(String(body));
  }

  private normalizeUrl(urlValue: string): string {
    try {
      const parsedUrl = new URL(urlValue);
      const redacted = new URL(parsedUrl.toString());
      redacted.searchParams.forEach((value, key) => {
        if (this.isSensitiveKey(key)) {
          redacted.searchParams.set(key, "[REDACTED]");
        } else {
          redacted.searchParams.set(key, this.truncateString(value, 500));
        }
      });
      return redacted.toString();
    } catch {
      return urlValue;
    }
  }

  private extractUrlParams(urlValue: string): {
    path: string;
    params: Record<string, string | string[]>;
  } {
    const params: Record<string, string | string[]> = {};

    try {
      const parsedUrl = new URL(urlValue);
      parsedUrl.searchParams.forEach((value, key) => {
        const safeValue = this.isSensitiveKey(key)
          ? "[REDACTED]"
          : this.truncateString(value, 500);
        const existing = params[key];
        if (existing === undefined) {
          params[key] = safeValue;
        } else if (Array.isArray(existing)) {
          existing.push(safeValue);
        } else {
          params[key] = [existing, safeValue];
        }
      });
      return { path: parsedUrl.pathname, params };
    } catch {
      return { path: urlValue, params };
    }
  }

  private isSensitiveKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return (
      normalized.includes("token") ||
      normalized.includes("authorization") ||
      normalized.includes("api_key") ||
      normalized.includes("apikey") ||
      normalized.includes("secret") ||
      normalized.includes("password")
    );
  }

  private sanitizeHeaderValue(key: string, value: string): string {
    if (this.isSensitiveKey(key) || key.toLowerCase() === "cookie") {
      return "[REDACTED]";
    }
    return this.truncateString(value, 1000);
  }

  private truncateString(value: string, maxLength = this.maxBodyPreviewLength): string {
    if (value.length <= maxLength) {
      return value;
    }
    return `${value.slice(0, maxLength)}... [truncated ${value.length - maxLength} chars]`;
  }

  private normalizeErrorMessage(error: unknown): string | undefined {
    if (error === undefined || error === null) {
      return undefined;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  setDebugAccessByUsername(username?: string | null) {
    const hasAccess = __DEV__ || isPortegoUsername(username);
    this.enabled = hasAccess;
    this.timelineEnabled = hasAccess;
  }
  
  /**
   * Print a single call to console with color coding
   */
  private printCall(call: ApiCallInfo) {
    const icon = call.cacheHit ? '💾' : call.error ? '❌' : '🌐';
    const status = call.error ? 'ERROR' : call.cacheHit ? 'CACHE' : 'API';
    const time = new Date(call.timestamp).toLocaleTimeString();
    const paramsStr = call.params ? ` ${JSON.stringify(call.params)}` : '';
    
    console.log(
      `${icon} [${status}] ${time} ${call.endpoint}${paramsStr} - ${call.duration}ms`,
      call.rateLimitRemaining !== undefined 
        ? `| Rate limit: ${call.rateLimitRemaining}/${call.rateLimitLimit}`
        : ''
    );
    
    if (call.error) {
      console.error(`   └─ Error: ${call.error}`);
    }
  }
  
  /**
   * Get summary of all calls
   */
  getSummary() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const fiveMinutesAgo = now - 300000;
    
    // Calls in the last minute (for rate limit tracking)
    const callsLastMinute = this.calls.filter(c => c.timestamp >= oneMinuteAgo && !c.cacheHit);
    
    // All calls in last 5 minutes
    const recentCalls = this.calls.filter(c => c.timestamp >= fiveMinutesAgo);
    
    // Group by endpoint
    const byEndpoint = recentCalls.reduce((acc, call) => {
      if (!acc[call.endpoint]) {
        acc[call.endpoint] = { total: 0, cached: 0, api: 0, errors: 0 };
      }
      acc[call.endpoint].total++;
      if (call.cacheHit) acc[call.endpoint].cached++;
      else if (call.error) acc[call.endpoint].errors++;
      else acc[call.endpoint].api++;
      return acc;
    }, {} as Record<string, { total: number; cached: number; api: number; errors: number }>);
    
    // Get latest rate limit info
    const latestCallWithRateLimit = [...recentCalls]
      .reverse()
      .find(c => c.rateLimitRemaining !== undefined);
    
    return {
      totalCalls: recentCalls.length,
      apiCalls: recentCalls.filter(c => !c.cacheHit && !c.error).length,
      cachedCalls: recentCalls.filter(c => c.cacheHit).length,
      errors: recentCalls.filter(c => c.error).length,
      callsLastMinute: callsLastMinute.length,
      byEndpoint,
      rateLimit: latestCallWithRateLimit ? {
        remaining: latestCallWithRateLimit.rateLimitRemaining!,
        limit: latestCallWithRateLimit.rateLimitLimit!,
        resetAt: latestCallWithRateLimit.rateLimitReset 
          ? new Date(latestCallWithRateLimit.rateLimitReset * 1000)
          : undefined,
      } : undefined,
      avgDuration: recentCalls.length > 0 
        ? Math.round(recentCalls.reduce((sum, c) => sum + c.duration, 0) / recentCalls.length)
        : 0,
    };
  }
  
  /**
   * Print a detailed summary to console
   */
  printSummary() {
    if (!this.enabled) return;
    
    const summary = this.getSummary();
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 WaniKani API Call Summary (Last 5 minutes)');
    console.log('='.repeat(80));
    console.log(`Total Calls:    ${summary.totalCalls}`);
    console.log(`  - API Calls:  ${summary.apiCalls} (count against rate limit)`);
    console.log(`  - Cache Hits: ${summary.cachedCalls}`);
    console.log(`  - Errors:     ${summary.errors}`);
    console.log(`\nRate Limit:`);
    if (summary.rateLimit) {
      console.log(`  ${summary.rateLimit.remaining}/${summary.rateLimit.limit} remaining`);
      if (summary.rateLimit.resetAt) {
        const secondsUntilReset = Math.round((summary.rateLimit.resetAt.getTime() - Date.now()) / 1000);
        console.log(`  Resets in: ${secondsUntilReset}s`);
      }
    } else {
      console.log(`  No rate limit data available`);
    }
    console.log(`\nCalls in last minute: ${summary.callsLastMinute} / 60 (${Math.round(summary.callsLastMinute / 60 * 100)}%)`);
    console.log(`Average duration: ${summary.avgDuration}ms`);
    
    console.log('\n' + '-'.repeat(80));
    console.log('By Endpoint:');
    console.log('-'.repeat(80));
    
    Object.entries(summary.byEndpoint)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([endpoint, stats]) => {
        const cacheHitRate = stats.total > 0 
          ? Math.round((stats.cached / stats.total) * 100) 
          : 0;
        console.log(`${endpoint}:`);
        console.log(`  Total: ${stats.total} | API: ${stats.api} | Cache: ${stats.cached} (${cacheHitRate}%) | Errors: ${stats.errors}`);
      });
    
    console.log('='.repeat(80) + '\n');
    
    // Warning if approaching rate limit
    if (summary.callsLastMinute > 50) {
      console.warn('⚠️  WARNING: Approaching rate limit! (' + summary.callsLastMinute + '/60 calls in last minute)');
    }
    if (summary.rateLimit && summary.rateLimit.remaining < 10) {
      console.warn('⚠️  WARNING: Low rate limit remaining! (' + summary.rateLimit.remaining + ' remaining)');
    }
  }
  
  /**
   * Clear all stored calls
   */
  clear() {
    this.calls = [];
    this.timelineEntries = [];
  }

  clearTimeline() {
    this.timelineEntries = [];
  }
  
  /**
   * Enable/disable debugging
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setTimelineEnabled(enabled: boolean) {
    this.timelineEnabled = enabled;
  }

  isTimelineEnabled(): boolean {
    return this.timelineEnabled;
  }
  
  /**
   * Get all calls (for detailed analysis)
   */
  getAllCalls(): ApiCallInfo[] {
    return [...this.calls];
  }

  getTimelineEntries(): ApiTimelineEntry[] {
    return [...this.timelineEntries];
  }

  getTimelineSummary(): ApiTimelineExport["summary"] {
    const entries = this.timelineEntries;
    const totalRequests = entries.length;
    const errorCount = entries.filter((entry) => Boolean(entry.error)).length;
    const averageDurationMs =
      totalRequests > 0
        ? Math.round(
            entries.reduce((sum, entry) => sum + entry.duration, 0) / totalRequests
          )
        : 0;

    const slowestRequests = [...entries]
      .sort((left, right) => right.duration - left.duration)
      .slice(0, 10)
      .map((entry) => ({
        url: entry.url,
        method: entry.method,
        duration: entry.duration,
        status: entry.response?.status,
        error: entry.error,
      }));

    const endpointMap = new Map<
      string,
      {
        count: number;
        totalDuration: number;
        errorCount: number;
      }
    >();

    entries.forEach((entry) => {
      const key = entry.path;
      const existing = endpointMap.get(key) ?? {
        count: 0,
        totalDuration: 0,
        errorCount: 0,
      };
      existing.count += 1;
      existing.totalDuration += entry.duration;
      if (entry.error) {
        existing.errorCount += 1;
      }
      endpointMap.set(key, existing);
    });

    const byPath: ApiTimelineExport["summary"]["byPath"] = {};
    endpointMap.forEach((values, path) => {
      byPath[path] = {
        count: values.count,
        averageDurationMs: Math.round(values.totalDuration / values.count),
        errorCount: values.errorCount,
      };
    });

    return {
      totalRequests,
      errorCount,
      averageDurationMs,
      slowestRequests,
      byPath,
    };
  }

  buildTimelineExportPayload(): ApiTimelineExport {
    return {
      exportedAt: new Date().toISOString(),
      summary: this.getTimelineSummary(),
      entries: this.getTimelineEntries(),
    };
  }

  printTimelineSummary() {
    if (!this.enabled) return;

    const summary = this.getTimelineSummary();
    console.log("\n" + "=".repeat(80));
    console.log("WaniKani API Timeline Summary");
    console.log("=".repeat(80));
    console.log(`Total Requests: ${summary.totalRequests}`);
    console.log(`Errors: ${summary.errorCount}`);
    console.log(`Average Duration: ${summary.averageDurationMs}ms`);
    console.log("\nSlowest Requests:");
    summary.slowestRequests.slice(0, 5).forEach((entry, index) => {
      const status = entry.status ? `status ${entry.status}` : "no status";
      const error = entry.error ? ` | error: ${entry.error}` : "";
      console.log(
        `${index + 1}. [${entry.method}] ${entry.url} - ${entry.duration}ms (${status})${error}`
      );
    });
    console.log("=".repeat(80) + "\n");
  }
  
  /**
   * Print detailed call log with timestamps and full payloads
   */
  printDetailedLog() {
    if (!this.enabled) return;
    
    const recentCalls = this.calls.filter(c => c.timestamp >= Date.now() - 300000); // Last 5 minutes
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 Detailed API Call Log (Last 5 minutes)');
    console.log('='.repeat(80));
    
    if (recentCalls.length === 0) {
      console.log('No API calls recorded in the last 5 minutes.');
      console.log('='.repeat(80) + '\n');
      return;
    }
    
    recentCalls.forEach((call, index) => {
      const time = new Date(call.timestamp).toLocaleTimeString();
      const icon = call.cacheHit ? '💾' : call.error ? '❌' : '🌐';
      const status = call.error ? 'ERROR' : call.cacheHit ? 'CACHE' : 'API';
      
      console.log(`\n${index + 1}. ${icon} [${status}] ${time}`);
      console.log(`   Endpoint: ${call.endpoint}`);
      
      if (call.params) {
        console.log(`   Params: ${JSON.stringify(call.params, null, 2).split('\n').join('\n           ')}`);
      }
      
      console.log(`   Duration: ${call.duration}ms`);
      
      if (call.httpStatus) {
        console.log(`   HTTP Status: ${call.httpStatus}`);
      }
      
      if (call.rateLimitRemaining !== undefined) {
        console.log(`   Rate Limit: ${call.rateLimitRemaining}/${call.rateLimitLimit} remaining`);
        if (call.rateLimitReset) {
          const resetTime = new Date(call.rateLimitReset * 1000);
          const secondsUntil = Math.round((resetTime.getTime() - Date.now()) / 1000);
          console.log(`   Rate Reset: in ${secondsUntil}s (${resetTime.toLocaleTimeString()})`);
        }
      }
      
      if (call.error) {
        console.log(`   Error: ${call.error}`);
      }
    });
    
    console.log('\n' + '='.repeat(80) + '\n');
  }
}

// Export singleton instance
export const apiDebugger = new ApiDebugger();

// Make it available globally for console debugging
if (typeof global !== 'undefined') {
  (global as any).apiDebugger = apiDebugger;
}
