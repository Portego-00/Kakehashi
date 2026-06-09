type OperationPhase = "loader" | "dashboard" | "post-loader" | "general";
type OperationStatus = "ok" | "error" | "skipped";

type StartupApiCall = {
  timestamp: number;
  endpoint: string;
  cacheHit: boolean;
  httpStatus?: number;
  duration: number;
  params?: Record<string, unknown>;
  rateLimitRemaining?: number;
  rateLimitLimit?: number;
  rateLimitReset?: number;
  error?: string;
};

type StartupOperation = {
  id: number;
  name: string;
  phase: OperationPhase;
  startedAt: number;
  endedAt?: number;
  duration?: number;
  status?: OperationStatus;
  details?: Record<string, unknown>;
  error?: string;
};

type StartupEvent = {
  name: string;
  at: number;
  details?: Record<string, unknown>;
};

type DashboardStageEntry = {
  stage: string;
  startedAt: number;
  endedAt?: number;
  duration?: number;
};

type StartupSession = {
  sessionId: string;
  startedAt: number;
  context: Record<string, unknown>;
  suppressPerCallApiLogs: boolean;
  summaryPrinted: boolean;
  operations: StartupOperation[];
  events: StartupEvent[];
  apiCalls: StartupApiCall[];
  dashboardStages: DashboardStageEntry[];
  loaderDismissRequestedAt?: number;
  loaderDismissedAt?: number;
  dashboardFetchStartedAt?: number;
  dashboardFetchCompletedAt?: number;
  dashboardFetchStatus?: OperationStatus;
  dashboardFetchError?: string;
};

type EndOperationOptions = {
  status?: OperationStatus;
  details?: Record<string, unknown>;
  error?: unknown;
};

