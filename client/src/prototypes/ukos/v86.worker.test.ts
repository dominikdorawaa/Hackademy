import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { RuntimeEnvironment } from "./runtime";
import type { RuntimeCommand } from "./protocol";

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  environment: null as RuntimeEnvironment | null,
  create: vi.fn(),
}));
vi.mock("./runtime", () => ({
  UkosRuntime: class {
    constructor(environment: RuntimeEnvironment) {
      mocks.environment = environment;
    }
    handle = mocks.handle;
  },
}));
vi.mock("v86", () => ({
  V86: class {
    constructor(options: unknown) {
      mocks.create(options);
    }
  },
}));
vi.mock("./storage", () => ({
  workshopStorage: { load: vi.fn(), save: vi.fn(), clear: vi.fn() },
}));

const start: RuntimeCommand = {
  type: "start",
  baseUrl: "local",
  account: "alice",
  cols: 80,
  rows: 24,
};
const dispatch = async (data: RuntimeCommand) => {
  await (
    globalThis.onmessage as unknown as (message: {
      data: RuntimeCommand;
    }) => Promise<void>
  )({ data });
};

beforeEach(() => {
  vi.resetModules();
  mocks.handle.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("postMessage", vi.fn());
  vi.stubGlobal("onmessage", null);
});
afterEach(() => vi.restoreAllMocks());

it("requires a tab lock, rejects a second owner and ignores input before startup", async () => {
  vi.stubGlobal("navigator", { locks: undefined });
  await import("./v86.worker");
  await dispatch({ type: "input", data: "pwd" });
  expect(mocks.handle).not.toHaveBeenCalled();
  await dispatch(start);
  expect(postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ type: "status", status: "error" }),
  );
  vi.stubGlobal("navigator", {
    locks: {
      request: vi.fn(async (_name, _options, callback) => {
        await callback(null);
      }),
    },
  });
  await dispatch(start);
  expect(postMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.stringContaining("innej karcie"),
    }),
  );
});

it("owns one emulator and checks runtime asset responses", async () => {
  vi.stubGlobal("navigator", {
    locks: {
      request: vi.fn(async (_name, _options, callback) => {
        void callback({ name: "lock" });
      }),
    },
  });
  await import("./v86.worker");
  await dispatch(start);
  await dispatch({ type: "input", data: "pwd" });
  await dispatch(start);
  expect(mocks.handle).toHaveBeenCalledTimes(2);
  const environment = mocks.environment!;
  environment.create({ memory_size: 100 });
  expect(mocks.create).toHaveBeenCalledWith({ memory_size: 100 });
  environment.emit({ type: "progress", step: 1 });
  expect(postMessage).toHaveBeenCalledWith({ type: "progress", step: 1 });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  await expect(environment.manifest("local")).rejects.toThrow("ukos:prepare");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ version: "abcdef0123456789" }) }),
  );
  expect(await environment.manifest("https://academy.test/prototypes/runtime")).toEqual({ version: "abcdef0123456789", assetBase: "https://academy.test/static/ukos/abcdef0123456789" });
});
