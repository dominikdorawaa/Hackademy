import { pathToFileURL } from "node:url";
import {
  MIN_TLS_VERSION,
  PHASES,
  PREVIOUS_MIN_TLS_VERSION,
  REF_PREFIX,
  buildRulesets,
  emptyRulesets,
} from "./rules.mjs";

export const API_BASE = "https://api.cloudflare.com/client/v4";
export const REDACTED = "[redacted]";
const SECRET_PATTERN = /^[A-Za-z0-9_-]{32,}$/;
const FLAGS = ["--dry-run", "--apply", "--diff", "--remove-origin-header", "--rollback", "--force", "--help"];

export const USAGE = `Usage: node tools/cloudflare/apply.mjs [--dry-run | --apply] [--diff] [--remove-origin-header | --rollback] [--force]

  --dry-run               print the planned requests without changing anything (default)
  --apply                 send the planned requests to Cloudflare
  --diff                  also read the current rules from Cloudflare
  --remove-origin-header  plan only an empty transform phase
  --rollback              plan empty phases for all managed rules and TLS ${PREVIOUS_MIN_TLS_VERSION}
  --force                 replace rules that were not created by this script

Environment: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, ORIGIN_VERIFY_SECRET`;

export function parseArgs(argv) {
  const unknown = argv.filter((arg) => !FLAGS.includes(arg));
  if (unknown.length) throw new Error(`Unknown option: ${unknown.join(" ")}`);
  const has = (flag) => argv.includes(flag);
  if (has("--dry-run") && has("--apply")) throw new Error("Use either --dry-run or --apply");
  if (has("--remove-origin-header") && has("--rollback"))
    throw new Error("Use either --remove-origin-header or --rollback");
  return {
    apply: has("--apply"),
    diff: has("--diff"),
    force: has("--force"),
    help: has("--help"),
    target: has("--rollback") ? "rollback" : has("--remove-origin-header") ? "remove-origin-header" : "config",
  };
}

export function validateEnv(options, env) {
  const needsApi = options.apply || options.diff;
  const missing = [];
  if (needsApi && !env.CLOUDFLARE_API_TOKEN) missing.push("CLOUDFLARE_API_TOKEN");
  if (needsApi && !env.CLOUDFLARE_ZONE_ID) missing.push("CLOUDFLARE_ZONE_ID");
  if (options.apply && options.target === "config" && !env.ORIGIN_VERIFY_SECRET) missing.push("ORIGIN_VERIFY_SECRET");
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  if (env.ORIGIN_VERIFY_SECRET && !SECRET_PATTERN.test(env.ORIGIN_VERIFY_SECRET))
    throw new Error("ORIGIN_VERIFY_SECRET must have at least 32 characters from A-Z, a-z, 0-9, _ and -");
}

export function buildPlan(target, secret) {
  const rulesets =
    target === "config"
      ? buildRulesets(secret)
      : target === "rollback"
        ? emptyRulesets()
        : { http_request_late_transform: [] };
  const steps = Object.entries(rulesets).map(([phase, rules]) => ({
    method: "PUT",
    path: `/rulesets/phases/${phase}/entrypoint`,
    phase,
    body: { rules },
  }));
  if (target !== "remove-origin-header") {
    steps.push({
      method: "PATCH",
      path: "/settings/min_tls_version",
      body: { value: target === "rollback" ? PREVIOUS_MIN_TLS_VERSION : MIN_TLS_VERSION },
    });
  }
  return steps;
}

export function redact(value, secrets = []) {
  const scrubbed = JSON.parse(
    JSON.stringify(value, (key, item) => {
      if (key === "headers" && item && typeof item === "object") {
        return Object.fromEntries(
          Object.entries(item).map(([name, header]) => [
            name,
            header && typeof header === "object" && "value" in header ? { ...header, value: REDACTED } : header,
          ]),
        );
      }
      return item;
    }),
  );
  return scrub(JSON.stringify(scrubbed, null, 2), secrets);
}

export function scrub(text, secrets) {
  return secrets.filter(Boolean).reduce((result, secret) => result.split(secret).join(REDACTED), String(text));
}

function cloudflare(env, fetchImpl) {
  const base = `${API_BASE}/zones/${env.CLOUDFLARE_ZONE_ID}`;
  return async (method, path, body) => {
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    if (method === "GET" && response.status === 404) return null;
    if (!response.ok || json.success === false) {
      const errors = (json.errors ?? []).map((error) => `${error.code}: ${error.message}`).join("; ");
      throw new Error(`${method} ${path} failed with ${response.status}${errors ? ` (${errors})` : ""}`);
    }
    return json.result;
  };
}

function summarize(rules) {
  return rules.map(({ ref, description, expression, action, action_parameters, ratelimit }) => ({
    ref,
    description,
    expression,
    action,
    action_parameters,
    ratelimit,
  }));
}

export async function main({ argv, env, fetch: fetchImpl = globalThis.fetch, stdout, stderr }) {
  const secrets = [env.ORIGIN_VERIFY_SECRET, env.CLOUDFLARE_API_TOKEN];
  const out = (line) => stdout.write(`${scrub(line, secrets)}\n`);
  try {
    const options = parseArgs(argv);
    if (options.help) {
      out(USAGE);
      return 0;
    }
    validateEnv(options, env);
    const plan = buildPlan(options.target, env.ORIGIN_VERIFY_SECRET ?? REDACTED);
    const request = options.apply || options.diff ? cloudflare(env, fetchImpl) : null;
    const foreign = [];
    if (options.target !== "config")
      out("Remove ORIGIN_GUARD_SECRETS on Heroku before removing the origin header, or the API will answer 403.");

    if (request) {
      for (const step of plan.filter((item) => item.phase)) {
        const current = await request("GET", step.path);
        const rules = current?.rules ?? [];
        if (options.diff) out(`Current ${step.phase}:\n${redact(summarize(rules), secrets)}`);
        const unknown = rules.filter((rule) => !rule.ref?.startsWith(REF_PREFIX));
        if (unknown.length) foreign.push(`${step.phase}: ${unknown.map((rule) => rule.description || rule.id).join(", ")}`);
      }
      if (options.diff) {
        const tls = await request("GET", "/settings/min_tls_version");
        out(`Current min_tls_version: ${tls?.value}`);
      }
    }

    if (foreign.length) {
      const message = `Rules not managed by this script would be replaced:\n  ${foreign.join("\n  ")}`;
      if (options.apply && !options.force) throw new Error(`${message}\nMove them into tools/cloudflare/rules.mjs or rerun with --force`);
      out(message);
    }

    for (const step of plan) {
      out(`${options.apply ? "Applying" : "Planned"}: ${step.method} /zones/{zone_id}${step.path}`);
      if (!options.apply) out(redact(step.body, secrets));
      if (options.apply) await request(step.method, step.path, step.body);
    }

    if (options.apply) out("Done.");
    else out("Dry run only. Nothing was changed. Add --apply to send these requests.");
    return 0;
  } catch (error) {
    stderr.write(`${scrub(error.message, secrets)}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main({
    argv: process.argv.slice(2),
    env: process.env,
    stdout: process.stdout,
    stderr: process.stderr,
  });
}
