import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { V86, V86Options } from "v86";
import { UkosRuntime, type RuntimeEnvironment } from "./runtime";
import type { RuntimeEvent, SavedWorkshop } from "./protocol";

const encode = (text: string) => btoa(text);
class Emulator {
  listeners = new Map<string, (value: number) => void>();
  controlMessages: string[] = [];
  inputs: Uint8Array[] = [];
  run = vi.fn(async () => {});
  stop = vi.fn(async () => {});
  destroy = vi.fn(async () => {});
  autoArchive = true;
  add_listener(name: string, listener: (value: number) => void) {
    this.listeners.set(name, listener);
  }
  serial_send_bytes(port: number, data: Uint8Array) {
    if (port === 0) {
      this.inputs.push(data);
      return;
    }
    const message = new TextDecoder().decode(data).trim();
    this.controlMessages.push(message);
    if (message.startsWith("EXPORT") && this.autoArchive)
      queueMicrotask(() =>
        this.control(`ARCHIVE\t${message.split("\t")[1]}\tYWJj`),
      );
  }
  line(port: number, line: string) {
    for (const byte of new TextEncoder().encode(line + "\n"))
      this.listeners.get(`serial${port}-output-byte`)?.(byte);
  }
  control(line: string) {
    this.line(1, line);
  }
  prompt(command = "", status = 0, kind = "builtin") {
    this.line(
      2,
      `PROMPT\t${status}\t${encode(command)}\t${encode("/home/student")}\t${kind}`,
    );
  }
}

function setup(saved: SavedWorkshop | null = null) {
  const events: RuntimeEvent[] = [];
  const emulators: Emulator[] = [];
  const options: V86Options[] = [];
  const storage = {
    load: vi.fn(async () => saved),
    save: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
  };
  const manifest = vi.fn<RuntimeEnvironment["manifest"]>(async () => ({
    version: "v1",
  }));
  const runtime = new UkosRuntime({
    create: (value) => {
      options.push(value);
      const emulator = new Emulator();
      emulators.push(emulator);
      return emulator as unknown as V86;
    },
    emit: (event) => events.push(event),
    manifest,
    storage,
  });
  const boot = async () => {
    await runtime.handle({
      type: "start",
      baseUrl: "http://local/runtime",
      account: "alice",
      cols: 80,
      rows: 24,
    });
    const emulator = emulators.at(-1)!;
    emulator.listeners.get("emulator-loaded")?.(0);
    emulator.control("CONTROL_READY");
    emulator.prompt();
    return emulator;
  };
  return { runtime, boot, events, emulators, options, storage, manifest };
}

