import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { API_BASE, REDACTED, buildPlan, main, parseArgs, redact, validateEnv } from "./apply.mjs";
import {
  PHASES,
  RATE_LIMIT,
  buildRulesets,
  matchesRateLimit,
  rateLimitExpression,
} from "./rules.mjs";

const secret = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const token = "fake-token-for-tests-only";
const env = { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ZONE_ID: "zone123", ORIGIN_VERIFY_SECRET: secret };

function sink() {
  const chunks = [];
  return { write: (chunk) => chunks.push(chunk), text: () => chunks.join("") };
}

function fakeCloudflare(state = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body && JSON.parse(init.body), auth: init.headers.Authorization });
    const path = url.slice(`${API_BASE}/zones/zone123`.length);
    if (state.fail && init.method !== "GET")
      return { ok: false, status: 400, json: async () => ({ success: false, errors: [{ code: 1, message: `bad ${secret}` }] }) };
    if (init.method === "GET" && path.startsWith("/rulesets")) {
      const phase = path.split("/")[3];
      if (!state[phase]) return { ok: false, status: 404, json: async () => ({ success: false }) };
      return { ok: true, status: 200, json: async () => ({ success: true, result: { rules: state[phase] } }) };
    }
    if (init.method === "GET") return { ok: true, status: 200, json: async () => ({ success: true, result: { value: "1.0" } }) };
    return { ok: true, status: 200, json: async () => ({ success: true, result: {} }) };
  };
  return { fetch, calls };
}

async function run(argv, overrides = {}) {
  const stdout = sink();
  const stderr = sink();
  const code = await main({ argv, env: overrides.env ?? env, fetch: overrides.fetch, stdout, stderr });
  return { code, stdout: stdout.text(), stderr: stderr.text() };
}

test("builds one rule per owned phase and leaves redirects alone", () => {
  const rulesets = buildRulesets(secret);
  assert.deepEqual(Object.keys(rulesets), PHASES);
  assert.ok(!PHASES.includes("http_request_dynamic_redirect"));
  const [transform] = rulesets.http_request_late_transform;
  assert.equal(transform.expression, '(http.host eq "api.hackademy.app")');
  assert.deepEqual(transform.action_parameters.headers, { "X-Origin-Verify": { operation: "set", value: secret } });
  assert.deepEqual(rulesets.http_request_cache_settings[0].action_parameters, { cache: false });
  assert.deepEqual(rulesets.http_config_settings[0].action_parameters, { security_level: "essentially_off", bic: false });
  assert.equal(rulesets.http_ratelimit.length, 1);
  for (const rules of Object.values(rulesets)) for (const rule of rules) assert.match(rule.ref, /^hackademy_/);
});

test("rate limit fits the Free plan", () => {
  const [rule] = buildRulesets(secret).http_ratelimit;
  assert.equal(rule.action, "block");
  assert.deepEqual(rule.ratelimit.characteristics, ["cf.colo.id", "ip.src"]);
  assert.equal(rule.ratelimit.period, 10);
  assert.equal(rule.ratelimit.mitigation_timeout, 10);
  assert.deepEqual(rule.ratelimit, { ...RATE_LIMIT, requests_per_period: 60 });
  const fields = rateLimitExpression.match(/[a-z_]+(\.[a-z_]+)+/g);
  assert.deepEqual([...new Set(fields)], ["http.request.uri.path"]);
  assert.doesNotMatch(rateLimitExpression, /\bmatches\b|http\.host|http\.request\.method/);
});

test("rate limit covers sensitive writes but not realtime or reads", () => {
  for (const path of [
    "/api/rooms/7/solve",
    "/api/rooms/7/tasks/3/solve",
    "/api/rooms/7/hints/2/unlock",
    "/api/friends/request/alice",
    "/api/arena/challenge/create",
  ])
    assert.ok(matchesRateLimit(path), path);
  for (const path of [
    "/ws",
    "/ws/info",
    "/ws/123/abcdef/websocket",
    "/ws/123/abcdef/xhr_streaming",
    "/api/arena/game/5/answer",
    "/api/arena/game/5/reaction",
    "/api/arena/challenges",
    "/api/rooms",
    "/api/rooms/7",
    "/api/rooms/7/file",
    "/api/friends/requests",
    "/api/friends/status/alice",
    "/health",
    "/",
  ])
    assert.ok(!matchesRateLimit(path), path);
  assert.doesNotMatch(rateLimitExpression, /\/ws/);
});

test("parses and validates arguments", () => {
  assert.deepEqual(parseArgs([]), { apply: false, diff: false, force: false, help: false, target: "config" });
  assert.equal(parseArgs(["--rollback"]).target, "rollback");
  assert.equal(parseArgs(["--remove-origin-header", "--apply"]).target, "remove-origin-header");
  assert.throws(() => parseArgs(["--nope"]), /Unknown option: --nope/);
  assert.throws(() => parseArgs(["--dry-run", "--apply"]), /either --dry-run or --apply/);
  assert.throws(() => parseArgs(["--rollback", "--remove-origin-header"]), /either --remove-origin-header/);
});

