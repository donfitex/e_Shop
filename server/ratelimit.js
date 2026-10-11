// Fixed-window in-memory limiter. Works for ONE server instance (fine for a single Render service);
// use a shared store such as Redis if you ever run several instances.
export function createLimiter({ windowMs, max, key = (req) => req.ip, now = Date.now }) {
  const hits = new Map();
  setInterval(() => { const t = now(); for (const [k, e] of hits) if (e.reset <= t) hits.delete(k); }, Math.max(windowMs, 1000)).unref();
  return function limiter(req, res, next) {
    const k = key(req), t = now();
    let e = hits.get(k);
    if (!e || e.reset <= t) { e = { count: 0, reset: t + windowMs }; hits.set(k, e); }
    e.count++;
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - e.count)));
    if (e.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((e.reset - t) / 1000)));
      return res.status(429).json({ error: "Too many requests. Please wait a moment and try again.", code: "rate_limited" });
    }
    next();
  };
}