function formatDuration(ms?: number): string {
  if (ms === undefined || Number.isNaN(ms)) return "n/a";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function clampDuration(start?: number, end?: number): number | undefined {
  if (start === undefined || end === undefined) return undefined;
  return Math.max(0, end - start);
}

function truncate(text: string, maxLength: number = 180): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function safeJson(value: unknown, maxLength?: number): string {
  try {
    const serialized = JSON.stringify(value);
    const normalized = serialized === undefined ? String(value) : serialized;
    return typeof maxLength === "number"
      ? truncate(normalized, maxLength)
      : normalized;
  } catch {
    return truncate(String(value), maxLength ?? 180);
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

class StartupDiagnostics {
  private sessionCounter = 0;
  private operationCounter = 0;
  private session: StartupSession | null = null;
  private latestSummary: string | null = null;

  startSession(
    context: Record<string, unknown> = {},
    options: { suppressPerCallApiLogs?: boolean } = {}
  ): string | null {
    if (!__DEV__) return null;

    this.sessionCounter += 1;
    this.operationCounter = 0;
    this.latestSummary = null;

    this.session = {
      sessionId: `startup_${this.sessionCounter}_${Date.now()}`,
      startedAt: Date.now(),
      context,
      suppressPerCallApiLogs: options.suppressPerCallApiLogs ?? true,
      summaryPrinted: false,
      operations: [],
      events: [],
      apiCalls: [],
      dashboardStages: [],
    };

    this.markEvent("startup.session.started", context);
    return this.session.sessionId;
  }

  isActive(): boolean {
    return Boolean(this.session && !this.session.summaryPrinted);
  }

  shouldSuppressApiCallLogs(): boolean {
    return Boolean(
      this.session &&
        !this.session.summaryPrinted &&
        this.session.suppressPerCallApiLogs
    );
  }

  updateContext(details: Record<string, unknown>) {
    if (!this.session || this.session.summaryPrinted) return;
    this.session.context = {
      ...this.session.context,
      ...details,
    };
  }

  markEvent(name: string, details?: Record<string, unknown>) {
    if (!this.session || this.session.summaryPrinted) return;
    this.session.events.push({
      name,
      at: Date.now(),
      details,
    });
  }

  beginOperation(
    name: string,
    options: { phase?: OperationPhase; details?: Record<string, unknown> } = {}
  ): number | null {
    if (!this.session || this.session.summaryPrinted) return null;

    this.operationCounter += 1;
    const operationId = this.operationCounter;

    this.session.operations.push({
      id: operationId,
      name,
      phase: options.phase ?? "general",
      startedAt: Date.now(),
      details: options.details,
    });

    return operationId;
  }

  endOperation(operationId: number | null, options: EndOperationOptions = {}) {
    if (!this.session || this.session.summaryPrinted || operationId === null) return;

    const operation = this.session.operations.find((entry) => entry.id === operationId);
    if (!operation || operation.endedAt !== undefined) return;

    const endedAt = Date.now();
    operation.endedAt = endedAt;
    operation.duration = Math.max(0, endedAt - operation.startedAt);
    operation.status = options.status ?? "ok";

    if (options.details) {
      operation.details = {
        ...(operation.details ?? {}),
        ...options.details,
      };
    }

    if (options.error !== undefined) {
      operation.error = toErrorMessage(options.error);
    }
  }

  recordApiCall(call: StartupApiCall) {
    if (!this.session || this.session.summaryPrinted) return;
    this.session.apiCalls.push(call);
  }

  markLoaderDismissRequested(
    reason: string,
    details?: Record<string, unknown>
  ) {
    if (!this.session || this.session.summaryPrinted) return;

    if (this.session.loaderDismissRequestedAt === undefined) {
      this.session.loaderDismissRequestedAt = Date.now();
    }
    this.markEvent("loader.dismiss.requested", {
      reason,
      ...(details ?? {}),
    });
  }

  markLoaderDismissed(reason: string = "animation_complete") {
    if (!this.session || this.session.summaryPrinted) return;

    if (this.session.loaderDismissedAt === undefined) {
      this.session.loaderDismissedAt = Date.now();
    }
    this.markEvent("loader.dismiss.completed", { reason });
    this.tryPrintSummary();
  }

  markDashboardFetchStarted(details?: Record<string, unknown>) {
    if (!this.session || this.session.summaryPrinted) return;

    if (this.session.dashboardFetchStartedAt === undefined) {
      this.session.dashboardFetchStartedAt = Date.now();
      this.markEvent("dashboard.fetch.started", details);
    }
  }

  markDashboardFetchCompleted(options: EndOperationOptions = {}) {
    if (!this.session || this.session.summaryPrinted) return;

    if (this.session.dashboardFetchStartedAt === undefined) {
      this.session.dashboardFetchStartedAt = Date.now();
    }

    if (this.session.dashboardFetchCompletedAt === undefined) {
      this.session.dashboardFetchCompletedAt = Date.now();
      this.session.dashboardFetchStatus = options.status ?? "ok";
      if (options.error !== undefined) {
        this.session.dashboardFetchError = toErrorMessage(options.error);
      }
      this.markEvent("dashboard.fetch.completed", options.details);
    }

    this.closeCurrentDashboardStage();
    this.tryPrintSummary();
  }

  markDashboardStage(stage: string) {
    if (!this.session || this.session.summaryPrinted) return;

    const now = Date.now();
    const currentStage =
      this.session.dashboardStages[this.session.dashboardStages.length - 1];

    if (currentStage && currentStage.stage === stage && currentStage.endedAt === undefined) {
      return;
    }

    this.closeCurrentDashboardStage(now);

    if (stage !== "IDLE") {
      this.session.dashboardStages.push({
        stage,
        startedAt: now,
      });
    }
  }

  clear() {
    this.session = null;
    this.latestSummary = null;
    this.operationCounter = 0;
  }

  printLatestSummary() {
    if (this.latestSummary) {
      console.log(this.latestSummary);
    } else if (this.session) {
      console.log(this.buildSummary(this.session));
    } else {
      console.log("[Startup Diagnostics] No session captured yet.");
    }
  }

  private closeCurrentDashboardStage(endedAt: number = Date.now()) {
    if (!this.session) return;

    const currentStage =
      this.session.dashboardStages[this.session.dashboardStages.length - 1];
    if (!currentStage || currentStage.endedAt !== undefined) return;

    currentStage.endedAt = endedAt;
    currentStage.duration = Math.max(0, endedAt - currentStage.startedAt);
  }

  private tryPrintSummary() {
    if (!this.session || this.session.summaryPrinted) return;
    if (this.session.loaderDismissedAt === undefined) return;
    if (this.session.dashboardFetchCompletedAt === undefined) return;

    const summary = this.buildSummary(this.session);
    this.latestSummary = summary;
    this.session.summaryPrinted = true;
    console.log(summary);
  }

  private buildSummary(session: StartupSession): string {
    const loaderRequestedMs = session.loaderDismissRequestedAt;
    const loaderDismissedMs = session.loaderDismissedAt;
    const dashboardDoneMs = session.dashboardFetchCompletedAt;

    const totalStartupDuration = clampDuration(session.startedAt, dashboardDoneMs);
    const loaderTotalDuration = clampDuration(session.startedAt, loaderDismissedMs);
    const loaderToRequestDuration = clampDuration(session.startedAt, loaderRequestedMs);
    const loaderDismissAnimationDuration = clampDuration(loaderRequestedMs, loaderDismissedMs);
    const postLoaderDuration = clampDuration(loaderDismissedMs, dashboardDoneMs);

    const completedOperations = [...session.operations].sort(
      (a, b) => a.startedAt - b.startedAt
    );
    const sortedApiCalls = [...session.apiCalls].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    const apiCalls = sortedApiCalls.filter((call) => !call.error && !call.cacheHit);
    const cachedCalls = sortedApiCalls.filter((call) => call.cacheHit);
    const failedCalls = sortedApiCalls.filter((call) => Boolean(call.error));
    const averageApiDuration =
      sortedApiCalls.length > 0
        ? Math.round(
            sortedApiCalls.reduce((sum, call) => sum + call.duration, 0) /
              sortedApiCalls.length
          )
        : 0;

    const endpointStats = sortedApiCalls.reduce<
      Record<
        string,
        { total: number; network: number; cached: number; errors: number; totalDuration: number }
      >
    >((acc, call) => {
      const existing = acc[call.endpoint] ?? {
        total: 0,
        network: 0,
        cached: 0,
        errors: 0,
        totalDuration: 0,
      };

      existing.total += 1;
      existing.totalDuration += call.duration;
      if (call.cacheHit) {
        existing.cached += 1;
      } else if (call.error) {
        existing.errors += 1;
      } else {
        existing.network += 1;
      }

      acc[call.endpoint] = existing;
      return acc;
    }, {});

    const duplicateNetworkCalls = sortedApiCalls
      .filter((call) => !call.cacheHit)
      .reduce<Map<string, { endpoint: string; params: string; count: number }>>((acc, call) => {
        const params = call.params ? safeJson(call.params, 140) : "{}";
        const key = `${call.endpoint}|${params}`;
        const existing = acc.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          acc.set(key, {
            endpoint: call.endpoint,
            params,
            count: 1,
          });
        }
        return acc;
      }, new Map());

    const duplicateEntries = [...duplicateNetworkCalls.values()]
      .filter((entry) => entry.count > 1)
      .sort((a, b) => b.count - a.count);

    const lines: string[] = [];
    lines.push("[Startup Diagnostics] App Open Summary");
    lines.push(
      `Session: ${session.sessionId} | Started: ${new Date(session.startedAt).toISOString()}`
    );
    lines.push(`Context: ${safeJson(session.context, 260)}`);
    lines.push(
      `Durations: total=${formatDuration(totalStartupDuration)} | loader_total=${formatDuration(
        loaderTotalDuration
      )} | loader_to_dismiss_request=${formatDuration(
        loaderToRequestDuration
      )} | loader_dismiss_animation=${formatDuration(
        loaderDismissAnimationDuration
      )} | post_loader=${formatDuration(postLoaderDuration)}`
    );
    lines.push(
      `Dashboard fetch: status=${session.dashboardFetchStatus ?? "unknown"}${
        session.dashboardFetchError
          ? ` error="${truncate(session.dashboardFetchError, 160)}"`
          : ""
      }`
    );

    lines.push("Operations:");
    if (completedOperations.length === 0) {
      lines.push("- none");
    } else {
      completedOperations.forEach((operation) => {
        const offset = operation.startedAt - session.startedAt;
        const status = operation.status ?? "ok";
        const detailSegment =
          operation.details && Object.keys(operation.details).length > 0
            ? ` details=${safeJson(operation.details, 200)}`
            : "";
        const errorSegment = operation.error
          ? ` error="${truncate(operation.error, 160)}"`
          : "";
        lines.push(
          `- +${formatDuration(offset)} [${operation.phase}] ${operation.name}: ${formatDuration(
            operation.duration
          )} (${status})${detailSegment}${errorSegment}`
        );
      });
    }

    lines.push("Dashboard stages:");
    if (session.dashboardStages.length === 0) {
      lines.push("- none");
    } else {
      session.dashboardStages.forEach((stage) => {
        const offset = stage.startedAt - session.startedAt;
        lines.push(
          `- +${formatDuration(offset)} ${stage.stage}: ${formatDuration(stage.duration)}`
        );
      });
    }

    lines.push("API calls:");
    lines.push(
      `- total=${sortedApiCalls.length} | network=${apiCalls.length} | cache=${cachedCalls.length} | errors=${failedCalls.length} | avg_duration=${formatDuration(
        averageApiDuration
      )}`
    );

    const endpointEntries = Object.entries(endpointStats).sort(
      (a, b) => b[1].total - a[1].total
    );
    if (endpointEntries.length === 0) {
      lines.push("- by_endpoint: none");
    } else {
      endpointEntries.forEach(([endpoint, stats]) => {
        const avg = Math.round(stats.totalDuration / stats.total);
        lines.push(
          `- by_endpoint ${endpoint}: total=${stats.total} network=${stats.network} cache=${stats.cached} errors=${stats.errors} avg=${formatDuration(
            avg
          )}`
        );
      });
    }

    if (sortedApiCalls.length > 0) {
      lines.push("API timeline:");
      sortedApiCalls.forEach((call) => {
        const offset = call.timestamp - session.startedAt;
        const status = call.error
          ? `error:${truncate(call.error, 120)}`
          : call.httpStatus !== undefined
          ? String(call.httpStatus)
          : call.cacheHit
          ? "cache"
          : "ok";
        const paramsSegment = call.params ? ` params=${safeJson(call.params, 120)}` : "";
        const rateLimitSegment =
          call.rateLimitRemaining !== undefined && call.rateLimitLimit !== undefined
            ? ` rate_limit=${call.rateLimitRemaining}/${call.rateLimitLimit}`
            : "";
        lines.push(
          `- +${formatDuration(offset)} ${call.cacheHit ? "CACHE" : "API"} ${
            call.endpoint
          } status=${status} duration=${formatDuration(call.duration)}${paramsSegment}${rateLimitSegment}`
        );
      });
    }

    lines.push("Potential duplicate network calls:");
    if (duplicateEntries.length === 0) {
      lines.push("- none detected");
    } else {
      duplicateEntries.forEach((entry) => {
        lines.push(
          `- ${entry.endpoint} repeated ${entry.count}x with params=${entry.params}`
        );
      });
    }

    return lines.join("\n");
  }
}

export const startupDiagnostics = new StartupDiagnostics();

if (typeof global !== "undefined") {
  (global as any).startupDiagnostics = startupDiagnostics;
  (global as any).showStartupSummary = () => startupDiagnostics.printLatestSummary();
}
