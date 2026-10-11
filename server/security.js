export function buildCsp(supabaseUrl) {
  const sb = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const ws = sb.replace(/^http/, "ws");
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${sb}`.trim(),
    `connect-src 'self' ${sb} ${ws}`.trim(),
  ].join("; ");
}

// CSP starts in report-only mode: violations show in the browser console but nothing breaks.
export function securityHeaders({ production = false, supabaseUrl = "", enforceCsp = false } = {}) {
  const csp = buildCsp(supabaseUrl);
  return (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader(enforceCsp ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", csp);
    if (production) res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    next();
  };
}

// The web app is same-origin, so no CORS headers by default. List extra origins in CORS_ORIGINS (comma separated).
export function corsMiddleware(list = "") {
  const allowed = new Set(String(list).split(",").map((s) => s.trim()).filter(Boolean));
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowed.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
      res.setHeader("Access-Control-Max-Age", "600");
      if (req.method === "OPTIONS") return res.status(204).end();
    }
    next();
  };
}
