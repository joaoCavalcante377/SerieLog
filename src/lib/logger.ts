type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const SENSITIVE = /pass(word)?|token|secret|authorization|cookie|email/i;

function redact(fields: Fields): Fields {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, SENSITIVE.test(k) ? "[redacted]" : v]),
  );
}

function write(level: Level, message: string, fields: Fields = {}) {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    message,
    ...redact(fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: Fields) => write("debug", message, fields),
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};

export function newRequestId(): string {
  return crypto.randomUUID();
}
