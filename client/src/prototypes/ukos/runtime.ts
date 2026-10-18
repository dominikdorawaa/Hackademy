import { lessons } from "../../ukos/content";
import type { V86, V86Options } from "v86";
import {
  commandPasses,
  commandSteps,
  resultCommandPasses,
  LineDecoder,
  parsePrompt,
  steps,
  storageKey,
  type RuntimeCommand,
  type RuntimeEvent,
  type SavedWorkshop,
} from "./protocol";

export type RuntimeEnvironment = {
  create: (options: V86Options) => V86;
  emit: (event: RuntimeEvent) => void;
  manifest: (
    base: string,
  ) => Promise<{ version: string; files?: Record<string, { bytes: number }> }>;
  storage: {
    load: (key: string, version: string) => Promise<SavedWorkshop | null>;
    save: (key: string, data: SavedWorkshop) => Promise<void>;
    clear: (key: string) => Promise<void>;
  };
};

export class UkosRuntime {
  private emulator: V86 | null = null;
  private start: Extract<RuntimeCommand, { type: "start" }> | null = null;
  private version = "";
  private key = "";
  private step = 0;
  private cwd = "";
  private ready = false;
  private paused = false;
  private dirty = false;
  private saved: SavedWorkshop | null = null;
  private startedAt = 0;
  private output: number[] = [];
  private outputTimer: ReturnType<typeof setTimeout> | undefined;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private bootTimer: ReturnType<typeof setTimeout> | undefined;
  private sequence = 0;
  private pendingCheck: { id: string; step: number } | null = null;
  private pendingSave: {
    id: string;
    startedAt: number;
    resolve: () => void;
    timeout: ReturnType<typeof setTimeout>;
  } | null = null;
  private restored = false;
  private checkpoint: number | null = null;
  private generation = 0;
  private saving: Promise<void> | null = null;

  constructor(private readonly environment: RuntimeEnvironment) {}

  async handle(command: RuntimeCommand) {
    try {
      switch (command.type) {
        case "start":
          if (this.emulator) return;
          this.start = command;
          await this.boot();
          break;
        case "input":
          if (this.ready && !this.paused)
            this.emulator?.serial_send_bytes(
              0,
              new TextEncoder().encode(command.data),
            );
          break;
        case "resize":
          if (this.start)
            Object.assign(this.start, {
              cols: command.cols,
              rows: command.rows,
            });
          if (this.ready) this.send(`RESIZE\t${command.cols}\t${command.rows}`);
          break;
        case "pause":
          if (!this.ready || this.paused === command.paused) return;
          if (command.paused) {
            await this.save();
            if (this.dirty) await this.save();
            this.paused = true;
            await this.emulator?.stop();
          } else {
            this.paused = false;
            await this.emulator?.run();
          }
          this.emit({
            type: "status",
            status: this.paused ? "paused" : "ready",
          });
          break;
        case "save":
          await this.save();
          break;
        case "reset": {
          const checkpoint = this.step;
          await this.shutdown();
          await this.environment.storage.clear(this.key);
          this.checkpoint = checkpoint;
          await this.boot();
          break;
        }
        case "stop":
          await this.save();
          if (this.dirty) await this.save();
          await this.shutdown();
          this.emit({ type: "status", status: "stopped" });
          break;
      }
    } catch (error) {
      await this.shutdown();
      this.emit({
        type: "status",
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Nie udało się uruchomić warsztatu.",
      });
    }
  }

  private emit(event: RuntimeEvent) {
    this.environment.emit(event);
  }

  private send(text: string) {
    this.emulator?.serial_send_bytes(1, new TextEncoder().encode(text + "\n"));
  }

  private get tasks() {
    return this.start?.variant === "lab" ? lessons : steps;
  }

