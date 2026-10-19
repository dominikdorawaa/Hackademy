export const API_HOST = "api.hackademy.app";
export const APP_HOST = "hackademy.app";
export const ORIGIN_HEADER = "X-Origin-Verify";
export const REF_PREFIX = "hackademy_";
export const MIN_TLS_VERSION = "1.2";
export const PREVIOUS_MIN_TLS_VERSION = "1.0";
export const PHASES = [
  "http_request_late_transform",
  "http_request_cache_settings",
  "http_config_settings",
  "http_ratelimit",
];
export const RATE_LIMITED_PATHS = [
  "/api/rooms/*/solve",
  "/api/rooms/*/hints/*/unlock",
  "/api/friends/request/*",
  "/api/arena/challenge/create",
];
export const RATE_LIMIT = {
  characteristics: ["cf.colo.id", "ip.src"],
  period: 10,
  requests_per_period: 60,
  mitigation_timeout: 10,
};

const apiHost = `(http.host eq "${API_HOST}")`;
const appHost = `(http.host eq "${APP_HOST}")`;

export const rateLimitExpression = RATE_LIMITED_PATHS.map((path) =>
  path.includes("*")
    ? `(http.request.uri.path wildcard "${path}")`
    : `(http.request.uri.path eq "${path}")`,
).join(" or ");

export function matchesRateLimit(path) {
  return RATE_LIMITED_PATHS.some((pattern) => {
    const source = pattern
      .split("*")
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${source}$`, "i").test(path);
  });
}

export function buildRulesets(secret) {
  return {
    http_request_late_transform: [
      {
        ref: `${REF_PREFIX}origin_verify`,
        description: "Send the origin verification header to the API",
        expression: apiHost,
        action: "rewrite",
        action_parameters: {
          headers: { [ORIGIN_HEADER]: { operation: "set", value: secret } },
        },
        enabled: true,
      },
    ],
    http_request_cache_settings: [
      {
        ref: `${REF_PREFIX}api_no_cache`,
        description: "Never cache API responses",
        expression: apiHost,
        action: "set_cache_settings",
        action_parameters: { cache: false },
        enabled: true,
      },
      {
        ref: `${REF_PREFIX}app_browser_ttl`,
        description: "Let Pages headers decide the browser cache",
        expression: appHost,
        action: "set_cache_settings",
        action_parameters: { browser_ttl: { mode: "respect_origin" } },
        enabled: true,
      },
    ],
    http_config_settings: [
      {
        ref: `${REF_PREFIX}api_no_challenge`,
        description: "No interactive challenges for API and WebSocket traffic",
        expression: apiHost,
        action: "set_config",
        action_parameters: { security_level: "essentially_off", bic: false },
        enabled: true,
      },
    ],
    http_ratelimit: [
      {
        ref: `${REF_PREFIX}api_write_limit`,
        description: "Limit flag, hint, friend and challenge requests per IP",
        expression: rateLimitExpression,
        action: "block",
        ratelimit: { ...RATE_LIMIT },
        enabled: true,
      },
    ],
  };
}

export function emptyRulesets() {
  return Object.fromEntries(PHASES.map((phase) => [phase, []]));
}