test("requires credentials only when talking to Cloudflare", () => {
  assert.doesNotThrow(() => validateEnv(parseArgs([]), {}));
  assert.throws(
    () => validateEnv(parseArgs(["--apply"]), {}),
    /CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, ORIGIN_VERIFY_SECRET/,
  );
  assert.doesNotThrow(() => validateEnv(parseArgs(["--rollback", "--apply"]), { ...env, ORIGIN_VERIFY_SECRET: "" }));
  assert.throws(() => validateEnv(parseArgs(["--diff"]), {}), /CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID$/);
  assert.throws(() => validateEnv(parseArgs([]), { ORIGIN_VERIFY_SECRET: "short" }), /at least 32/);
  assert.throws(() => validateEnv(parseArgs([]), { ORIGIN_VERIFY_SECRET: `${secret},other` }), /at least 32/);
});

test("plans rollback and header removal", () => {
  const rollback = buildPlan("rollback");
  assert.deepEqual(rollback.map((step) => step.body), [...PHASES.map(() => ({ rules: [] })), { value: "1.0" }]);
  const removal = buildPlan("remove-origin-header");
  assert.deepEqual(removal, [
    { method: "PUT", path: "/rulesets/phases/http_request_late_transform/entrypoint", phase: "http_request_late_transform", body: { rules: [] } },
  ]);
  assert.deepEqual(buildPlan("config", secret).at(-1), { method: "PATCH", path: "/settings/min_tls_version", body: { value: "1.2" } });
});

test("redacts header values and known secrets", () => {
  const text = redact({ headers: { "X-Origin-Verify": { operation: "set", value: secret }, Other: "kept" }, note: `x${secret}` }, [secret]);
  assert.ok(!text.includes(secret));
  assert.ok(text.includes(REDACTED));
  assert.ok(text.includes('"Other": "kept"'));
});

test("dry run prints redacted payloads without network access", async () => {
  const result = await run([], { fetch: () => assert.fail("no network in dry run") });
  assert.equal(result.code, 0);
  assert.ok(!result.stdout.includes(secret));
  assert.ok(result.stdout.includes(`"value": "${REDACTED}"`));
  assert.match(result.stdout, /Dry run only/);
  assert.match(result.stdout, /PATCH \/zones\/\{zone_id\}\/settings\/min_tls_version/);
});

test("dry run works without any secret", async () => {
  const result = await run(["--dry-run"], { env: {} });
  assert.equal(result.code, 0);
  assert.ok(result.stdout.includes(REDACTED));
});

test("help and invalid input", async () => {
  assert.match((await run(["--help"])).stdout, /Usage:/);
  const bad = await run(["--apply"], { env: {} });
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /Missing environment variables/);
});

test("diff reads the current state and hides the live secret", async () => {
  const cloudflare = fakeCloudflare({
    http_request_late_transform: [
      { ref: "hackademy_origin_verify", action: "rewrite", action_parameters: { headers: { "X-Origin-Verify": { operation: "set", value: secret } } } },
    ],
  });
  const result = await run(["--diff"], cloudflare);
  assert.equal(result.code, 0);
  assert.ok(!result.stdout.includes(secret));
  assert.match(result.stdout, /Current min_tls_version: 1.0/);
  assert.ok(cloudflare.calls.every((call) => call.method === "GET"));
  assert.equal(cloudflare.calls[0].auth, `Bearer ${token}`);
});

test("apply sends every planned request and never prints secrets", async () => {
  const cloudflare = fakeCloudflare();
  const result = await run(["--apply"], cloudflare);
  assert.equal(result.code, 0, result.stderr);
  const writes = cloudflare.calls.filter((call) => call.method !== "GET");
  assert.deepEqual(writes.map((call) => call.url.replace(`${API_BASE}/zones/zone123`, "")), [
    ...PHASES.map((phase) => `/rulesets/phases/${phase}/entrypoint`),
    "/settings/min_tls_version",
  ]);
  assert.equal(writes[0].body.rules[0].action_parameters.headers["X-Origin-Verify"].value, secret);
  assert.ok(!(result.stdout + result.stderr).includes(secret));
  assert.ok(!(result.stdout + result.stderr).includes(token));
  assert.match(result.stdout, /Done\./);
});

test("apply refuses to replace foreign rules unless forced", async () => {
  const state = { http_ratelimit: [{ id: "abc", description: "Dashboard rule" }] };
  const refused = await run(["--apply"], fakeCloudflare(state));
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /http_ratelimit: Dashboard rule/);
  const forced = fakeCloudflare(state);
  const result = await run(["--apply", "--force"], forced);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /would be replaced/);
});

test("rollback warns about the backend guard first", async () => {
  const cloudflare = fakeCloudflare();
  const result = await run(["--rollback", "--apply"], cloudflare);
  assert.equal(result.code, 0);
  assert.ok(result.stdout.indexOf("ORIGIN_GUARD_SECRETS") < result.stdout.indexOf("Applying"));
});

test("api errors are reported without secrets", async () => {
  const result = await run(["--apply"], fakeCloudflare({ fail: true }));
  assert.equal(result.code, 1);
  assert.match(result.stderr, /PUT \/rulesets\/phases\/http_request_late_transform\/entrypoint failed with 400 \(1: bad \[redacted\]\)/);
  assert.ok(!result.stderr.includes(secret));
});

test("runs as a command line script", () => {
  const script = fileURLToPath(new URL("./apply.mjs", import.meta.url));
  const output = execFileSync(process.execPath, [script], {
    env: { PATH: process.env.PATH, ORIGIN_VERIFY_SECRET: secret },
    encoding: "utf8",
  });
  assert.match(output, /Dry run only/);
  assert.ok(!output.includes(secret));
});