  private async boot() {
    if (!this.start) return;
    const generation = ++this.generation;
    this.emit({ type: "status", status: "booting" });
    this.startedAt = performance.now();
    const { version, files } = await this.environment.manifest(
      this.start.baseUrl,
    );
    if (generation !== this.generation) return;
    this.version = version;
    this.key = this.start.variant
      ? `ukos-course:${encodeURIComponent(this.start.account)}:lab:lab-1:${version}`
      : storageKey(this.start.account, version);
    this.saved = null;
    this.restored = false;
    if (this.checkpoint === null) {
      try {
        this.saved = await this.environment.storage.load(this.key, version);
      } catch (error) {
        this.emit({
          type: "warning",
          message:
            error instanceof Error
              ? error.message
              : "Lokalny zapis jest niedostępny.",
        });
      }
    }
    if (generation !== this.generation) return;
    const minimum =
      this.start.variant === "lab"
        ? Math.min(lessons.length, Math.max(0, this.start.initialStep ?? 0))
        : 0;
    if (this.saved && this.saved.step < minimum) this.saved = null;
    this.step = this.checkpoint ?? this.saved?.step ?? minimum;
    if (!this.saved && this.start.variant === "lab")
      this.checkpoint = this.step;
    const useBootState =
      Boolean(files?.["boot-state.bin.zst"]) && !this.start.coldBoot;
    this.emit({ type: "progress", step: this.step });
    const control = new LineDecoder((line) => {
      void this.control(line);
    });
    const prompts = new LineDecoder((line) => this.prompt(line), 24 * 1024);
    const dirty = new LineDecoder(() => this.markDirty(), 128);
    const emulator = this.environment.create({
      wasm_path: `${this.start.baseUrl}/v86.wasm`,
      memory_size: 128 * 1024 * 1024,
      vga_memory_size: 256 * 1024,
      bios: { url: `${this.start.baseUrl}/seabios.bin` },
      vga_bios: { url: `${this.start.baseUrl}/vgabios.bin` },
      ...(useBootState
        ? {
            initial_state: { url: `${this.start.baseUrl}/boot-state.bin.zst` },
          }
        : {
            bzimage: { url: `${this.start.baseUrl}/kernel.bin`, async: false },
            initrd: { url: `${this.start.baseUrl}/initrd.gz`, async: false },
            cmdline:
              "console=ttyS0,115200 quiet loglevel=0 tsc=reliable mitigations=off random.trust_cpu=on init=/init",
          }),
      autostart: false,
      disable_keyboard: true,
      disable_mouse: true,
      disable_speaker: true,
      uart1: true,
      uart2: true,
      uart3: true,
    });
    this.emulator = emulator;
    this.bootTimer = setTimeout(() => {
      void this.fail(
        new Error(
          "Linux nie uruchomił się w ciągu 45 sekund. Zatrzymaj warsztat i spróbuj ponownie.",
        ),
      );
    }, 45000);
    const guarded = (decoder: LineDecoder) => (byte: number) => {
      try {
        decoder.push(byte);
      } catch (error) {
        void this.fail(error);
      }
    };
    emulator.add_listener("serial0-output-byte", (byte) => {
      this.output.push(byte);
      if (this.output.length >= 16384) this.flushOutput();
      this.outputTimer ??= setTimeout(() => this.flushOutput(), 16);
    });
    emulator.add_listener("serial1-output-byte", guarded(control));
    emulator.add_listener("serial2-output-byte", guarded(prompts));
    emulator.add_listener("serial3-output-byte", guarded(dirty));
    emulator.add_listener("emulator-loaded", () => {
      void emulator.run();
      if (useBootState) this.prepareGuest();
    });
  }

  private async fail(error: unknown) {
    await this.shutdown();
    this.emit({
      type: "status",
      status: "error",
      message: error instanceof Error ? error.message : "Błąd środowiska.",
    });
  }

  private flushOutput() {
    clearTimeout(this.outputTimer);
    this.outputTimer = undefined;
    if (this.output.length)
      this.emit({ type: "output", bytes: Uint8Array.from(this.output) });
    this.output = [];
  }

  private prompt(line: string) {
    const event = parsePrompt(line);
    if (!event) return;
    const previousCwd = this.cwd;
    this.cwd = event.cwd;
    this.emit({ type: "prompt", event });
    if (!this.ready) {
      clearTimeout(this.bootTimer);
      this.ready = true;
      this.emit({ type: "status", status: "ready" });
      this.emit({
        type: "metrics",
        bootMs: performance.now() - this.startedAt,
        restored: this.restored,
        guestMemoryMiB: 128,
      });
      if (this.start)
        this.send(`RESIZE\t${this.start.cols}\t${this.start.rows}`);
      this.checkpoint = null;
      this.markDirty();
      if (this.start?.variant === "lab") this.check();
      return;
    }
    this.markDirty();
    const current = this.tasks[this.step];
    if (current) {
      if (commandPasses(current.id, event, previousCwd)) this.advance();
      else if (!commandSteps.has(current.id)) {
        if (
          this.start?.variant === "lab" &&
          !resultCommandPasses(current.id, event)
        )
          return;
        this.check();
      }
    }
  }

