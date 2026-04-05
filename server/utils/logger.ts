import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
    : undefined,
  base: { service: "nestquest-api" },
  redact: ["req.headers.authorization", "req.headers.cookie", "body.password", "body.passwordHash"],
});

export default logger;
