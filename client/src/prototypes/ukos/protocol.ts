export const steps = [
  {
    id: "pwd",
    title: "Ustal swoją lokalizację",
    description:
      "Pierwszy dyżur. Opiekun prosi o ustalenie, w którym katalogu rozpoczynasz pracę. Wykonaj pwd.",
    hint: "Wpisz pwd i naciśnij Enter.",
  },
  {
    id: "ls",
    title: "Sprawdź zawartość warsztatu",
    description: "Obejrzyj pliki czekające na uporządkowanie. Wykonaj ls.",
    hint: "Wpisz ls. Wielkość liter ma znaczenie.",
  },
  {
    id: "directory",
    title: "Przygotuj archiwum",
    description: "W katalogu domowym utwórz archiwum, a w nim katalog raporty.",
    hint: "Możesz użyć mkdir -p ~/archiwum/raporty.",
  },
  {
    id: "note",
    title: "Zapisz notatkę w nano",
    description:
      "Utwórz plik ~/archiwum/notatka.txt zawierający tekst Gotowy do pracy. Możesz użyć nano. Zapisz plik i zamknij edytor.",
    hint: "nano ~/archiwum/notatka.txt, potem Ctrl+O, Enter i Ctrl+X.",
  },
  {
    id: "copy",
    title: "Zabezpiecz raport",
    description:
      "Skopiuj ~/archiwum/raport.txt do ~/archiwum/raporty/raport.txt, zachowując treść oryginału.",
    hint: "Użyj cp ze ścieżką źródłową i docelową.",
  },
  {
    id: "move",
    title: "Uporządkuj notatkę",
    description:
      "Przenieś ~/archiwum/notatka.txt do ~/archiwum/raporty/notatka.txt. Plik źródłowy powinien zniknąć, a treść pozostać.",
    hint: "Użyj mv ze ścieżką źródłową i docelową.",
  },
] as const;

export type StepId = (typeof steps)[number]["id"];
export type PromptEvent = {
  status: number;
  command: string;
  cwd: string;
  kind: string;
};
export type SavedWorkshop = {
  version: string;
  archive: string;
  step: number;
  savedAt: number;
};
export type RuntimeEvent =
  | {
      type: "status";
      status: "booting" | "ready" | "paused" | "stopped" | "error";
      message?: string;
    }
  | { type: "output"; bytes: Uint8Array }
  | { type: "prompt"; event: PromptEvent }
  | { type: "progress"; step: number; restored?: boolean }
  | { type: "download"; loaded: number; total: number }
  | { type: "dirty" }
  | { type: "saved"; bytes: number; elapsedMs: number; savedAt: number }
  | {
      type: "metrics";
      bootMs: number;
      restored: boolean;
      guestMemoryMiB: number;
    }
  | { type: "warning"; message: string };
export type RuntimeCommand =
  | {
      type: "start";
      baseUrl: string;
      account: string;
      cols: number;
      rows: number;
      coldBoot?: boolean;
      variant?: "lab";
      initialStep?: number;
    }
  | { type: "input"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "pause"; paused: boolean }
  | { type: "save" }
  | { type: "reset" }
  | { type: "stop" };

export const MAX_LINE_BYTES = 8 * 1024 * 1024;

export class LineDecoder {
  private buffer = "";
  constructor(
    private readonly onLine: (line: string) => void,
    private readonly limit = MAX_LINE_BYTES,
  ) {}
  push(byte: number) {
    if (byte === 10) {
      const line = this.buffer;
      this.buffer = "";
      this.onLine(
        new TextDecoder().decode(
          Uint8Array.from(line.replace(/\r$/, ""), (char) =>
            char.charCodeAt(0),
          ),
        ),
      );
    } else {
      if (this.buffer.length >= this.limit) {
        this.buffer = "";
        throw new Error("Przekroczono limit komunikatu środowiska.");
      }
      this.buffer += String.fromCharCode(byte);
    }
  }
}

export function decodeText(encoded: string) {
  return new TextDecoder().decode(
    Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)),
  );
}

export function parsePrompt(line: string): PromptEvent | null {
  const [tag, status, command, cwd, kind = ""] = line.split("\t");
  if (
    tag !== "PROMPT" ||
    !/^\d{1,3}$/.test(status) ||
    command === undefined ||
    cwd === undefined
  )
    return null;
  try {
    return {
      status: Number(status),
      command: decodeText(command).trim(),
      cwd: decodeText(cwd),
      kind,
    };
  } catch {
    return null;
  }
}

