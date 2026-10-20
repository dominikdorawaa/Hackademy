import { useRef } from "react";
import { useWorkshop } from "./useWorkshop";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeCommand, RuntimeEvent } from "./protocol";
import Prototype from "./Prototype";

const fakes = vi.hoisted(() => ({
  terminals: [] as unknown[],
  workers: [] as unknown[],
  failTerminal: false,
  failWebgl: false,
  renderers: [] as { dispose: ReturnType<typeof vi.fn>; loseContext: () => void }[],
}));
vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    write = vi.fn();
    dispose = vi.fn();
    focus = vi.fn();
    cols = 80;
    rows = 24;
    input: ((data: string) => void) | null = null;
    resize: ((size: { cols: number; rows: number }) => void) | null = null;
    constructor() {
      if (fakes.failTerminal) throw new Error("terminal failed");
      fakes.terminals.push(this);
    }
    loadAddon() {}
    open() {}
    onData(callback: (data: string) => void) {
      this.input = callback;
    }
    onResize(callback: (size: { cols: number; rows: number }) => void) {
      this.resize = callback;
    }
  },
}));
vi.mock("@xterm/addon-webgl", () => ({
  WebglAddon: class {
    dispose = vi.fn();
    loseContext: () => void = () => {};
    constructor() {
      if (fakes.failWebgl) throw new Error("no webgl");
      fakes.renderers.push(this);
    }
    onContextLoss(callback: () => void) {
      this.loseContext = callback;
    }
  },
}));
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit = vi.fn();
  },
}));
class WorkerMock {
  onmessage: ((message: { data: RuntimeEvent }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn<(command: RuntimeCommand) => void>();
  terminate = vi.fn();
  constructor() {
    fakes.workers.push(this);
  }
  emit(data: RuntimeEvent) {
    act(() => this.onmessage?.({ data }));
  }
}

type TerminalMock = {
  write: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  input: (text: string) => void;
  resize: (size: { cols: number; rows: number }) => void;
};

async function start() {
  fireEvent.click(screen.getByRole("button", { name: "Uruchom warsztat" }));
  await waitFor(() => expect(fakes.workers).toHaveLength(1));
  return fakes.workers[0] as WorkerMock;
}

describe("prototype interface", () => {
  beforeEach(() => {
    fakes.workers.length = 0;
    fakes.terminals.length = 0;
    fakes.failTerminal = false;
    fakes.failWebgl = false;
    fakes.renderers.length = 0;
    vi.stubGlobal("Worker", WorkerMock);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("starts only on request, displays actual runtime events and preserves responsive controls", async () => {
    const view = render(<Prototype />);
    expect(fakes.workers).toHaveLength(0);
    expect(
      screen.getByText(/Postęp nie łączy się jeszcze z kontem/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Podpowiedź" }));
    expect(screen.getByText("Wpisz pwd i naciśnij Enter.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Podpowiedź" }));
    expect(
      screen.queryByText("Wpisz pwd i naciśnij Enter."),
    ).not.toBeInTheDocument();
    const worker = await start();
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "start", account: "local-prototype" }),
    );
    worker.emit({ type: "status", status: "ready" });
    worker.emit({ type: "progress", step: 1 });
    worker.emit({
      type: "prompt",
      event: {
        command: "pwd",
        status: 0,
        cwd: "/home/student",
        kind: "builtin",
      },
    });
    worker.emit({
      type: "metrics",
      bootMs: 7000,
      restored: false,
      guestMemoryMiB: 128,
    });
    worker.emit({ type: "output", bytes: Uint8Array.from([65]) });
    expect(
      screen.getByRole("heading", { name: "Sprawdź zawartość warsztatu" }),
    ).toBeVisible();
    expect(screen.getByText("7.00 s")).toBeVisible();
    expect(screen.getByText("128 MiB")).toBeVisible();
    const term = fakes.terminals[0] as TerminalMock;
    expect(term.write).toHaveBeenCalledWith(Uint8Array.from([65]));
    act(() => {
      term.input("pwd");
      term.resize({ cols: 120, rows: 30 });
    });
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: "input",
      data: "pwd",
    });
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: "resize",
      cols: 120,
      rows: 30,
    });
    worker.emit({ type: "warning", message: "Nie zapisano pracy" });
    expect(screen.getByRole("alert")).toHaveTextContent("Nie zapisano pracy");
    worker.emit({ type: "saved", bytes: 200, elapsedMs: 20, savedAt: 10000 });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("200 B / 20 ms")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Zapisz teraz" }));
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "save" });
    fireEvent.click(screen.getByRole("button", { name: "Pauza" }));
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: "pause",
      paused: true,
    });
    worker.emit({ type: "status", status: "paused" });
    fireEvent.click(screen.getByRole("button", { name: "Wznów" }));
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: "pause",
      paused: false,
    });
    worker.emit({ type: "status", status: "ready" });
    fireEvent.click(
      screen.getByRole("button", { name: "Sprawdź reakcję strony: 0" }),
    );
    expect(
      screen.getByRole("button", { name: "Sprawdź reakcję strony: 1" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Resetuj pliki warsztatu" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(
      screen.queryByRole("button", { name: "Tak, resetuj pliki" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Resetuj pliki warsztatu" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Tak, resetuj pliki" }));
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "reset" });
    expect(screen.getByText("Uruchamianie Linuksa")).toBeVisible();
    worker.emit({
      type: "metrics",
      bootMs: 6000,
      restored: true,
      guestMemoryMiB: 128,
    });
    worker.emit({ type: "status", status: "ready" });
    worker.emit({ type: "progress", step: 6 });
    expect(
      screen.getByRole("heading", { name: "Archiwum uporządkowane." }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Zatrzymaj" }));
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "stop" });
    worker.emit({ type: "status", status: "stopped" });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(term.dispose).toHaveBeenCalledOnce();
    view.unmount();
  });

  it("pauses hidden sessions and warns before discarding unsaved work only", async () => {
    const view = render(<Prototype />);
    const worker = await start();
    worker.emit({ type: "status", status: "ready" });
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: "pause",
      paused: true,
    });
    worker.emit({ type: "status", status: "paused" });
    hidden.mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: "pause",
      paused: false,
    });
    worker.emit({ type: "status", status: "ready" });
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    worker.emit({ type: "dirty" });
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "save" });
    view.unmount();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("allows cancellation during boot and exposes worker and terminal failures", async () => {
    const view = render(<Prototype />);
    const worker = await start();
    fireEvent.click(screen.getByRole("button", { name: "Zatrzymaj" }));
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Uruchom warsztat" }),
    ).toBeVisible();
    fakes.workers.length = 0;
    const second = await start();
    act(() => second.onerror?.());
    expect(screen.getByRole("alert")).toHaveTextContent("procesu Linuksa");
    fireEvent.click(screen.getByRole("button", { name: "Zatrzymaj" }));
    fakes.failTerminal = true;
    fireEvent.click(screen.getByRole("button", { name: "Uruchom warsztat" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("terminal failed"),
    );
    view.unmount();
  });
  it("draws the terminal with WebGL and falls back to the DOM renderer without it", async () => {
    const view = render(<Prototype />);
    await start();
    expect(fakes.renderers).toHaveLength(1);
    fakes.renderers[0].loseContext();
    expect(fakes.renderers[0].dispose).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Zatrzymaj" }));
    fakes.workers.length = 0;
    fakes.failWebgl = true;
    await start();
    expect(fakes.renderers).toHaveLength(1);
    expect(fakes.terminals).toHaveLength(2);
    view.unmount();
  });
  it("finishes saving course files before terminating a worker on route navigation", async () => {
    function CourseWorkshop() {
      const ref = useRef<HTMLDivElement>(null);
      const workshop = useWorkshop(ref, { account: "alice", variant: "lab" });
      return (
        <>
          <div ref={ref} />
          <button onClick={() => void workshop.start()}>
            Uruchom warsztat
          </button>
        </>
      );
    }
    const view = render(<CourseWorkshop />);
    const worker = await start();
    worker.emit({ type: "status", status: "ready" });
    worker.emit({ type: "dirty" });
    view.unmount();
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: "stop" });
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.emit({ type: "status", status: "stopped" });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