describe("isolated emulator lifecycle and grading", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("starts with bounded memory, evaluates only active steps and forwards UTF-8 input", async () => {
    const { runtime, boot, events, options } = setup();
    await runtime.handle({ type: "input", data: "ignored" });
    const emulator = await boot();
    expect(options[0].memory_size).toBe(128 * 1024 * 1024);
    expect(options[0]).not.toHaveProperty("net_device");
    expect(emulator.run).toHaveBeenCalled();
    emulator.prompt("echo pwd");
    emulator.prompt("PWD", 127, "");
    expect(events.filter((event) => event.type === "progress")).toHaveLength(1);
    emulator.prompt("pwd");
    emulator.prompt("ls missing; true", 0, "file");
    emulator.prompt("ls", 0, "file");
    expect(events).toContainEqual({ type: "progress", step: 2 });
    emulator.prompt("mkdir missing", 1, "file");
    const id = emulator.controlMessages.at(-1)?.split("\t")[1];
    emulator.control("CHECK\tstale\t1");
    expect(events).not.toContainEqual({ type: "progress", step: 3 });
    emulator.control(`CHECK\t${id}\t0`);
    emulator.prompt("mkdir -p archiwum/raporty", 0, "file");
    const nextId = emulator.controlMessages.at(-1)?.split("\t")[1];
    emulator.control(`CHECK\t${nextId}\t1`);
    expect(events).toContainEqual({ type: "progress", step: 3 });
    await runtime.handle({ type: "input", data: "Zażółć\u0003" });
    expect(new TextDecoder().decode(emulator.inputs.at(-1))).toBe(
      "Zażółć\u0003",
    );
    await runtime.handle({ type: "resize", cols: 120, rows: 35 });
    expect(emulator.controlMessages).toContain("RESIZE\t120\t35");
    emulator.line(2, "invalid");
    await runtime.handle({ type: "stop" });
    expect(emulator.destroy).toHaveBeenCalledOnce();
  });

  it("saves small archives and awaits an existing save before pausing or destroying", async () => {
    const { runtime, boot, events, storage } = setup();
    const emulator = await boot();
    emulator.autoArchive = false;
    const first = runtime.handle({ type: "save" });
    const second = runtime.handle({ type: "pause", paused: true });
    expect(emulator.stop).not.toHaveBeenCalled();
    const id = emulator.controlMessages.at(-1)?.split("\t")[1];
    emulator.control(`ARCHIVE\t${id}\tYWJj`);
    await Promise.all([first, second]);
    expect(storage.save).toHaveBeenCalledWith(
      expect.stringContaining("alice"),
      expect.objectContaining({ archive: "YWJj", step: 0 }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: "saved", bytes: 3 }),
    );
    expect(emulator.stop).toHaveBeenCalledOnce();
    await runtime.handle({ type: "input", data: "ignored" });
    expect(emulator.inputs).toHaveLength(0);
    await runtime.handle({ type: "pause", paused: true });
    await runtime.handle({ type: "pause", paused: false });
    expect(events).toContainEqual({ type: "status", status: "ready" });
    await runtime.handle({ type: "stop" });
    expect(events).toContainEqual({ type: "status", status: "stopped" });
  });

  it("loads a prepared boot state without fetching the kernel and recalibrates the guest clock", async () => {
    const { runtime, manifest, options, emulators } = setup();
    manifest.mockResolvedValue({
      version: "v1",
      files: { "boot-state.bin.zst": { bytes: 100 } },
    });
    await runtime.handle({
      type: "start",
      baseUrl: "local",
      account: "alice",
      cols: 80,
      rows: 24,
    });
    expect(options[0].initial_state).toEqual({
      url: "local/boot-state.bin.zst",
    });
    expect(options[0]).not.toHaveProperty("bzimage");
    const emulator = emulators[0];
    emulator.listeners.get("emulator-loaded")?.(0);
    expect(emulator.controlMessages[0]).toMatch(/^TIME\t\d+$/);
    expect(emulator.controlMessages).toContain("START");
    emulator.prompt();
    await runtime.handle({ type: "stop" });
  });

  it("reports download progress of the files the boot needs, at most every 100 ms", async () => {
    const { runtime, manifest, emulators, events } = setup();
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    manifest.mockResolvedValue({
      version: "v1",
      files: {
        "boot-state.bin.zst": { bytes: 600 },
        "kernel.bin": { bytes: 5000 },
        "v86.wasm": { bytes: 300 },
        "seabios.bin": { bytes: 60 },
        "vgabios.bin": { bytes: 40 },
      },
    });
    await runtime.handle({
      type: "start",
      baseUrl: "local",
      account: "alice",
      cols: 80,
      rows: 24,
    });
    const downloads = () => events.filter((event) => event.type === "download");
    expect(downloads()).toEqual([{ type: "download", loaded: 0, total: 1000 }]);
    const progress = emulators[0].listeners.get(
      "download-progress",
    ) as unknown as (event: { file_name: string; loaded: number; total: number }) => void;
    now.mockReturnValue(1050);
    progress({ file_name: "local/v86.wasm", loaded: 300, total: 300 });
    expect(downloads()).toHaveLength(1);
    now.mockReturnValue(1200);
    progress({ file_name: "local/boot-state.bin.zst?v=1", loaded: 900, total: 900 });
    expect(downloads().at(-1)).toEqual({ type: "download", loaded: 900, total: 1000 });
    now.mockReturnValue(1400);
    progress({ file_name: "local/extra.bin", loaded: 50, total: 0 });
    expect(downloads().at(-1)).toEqual({ type: "download", loaded: 950, total: 1050 });
    emulators[0].listeners.get("emulator-loaded")?.(0);
    expect(downloads().at(-1)).toEqual({ type: "download", loaded: 1050, total: 1050 });
    now.mockRestore();
    await runtime.handle({ type: "stop" });
  });

  it("restores the compatible image and resets files to the current checkpoint", async () => {
    const { runtime, boot, emulators, events, storage } = setup({
      version: "v1",
      step: 4,
      archive: "YWJj",
      savedAt: 1,
    });
    const emulator = await boot();
    expect(emulator.controlMessages).toContain("RESTORE\t0\tYWJj");
    emulator.control("RESTORED\t0");
    await runtime.handle({ type: "reset" });
    expect(storage.clear).toHaveBeenCalledOnce();
    const replacement = emulators.at(-1)!;
    replacement.control("CONTROL_READY");
    expect(replacement.controlMessages).toContain("CHECKPOINT\t0\t4");
    replacement.prompt();
    expect(events).toContainEqual({ type: "progress", step: 4, restored: true });
    expect(emulator.destroy).toHaveBeenCalledOnce();
    await runtime.handle({ type: "stop" });
  });

  it("debounces file changes, bounds output batches and cleans timers on stop", async () => {
    const { runtime, boot, events, storage } = setup();
    const emulator = await boot();
    emulator.line(3, "DIRTY");
    await vi.advanceTimersByTimeAsync(600);
    emulator.line(3, "DIRTY");
    await vi.advanceTimersByTimeAsync(600);
    expect(storage.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(601);
    expect(storage.save).toHaveBeenCalledOnce();
    const output = emulator.listeners.get("serial0-output-byte")!;
    for (let index = 0; index < 16385; index++) output(65);
    await vi.advanceTimersByTimeAsync(17);
    expect(
      events
        .filter((event) => event.type === "output")
        .map((event) => event.bytes.length),
    ).toEqual([16384, 1]);
    await runtime.handle({ type: "stop" });
    await vi.advanceTimersByTimeAsync(60000);
    expect(
      events.filter(
        (event) => event.type === "status" && event.status === "error",
      ),
    ).toHaveLength(0);
  });

  it("reports storage failures and retries dirty work instead of reporting success", async () => {
    const { runtime, boot, storage, events } = setup();
    storage.load.mockRejectedValueOnce(new Error("denied"));
    await boot();
    expect(events).toContainEqual({ type: "warning", message: "denied" });
    storage.save.mockRejectedValueOnce(new Error("quota"));
    await runtime.handle({ type: "save" });
    expect(events).toContainEqual({ type: "warning", message: "quota" });
    expect(events.filter((event) => event.type === "saved")).toHaveLength(0);
    await runtime.handle({ type: "save" });
    expect(events.filter((event) => event.type === "saved")).toHaveLength(1);
    await runtime.handle({ type: "stop" });
  });

  it("times out failed saves and surfaces guest export errors", async () => {
    const { runtime, boot, events } = setup();
    const emulator = await boot();
    emulator.autoArchive = false;
    const save = runtime.handle({ type: "save" });
    await vi.advanceTimersByTimeAsync(10001);
    await save;
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "warning",
        message: expect.stringContaining("zbyt długo"),
      }),
    );
    const retry = runtime.handle({ type: "save" });
    emulator.control(
      `ERROR\t${emulator.controlMessages.at(-1)?.split("\t")[1]}\tLimit plików`,
    );
    await retry;
    expect(events).toContainEqual({ type: "warning", message: "Limit plików" });
    emulator.autoArchive = true;
    await runtime.handle({ type: "stop" });
  });

  it("stops on boot timeout or a fatal shell exit without a respawn loop", async () => {
    const first = setup();
    await first.runtime.handle({
      type: "start",
      baseUrl: "local",
      account: "alice",
      cols: 80,
      rows: 24,
    });
    await vi.advanceTimersByTimeAsync(45001);
    expect(first.emulators[0].destroy).toHaveBeenCalledOnce();
    expect(first.events).toContainEqual(
      expect.objectContaining({
        type: "status",
        status: "error",
        message: expect.stringContaining("45 sekund"),
      }),
    );
    const second = setup();
    const emulator = await second.boot();
    emulator.control("FATAL\t0\tSession ended");
    await Promise.resolve();
    await Promise.resolve();
    expect(second.events).toContainEqual({
      type: "status",
      status: "error",
      message: "Session ended",
    });
  });

  it("cancels a pending boot and handles missing images and corrupted restores", async () => {
    const first = setup();
    let resolveManifest!: (value: { version: string }) => void;
    first.manifest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveManifest = resolve;
        }),
    );
    const booting = first.runtime.handle({
      type: "start",
      baseUrl: "local",
      account: "alice",
      cols: 80,
      rows: 24,
    });
    await first.runtime.handle({ type: "stop" });
    resolveManifest({ version: "v1" });
    await booting;
    expect(first.emulators).toHaveLength(0);
    const second = setup();
    second.manifest.mockRejectedValueOnce(new Error("missing image"));
    await second.runtime.handle({
      type: "start",
      baseUrl: "local",
      account: "alice",
      cols: 80,
      rows: 24,
    });
    expect(second.events).toContainEqual({
      type: "status",
      status: "error",
      message: "missing image",
    });
    const third = setup({
      version: "v1",
      archive: "YWJj",
      step: 2,
      savedAt: 1,
    });
    await third.runtime.handle({
      type: "start",
      baseUrl: "local",
      account: "alice",
      cols: 80,
      rows: 24,
    });
    third.emulators[0].control("ERROR\t0\tCorrupt archive");
    await Promise.resolve();
    await Promise.resolve();
    expect(third.events).toContainEqual({
      type: "status",
      status: "error",
      message: "Corrupt archive",
    });
  });
});

