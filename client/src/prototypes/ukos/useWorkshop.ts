import { useCallback, useEffect, useRef, useState } from "react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import type { RuntimeCommand, RuntimeEvent, PromptEvent } from "./protocol";
import "./terminal.css";

export type WorkshopOptions = {
  account: string;
  variant: "lab";
  initialStep?: number;
  onProgress?: (step: number) => void;
};

function attachWebgl(
  term: Terminal,
  webgl: typeof import("@xterm/addon-webgl") | null,
) {
  if (!webgl) return false;
  try {
    const renderer = new webgl.WebglAddon();
    renderer.onContextLoss(() => renderer.dispose());
    term.loadAddon(renderer);
    return true;
  } catch {
    return false;
  }
}

export function useWorkshop(
  container: React.RefObject<HTMLDivElement | null>,
  options?: WorkshopOptions,
) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);
  const [status, setStatus] = useState("stopped");
  const [hasWorker, setHasWorker] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [lastCommand, setLastCommand] = useState<PromptEvent | null>(null);
  const [metrics, setMetrics] = useState<Extract<
    RuntimeEvent,
    { type: "metrics" }
  > | null>(null);
  const [download, setDownload] = useState<{
    loaded: number;
    total: number;
  } | null>(null);
  const [saved, setSaved] = useState<Extract<
    RuntimeEvent,
    { type: "saved" }
  > | null>(null);
  const worker = useRef<Worker | null>(null);
  const terminal = useRef<Terminal | null>(null);
  const fit = useRef<FitAddon | null>(null);
  const stateRef = useRef(status);
  const dirtyRef = useRef(false);
  const generation = useRef(0);
  const send = useCallback((command: RuntimeCommand) => {
    if (command.type === "reset") {
      setStatus("booting");
      setDownload(null);
      setSaved(null);
      setMetrics(null);
    }
    worker.current?.postMessage(command);
  }, []);

  const dispose = useCallback(() => {
    ++generation.current;
    worker.current?.terminate();
    worker.current = null;
    setHasWorker(false);
    terminal.current?.dispose();
    terminal.current = null;
    fit.current = null;
  }, []);

  const start = async () => {
    if (!container.current || worker.current) return;
    const currentGeneration = ++generation.current;
    setError("");
    setWarning("");
    setMetrics(null);
    setSaved(null);
    setDownload(null);
    setStatus("booting");
    try {
      const [{ Terminal }, { FitAddon }, webgl] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-webgl").catch(() => null),
      ]);
      if (!container.current || generation.current !== currentGeneration)
        return;
      const term = new Terminal({
        cursorBlink: false,
        fontFamily: '"DejaVu Sans Mono", "Cascadia Code", monospace',
        fontSize: optionsRef.current?.variant === "lab" ? 17 : 14,
        lineHeight: optionsRef.current?.variant === "lab" ? 1.35 : 1.4,
        scrollback: 1000,
        allowProposedApi: false,
        theme: {
          background: "#0b1220",
          foreground: "#dae4f2",
          cursor: "#61a2ff",
          selectionBackground: "#244a7c",
        },
      });
      const addon = new FitAddon();
      term.loadAddon(addon);
      term.open(container.current);
      attachWebgl(term, webgl);
      addon.fit();
      terminal.current = term;
      fit.current = addon;
      const instance = new Worker(new URL("./v86.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = instance;
      setHasWorker(true);
      instance.onerror = () => {
        setError(
          "Nie udało się uruchomić procesu Linuksa. Zatrzymaj warsztat i spróbuj ponownie.",
        );
        setStatus("error");
      };
      instance.onmessage = (message: MessageEvent<RuntimeEvent>) => {
        const event = message.data;
        switch (event.type) {
          case "output":
            term.write(event.bytes);
            break;
          case "status":
            setStatus(event.status);
            if (event.message) setError(event.message);
            if (event.status === "ready") {
              addon.fit();
              term.focus();
            }
            if (event.status === "stopped") dispose();
            break;
          case "progress":
            setStep(event.step);
            optionsRef.current?.onProgress?.(event.step);
            break;
          case "prompt":
            setLastCommand(event.event);
            break;
          case "metrics":
            setMetrics(event);
            break;
          case "download":
            setDownload({ loaded: event.loaded, total: event.total });
            break;
          case "saved":
            setSaved(event);
            setWarning("");
            dirtyRef.current = false;
            break;
          case "dirty":
            dirtyRef.current = true;
            break;
          case "warning":
            setWarning(event.message);
            break;
        }
      };
      term.onData((data) => send({ type: "input", data }));
      term.onResize(({ cols, rows }) => send({ type: "resize", cols, rows }));
      send({
        type: "start",
        baseUrl: new URL("/prototypes/runtime", location.href).href,
        account: optionsRef.current?.account ?? "local-prototype",
        variant: optionsRef.current?.variant,
        initialStep: optionsRef.current?.initialStep,
        cols: term.cols,
        rows: term.rows,
        coldBoot: new URLSearchParams(location.search).has("cold"),
      });
    } catch (failure) {
      dispose();
      setError(
        failure instanceof Error
          ? failure.message
          : "Nie udało się otworzyć terminala.",
      );
      setStatus("error");
    }
  };

  useEffect(() => {
    stateRef.current = status;
  }, [status]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(() => fit.current?.fit());
    observer.observe(element);
    const visibility = () => {
      if (stateRef.current === "ready" && document.hidden)
        send({ type: "pause", paused: true });
      if (stateRef.current === "paused" && !document.hidden)
        send({ type: "pause", paused: false });
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (
        worker.current &&
        dirtyRef.current &&
        stateRef.current !== "stopped"
      ) {
        send({ type: "save" });
        event.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("beforeunload", unload);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("beforeunload", unload);
      const instance = worker.current;
      if (
        instance &&
        optionsRef.current &&
        ["ready", "paused"].includes(stateRef.current)
      ) {
        worker.current = null;
        const timeout = setTimeout(() => instance.terminate(), 11000);
        const finish = () => {
          clearTimeout(timeout);
          instance.terminate();
        };
        instance.onmessage = (message: MessageEvent<RuntimeEvent>) => {
          if (
            message.data.type === "status" &&
            ["stopped", "error"].includes(message.data.status)
          )
            finish();
        };
        instance.onerror = finish;
        instance.postMessage({ type: "stop" });
      }
      dispose();
    };
  }, [container, dispose, send]);

  const stop = () => {
    if (status === "booting" || status === "error") {
      dispose();
      setStatus("stopped");
    } else send({ type: "stop" });
  };

  return {
    status,
    step,
    error,
    warning,
    lastCommand,
    metrics,
    download,
    saved,
    start,
    stop,
    send,
    canReset: status === "ready" || (status === "error" && hasWorker),
  };
}
