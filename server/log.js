import { randomUUID } from "node:crypto";

export const log = (level, message, extra = {}) =>
  console[level === "error" ? "error" : "log"](JSON.stringify({ time: new Date().toISOString(), level, message, ...extra }));

// One JSON line per API request. Never logs headers, bodies or query values.
export function requestLogger({ write = log, only = (req) => req.path.startsWith("/api") } = {}) {
  return (req, res, next) => {
    req.id = randomUUID();
    res.setHeader("X-Request-Id", req.id);
    if (!only(req)) return next();
    const start = process.hrtime.bigint();
    res.on("finish", () => write("info", "request", {
      requestId: req.id, method: req.method, path: req.path, status: res.statusCode,
      ms: Math.round(Number(process.hrtime.bigint() - start) / 1e6), userId: req.user?.id,
    }));
    next();
  };
}