describe("account course workshops", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  it("reconstructs the server checkpoint on a new device and saves under the account namespace", async () => {
    const context = setup();
    await context.runtime.handle({
      type: "start",
      baseUrl: "http://local/runtime",
      account: "alice",
      cols: 80,
      rows: 24,
      variant: "lab",
      initialStep: 13,
    });
    const emulator = context.emulators[0];
    emulator.control("CONTROL_READY");
    expect(emulator.controlMessages).toContain("LAB_CHECKPOINT\t0\t13");
    const checks = () =>
      emulator.controlMessages.filter((message) =>
        message.startsWith("CHECK\t"),
      );
    emulator.prompt();
    expect(checks()).toHaveLength(1);
    expect(checks()[0].endsWith("\tlab-note")).toBe(true);
    emulator.control(`CHECK\t${checks()[0].split("\t")[1]}\t0`);
    emulator.prompt("pwd");
    emulator.prompt("nano ~/biezace/notatka.txt", 1, "file");
    expect(checks()).toHaveLength(1);
    emulator.prompt("nano ~/biezace/notatka.txt", 0, "file");
    expect(checks()).toHaveLength(2);
    emulator.control(`CHECK\t${checks()[1].split("\t")[1]}\t1`);
    expect(context.events).toContainEqual({ type: "progress", step: 14 });
    expect(checks()).toHaveLength(2);
    await context.runtime.handle({ type: "save" });
    expect(context.storage.save).toHaveBeenCalledWith(
      "ukos-course:alice:lab:lab-1:v1",
      expect.objectContaining({ step: 14 }),
    );
  });
  it("restores course files saved on an older image instead of starting over", async () => {
    const context = setup();
    const migrate = vi.fn(async () => ({
      version: "v1",
      archive: "b2xk",
      step: 7,
      savedAt: 5,
    }));
    Object.assign(context.storage, { migrate });
    await context.runtime.handle({
      type: "start",
      baseUrl: "http://local/runtime",
      account: "alice",
      cols: 80,
      rows: 24,
      variant: "lab",
      initialStep: 5,
    });
    expect(migrate).toHaveBeenCalledWith(
      "ukos-course:alice:lab:lab-1:",
      "ukos-course:alice:lab:lab-1:v1",
      "v1",
    );
    const emulator = context.emulators[0];
    emulator.control("CONTROL_READY");
    expect(emulator.controlMessages).toContain("RESTORE\t0\tb2xk");
    expect(context.events).toContainEqual({ type: "progress", step: 7, restored: true });
  });
  it("credits result steps already completed out of order as soon as they become active", async () => {
    const context = setup();
    await context.runtime.handle({
      type: "start",
      baseUrl: "http://local/runtime",
      account: "alice",
      cols: 80,
      rows: 24,
      variant: "lab",
      initialStep: 9,
    });
    const emulator = context.emulators[0];
    emulator.control("CONTROL_READY");
    const last = () =>
      emulator.controlMessages
        .filter((message) => message.startsWith("CHECK\t"))
        .at(-1)!;
    emulator.prompt();
    expect(last().endsWith("\tlab-copy")).toBe(true);
    emulator.control(`CHECK\t${last().split("\t")[1]}\t1`);
    expect(last().endsWith("\tlab-move")).toBe(true);
    emulator.control(`CHECK\t${last().split("\t")[1]}\t1`);
    expect(context.events).toContainEqual({ type: "progress", step: 11 });
    emulator.control(`CHECK\t${last().split("\t")[1]}\t1`);
    expect(context.events).not.toContainEqual({ type: "progress", step: 12 });
  });
});
