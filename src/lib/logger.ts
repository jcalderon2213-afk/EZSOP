// Structured logging utility — environment-agnostic (browser + Node.js)

export interface LogEntry {
  level: string;
  event: string;
  timestamp: string;
  context: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

const LEVEL_VALUE: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
};

const LEVEL_METHOD: Record<LogLevel, "debug" | "info" | "warn" | "error"> = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  FATAL: "error",
};

function getEnvVar(name: string): string | undefined {
  // Try Vite's import.meta.env first (browser / Vite dev server)
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const val = import.meta.env[name];
      if (val !== undefined) return String(val);
    }
  } catch {
    // import.meta not available — skip
  }

  // Fall back to process.env (Node.js / SSR)
  try {
    if (typeof process !== "undefined" && process.env) {
      const val = process.env[name];
      if (val !== undefined) return String(val);
    }
  } catch {
    // process not available — skip
  }

  return undefined;
}

function isDevMode(): boolean {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      return !!import.meta.env.DEV;
    }
  } catch {
    // ignore
  }
  try {
    if (typeof process !== "undefined" && process.env) {
      return process.env.NODE_ENV !== "production";
    }
  } catch {
    // ignore
  }
  return true;
}

function resolveMinLevel(): LogLevel {
  const raw = getEnvVar("VITE_LOG_LEVEL")?.toUpperCase();
  if (raw && raw in LEVEL_VALUE) return raw as LogLevel;
  return isDevMode() ? "DEBUG" : "INFO";
}

export class Logger {
  private context: Record<string, unknown> = {};
  private minLevel: LogLevel;

  constructor(minLevel?: LogLevel) {
    this.minLevel = minLevel ?? resolveMinLevel();
  }

  setContext(ctx: Record<string, unknown>): void {
    Object.assign(this.context, ctx);
  }

  clearContext(): void {
    this.context = {};
  }

  debug(event: string, metadata?: Record<string, unknown>): void {
    this.log("DEBUG", event, metadata);
  }

  info(event: string, metadata?: Record<string, unknown>): void {
    this.log("INFO", event, metadata);
  }

  warn(event: string, metadata?: Record<string, unknown>): void {
    this.log("WARN", event, metadata);
  }

  error(event: string, metadata?: Record<string, unknown>): void {
    this.log("ERROR", event, metadata);
  }

  fatal(event: string, metadata?: Record<string, unknown>): void {
    this.log("FATAL", event, metadata);
  }

  private log(level: LogLevel, event: string, metadata?: Record<string, unknown>): void {
    if (LEVEL_VALUE[level] < LEVEL_VALUE[this.minLevel]) return;

    const entry: LogEntry = {
      level,
      event,
      timestamp: new Date().toISOString(),
      context: { ...this.context },
      ...(metadata !== undefined && { metadata }),
    };

    console[LEVEL_METHOD[level]](JSON.stringify(entry));
  }
}

const logger = new Logger();

export default logger;
