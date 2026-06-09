import AsyncStorage from '@react-native-async-storage/async-storage';

// Only enable performance logging in development
const IS_DEV = __DEV__;

export interface PerformanceLog {
  id: string;
  timestamp: number;
  operation: string;
  duration: number;
  context?: string;
  details?: any;
  success: boolean;
}

export interface PerformanceSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  logs: PerformanceLog[];
}

const PERFORMANCE_LOGS_KEY = 'wanikani_performance_logs';
const MAX_SESSIONS = 50; // Keep last 50 sessions
const MAX_LOGS_PER_SESSION = 100; // Keep last 100 logs per session

let currentSession: PerformanceSession | null = null;
let sessionCounter = 0;

export class PerformanceTimer {
  private startTime: number;
  private operation: string;
  private context?: string;

  constructor(operation: string, context?: string) {
    this.operation = operation;
    this.context = context;
    this.startTime = IS_DEV ? performance.now() : 0;
  }

  end(details?: any, success: boolean = true): number {
    if (!IS_DEV) {
      return 0; // Return 0 duration in production
    }

    const duration = performance.now() - this.startTime;
    
    const log: PerformanceLog = {
      id: `${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      operation: this.operation,
      duration,
      context: this.context,
      details,
      success
    };

    addLogToSession(log);

    return duration;
  }
}

export function startPerformanceTimer(operation: string, context?: string): PerformanceTimer {
  return new PerformanceTimer(operation, context);
}

export function startSession(sessionName: string = 'Homepage Refresh'): string {
  if (!IS_DEV) {
    return ''; // Return empty string in production
  }

  sessionCounter++;
  const sessionId = `session_${sessionCounter}_${Date.now()}`;
  
  currentSession = {
    sessionId,
    startTime: Date.now(),
    logs: []
  };

  return sessionId;
}

export function endSession(): PerformanceSession | null {
  if (!IS_DEV || !currentSession) return null;

  currentSession.endTime = Date.now();
  currentSession.totalDuration = currentSession.endTime - currentSession.startTime;

  // Save session to storage
  saveSessionToStorage(currentSession);
  
  const completedSession = currentSession;
  currentSession = null;
  
  return completedSession;
}

function addLogToSession(log: PerformanceLog): void {
  if (!IS_DEV || !currentSession) return;
  
  currentSession.logs.push(log);
  
  // Limit logs per session
  if (currentSession.logs.length > MAX_LOGS_PER_SESSION) {
    currentSession.logs = currentSession.logs.slice(-MAX_LOGS_PER_SESSION);
  }
}

async function saveSessionToStorage(session: PerformanceSession): Promise<void> {
  if (!IS_DEV) return;
  
  try {
    const existingData = await AsyncStorage.getItem(PERFORMANCE_LOGS_KEY);
    const sessions: PerformanceSession[] = existingData ? JSON.parse(existingData) : [];
    
    sessions.push(session);
    
    // Keep only the last MAX_SESSIONS
    if (sessions.length > MAX_SESSIONS) {
      sessions.splice(0, sessions.length - MAX_SESSIONS);
    }
    
    await AsyncStorage.setItem(PERFORMANCE_LOGS_KEY, JSON.stringify(sessions));
  } catch {
    // Silent failure for performance logging
  }
}

export async function getAllSessions(): Promise<PerformanceSession[]> {
  if (!IS_DEV) return [];
  
  try {
    const data = await AsyncStorage.getItem(PERFORMANCE_LOGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function getLatestSession(): Promise<PerformanceSession | null> {
  if (!IS_DEV) return null;
  
  const sessions = await getAllSessions();
  return sessions.length > 0 ? sessions[sessions.length - 1] : null;
}

export async function clearPerformanceLogs(): Promise<void> {
  if (!IS_DEV) return;

  try {
    await AsyncStorage.removeItem(PERFORMANCE_LOGS_KEY);
  } catch {
    // Silent failure
  }
}

export function getCurrentSession(): PerformanceSession | null {
  if (!IS_DEV) return null;
  return currentSession;
}

// Helper function to analyze session performance
export function analyzeSession(session: PerformanceSession): {
  totalTime: number;
  apiCalls: PerformanceLog[];
  cacheOperations: PerformanceLog[];
  slowestOperations: PerformanceLog[];
  failedOperations: PerformanceLog[];
} {
  const apiCalls = session.logs.filter(log => 
    log.operation.includes('API') || 
    log.operation.includes('fetch') ||
    log.operation.includes('get') && log.context?.includes('api')
  );
  
  const cacheOperations = session.logs.filter(log => 
    log.operation.includes('cache') || 
    log.operation.includes('Cache') ||
    log.context?.includes('cache')
  );
  
  const slowestOperations = [...session.logs]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);
  
  const failedOperations = session.logs.filter(log => !log.success);
  
  return {
    totalTime: session.totalDuration || 0,
    apiCalls,
    cacheOperations,
    slowestOperations,
    failedOperations
  };
}