const HOME = "/home/student";

export const commandSteps = new Set([
  "pwd",
  "ls",
  "ls-detail",
  "ls-hidden",
  "lab-read-message",
  "cd-relative",
  "lab-read-report",
  "cd-absolute",
  "history",
]);

export function resolvePath(path: string, cwd: string) {
  const full =
    path === "~"
      ? HOME
      : path.startsWith("~/")
        ? HOME + path.slice(1)
        : path.startsWith("/")
          ? path
          : `${cwd}/${path}`;
  const parts: string[] = [];
  for (const part of full.split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return "/" + parts.join("/");
}

function listing(event: PromptEvent) {
  const match = /^ls((?:\s+-[aAlh1]+)*)(?:\s+([\w~./-]+))?$/.exec(
    event.command,
  );
  if (event.kind !== "file" || !match) return null;
  return {
    flags: match[1],
    target: match[2] ? resolvePath(match[2], event.cwd) : event.cwd,
  };
}

function reads(event: PromptEvent, ...files: string[]) {
  const match = /^cat\s+([\w~./-]+)$/.exec(event.command);
  return (
    event.kind === "file" &&
    Boolean(match) &&
    files.includes(resolvePath(match![1], event.cwd))
  );
}

export function commandPasses(
  step: string,
  event: PromptEvent,
  previousCwd?: string,
) {
  if (event.status !== 0) return false;
  if (step === "pwd")
    return event.kind === "builtin" && /^pwd(?:\s+-[LP])?$/.test(event.command);
  if (step === "history")
    return (
      event.kind === "builtin" && /^history(?:\s+\d+)?$/.test(event.command)
    );
  if (step === "cd-absolute")
    return (
      event.kind === "builtin" &&
      /^cd\s+\/home\/student\/biezace\/?$/.test(event.command) &&
      event.cwd === `${HOME}/biezace`
    );
  if (step === "cd-relative")
    return (
      event.kind === "builtin" &&
      /^cd\s+(?![~/$])[\w./-]+$/.test(event.command) &&
      previousCwd === HOME &&
      event.cwd === `${HOME}/archiwum`
    );
  if (step === "lab-read-message") return reads(event, `${HOME}/.wiadomosc`);
  if (step === "lab-read-report")
    return reads(
      event,
      `${HOME}/archiwum/raport.txt`,
      `${HOME}/biezace/raport.txt`,
    );
  const ls = listing(event);
  if (!ls) return false;
  if (step === "ls") return ls.target === HOME;
  if (step === "ls-detail")
    return ls.flags.includes("l") && ls.target === `${HOME}/archiwum`;
  if (step === "ls-hidden")
    return (
      ls.flags.includes("l") && ls.flags.includes("a") && ls.target === HOME
    );
  return false;
}

export function resultCommandPasses(step: string, event: PromptEvent) {
  if (event.status !== 0) return false;
  const commands: Record<string, RegExp> = {
    "lab-directory": /^mkdir(?:\s|$)/,
    "lab-remove": /^(?:rmdir|rm)(?:\s|$)/,
    "lab-copy": /^cp(?:\s|$)/,
    "lab-move": /^mv(?:\s|$)/,
    "lab-touch": /^touch(?:\s|$)/,
    "lab-note": /^(?:nano|vi|vim|printf|echo|tee)(?:\s|$)/,
  };
  return Boolean(commands[step]?.test(event.command));
}

export function storageKey(account: string, version: string) {
  return `ukos-prototype:${encodeURIComponent(account)}:lab-1:${version}`;
}

export function validWorkshop(
  value: unknown,
  version: string,
  maxSteps: number = steps.length,
): value is SavedWorkshop {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<SavedWorkshop>;
  return (
    entry.version === version &&
    typeof entry.archive === "string" &&
    entry.archive.length < MAX_LINE_BYTES &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(entry.archive) &&
    entry.archive.length > 0 &&
    Number.isInteger(entry.step) &&
    entry.step! >= 0 &&
    entry.step! <= maxSteps &&
    typeof entry.savedAt === "number" &&
    Number.isFinite(entry.savedAt)
  );
}