  private advance() {
    this.step = Math.min(this.step + 1, this.tasks.length);
    this.pendingCheck = null;
    this.emit({ type: "progress", step: this.step });
    this.markDirty();
    if (this.start?.variant === "lab") this.check();
  }

  private check() {
    const current = this.tasks[this.step];
    if (!current || commandSteps.has(current.id)) return;
    const id = String(++this.sequence);
    this.pendingCheck = { id, step: this.step };
    this.send(`CHECK\t${id}\t${current.id}`);
  }

  private async control(line: string) {
    const [tag, id, value] = line.split("\t");
    if (tag === "CONTROL_READY") {
      this.prepareGuest();
    } else if (tag === "RESTORED") {
      this.restored = true;
    } else if (tag === "CHECK" && this.pendingCheck?.id === id) {
      if (value === "1" && this.pendingCheck.step === this.step) this.advance();
      else this.pendingCheck = null;
    } else if (tag === "ARCHIVE" && this.pendingSave?.id === id) {
      const pending = this.pendingSave;
      try {
        if (!value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
          throw new Error("Nieprawidłowy zapis warsztatu.");
        const savedAt = Date.now();
        await this.environment.storage.save(this.key, {
          version: this.version,
          archive: value,
          step: this.step,
          savedAt,
        });
        this.emit({
          type: "saved",
          bytes: Math.floor((value.length * 3) / 4),
          elapsedMs: performance.now() - pending.startedAt,
          savedAt,
        });
      } catch (error) {
        this.dirty = true;
        this.emit({
          type: "warning",
          message:
            error instanceof Error
              ? error.message
              : "Nie udało się zachować pracy.",
        });
      } finally {
        clearTimeout(pending.timeout);
        this.pendingSave = null;
        pending.resolve();
        if (this.dirty) this.markDirty();
      }
    } else if (tag === "FATAL") {
      await this.fail(
        new Error(value || "Sesja terminala została zakończona."),
      );
    } else if (tag === "ERROR") {
      this.emit({
        type: "warning",
        message: value || "Nie udało się zachować pracy.",
      });
      if (this.pendingSave?.id === id) {
        clearTimeout(this.pendingSave.timeout);
        this.pendingSave.resolve();
        this.pendingSave = null;
        this.dirty = true;
      } else if (!this.ready) {
        await this.fail(
          new Error(value || "Nie udało się odtworzyć warsztatu."),
        );
      }
    }
  }

  private prepareGuest() {
    this.send(`TIME\t${Math.floor(Date.now() / 1000)}`);
    if (this.checkpoint !== null)
      this.send(
        `${this.start?.variant === "lab" ? "LAB_CHECKPOINT" : "CHECKPOINT"}\t0\t${this.checkpoint}`,
      );
    else if (this.saved) this.send(`RESTORE\t0\t${this.saved.archive}`);
    else this.send("START");
  }

  private markDirty() {
    this.dirty = true;
    this.emit({ type: "dirty" });
    clearTimeout(this.saveTimer);
    if (this.ready && !this.paused)
      this.saveTimer = setTimeout(() => {
        void this.save();
      }, 1200);
  }

  private save(): Promise<void> {
    clearTimeout(this.saveTimer);
    if (this.saving) return this.saving;
    if (!this.ready || this.paused || !this.dirty) return Promise.resolve();
    this.dirty = false;
    const completion = new Promise<void>((resolve) => {
      const id = String(++this.sequence);
      const timeout = setTimeout(() => {
        this.pendingSave = null;
        this.dirty = true;
        this.emit({
          type: "warning",
          message: "Zapis trwał zbyt długo. Praca nie została zachowana.",
        });
        resolve();
      }, 10000);
      this.pendingSave = { id, startedAt: performance.now(), resolve, timeout };
      this.send(`EXPORT\t${id}`);
    });
    this.saving = completion;
    void completion.finally(() => {
      if (this.saving === completion) this.saving = null;
    });
    return completion;
  }

  private async shutdown() {
    ++this.generation;
    this.ready = false;
    this.paused = false;
    clearTimeout(this.saveTimer);
    clearTimeout(this.bootTimer);
    this.flushOutput();
    if (this.pendingSave) {
      clearTimeout(this.pendingSave.timeout);
      this.pendingSave.resolve();
      this.pendingSave = null;
    }
    this.pendingCheck = null;
    this.saving = null;
    this.dirty = false;
    const emulator = this.emulator;
    this.emulator = null;
    if (emulator) await emulator.destroy();
  }
}
