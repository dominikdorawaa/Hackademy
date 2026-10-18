import { describe, expect, it } from "vitest";
import {
  commandPasses,
  decodeText,
  LineDecoder,
  parsePrompt,
  resolvePath,
  resultCommandPasses,
  storageKey,
  validWorkshop,
} from "./protocol";

const encode = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)));
const prompt = (command: string, status = 0, kind = "builtin") => ({
  command,
  status,
  kind,
  cwd: "/home/student",
});

describe("guest protocol", () => {
  it("decodes UTF-8 lines split across packets and handles CRLF and empty frames", () => {
    const lines: string[] = [];
    const decoder = new LineDecoder((line) => lines.push(line));
    for (const byte of new TextEncoder().encode("Zażółć\r\n\nnext\n"))
      decoder.push(byte);
    expect(lines).toEqual(["Zażółć", "", "next"]);
  });
  it("bounds untrusted frames and recovers after an oversized line", () => {
    const lines: string[] = [];
    const decoder = new LineDecoder((line) => lines.push(line), 3);
    [65, 65, 65].forEach((byte) => decoder.push(byte));
    expect(() => decoder.push(65)).toThrow("limit");
    decoder.push(10);
    expect(lines).toEqual([""]);
  });
  it("reads successful and failed shell commands with Unicode cwd", () => {
    expect(
      parsePrompt(`PROMPT\t127\t${encode(" PWD ")}\t${encode("/home/żółć")}\t`),
    ).toEqual({ command: "PWD", status: 127, cwd: "/home/żółć", kind: "" });
    expect(
      parsePrompt(`PROMPT\t0\t${encode("pwd")}\t${encode("/home/student")}`),
    ).toEqual(prompt("pwd", 0, ""));
    expect(decodeText(encode("Zażółć gęślą jaźń"))).toBe("Zażółć gęślą jaźń");
  });
  it.each([
    "OTHER\t0\t\t",
    "PROMPT\tNaN\t\t",
    "PROMPT\t0",
    "PROMPT\t0\t%%%\t%%%",
  ])("rejects malformed telemetry: %s", (line) => {
    expect(parsePrompt(line)).toBeNull();
  });
  it("accepts actual standalone commands and does not grade output or compound commands", () => {
    expect(commandPasses("pwd", prompt("pwd"))).toBe(true);
    expect(commandPasses("pwd", prompt("pwd -P"))).toBe(true);
    expect(commandPasses("ls", prompt("ls -la", 0, "file"))).toBe(true);
    for (const command of [
      "echo pwd",
      "PWD",
      "pwd; true",
      "pwd && true",
      "pwd | cat",
    ])
      expect(commandPasses("pwd", prompt(command))).toBe(false);
    expect(commandPasses("pwd", prompt("pwd", 1))).toBe(false);
    expect(commandPasses("pwd", prompt("pwd", 0, "alias"))).toBe(false);
    expect(commandPasses("ls", prompt("ls missing; true", 0, "file"))).toBe(
      false,
    );
    expect(commandPasses("ls", prompt("ls", 0, "function"))).toBe(false);
    expect(commandPasses("directory", prompt("mkdir"))).toBe(false);
  });
  it("isolates account and image namespaces and validates saved records", () => {
    expect(storageKey("a:b", "v1")).not.toBe(storageKey("a", "b:v1"));
    const valid = { version: "v1", archive: "YWJj", step: 3, savedAt: 10 };
    expect(validWorkshop(valid, "v1")).toBe(true);
    for (const value of [
      null,
      1,
      {},
      { ...valid, version: "v2" },
      { ...valid, archive: "bad?" },
      { ...valid, archive: "" },
      { ...valid, step: -1 },
      { ...valid, step: 7 },
      { ...valid, step: 1.5 },
      { ...valid, savedAt: NaN },
    ])
      expect(validWorkshop(value, "v1")).toBe(false);
  });
});

describe("guided course commands", () => {
  const home = "/home/student";
  const event = (command: string, cwd = home, kind = "file") => ({
    command,
    cwd,
    kind,
    status: 0,
  });
  it("resolves home, absolute and relative paths", () => {
    expect(resolvePath("~", "/tmp")).toBe(home);
    expect(resolvePath("~/archiwum/", "/tmp")).toBe(`${home}/archiwum`);
    expect(resolvePath("raport.txt", `${home}/archiwum`)).toBe(
      `${home}/archiwum/raport.txt`,
    );
    expect(resolvePath("../biezace/./raport.txt", `${home}/archiwum`)).toBe(
      `${home}/biezace/raport.txt`,
    );
    expect(resolvePath("/../etc", home)).toBe("/etc");
  });
  it("recognizes listing options, targets and rejects shell compounds", () => {
    expect(commandPasses("ls", event("ls"))).toBe(true);
    expect(commandPasses("ls", event("ls", `${home}/archiwum`))).toBe(false);
    expect(commandPasses("ls-detail", event("ls -l archiwum"))).toBe(true);
    expect(
      commandPasses("ls-detail", event("ls -l .", `${home}/archiwum`)),
    ).toBe(true);
    expect(commandPasses("ls-detail", event("ls -l"))).toBe(false);
    expect(commandPasses("ls-detail", event("ls archiwum"))).toBe(false);
    expect(commandPasses("ls-detail", event("ls -l archiwum; true"))).toBe(
      false,
    );
    expect(commandPasses("ls-hidden", event("ls -la"))).toBe(true);
    expect(commandPasses("ls-hidden", event("ls -a -l ~", "/tmp"))).toBe(true);
    expect(commandPasses("ls-hidden", event("ls -l"))).toBe(false);
    expect(
      commandPasses("ls-hidden", event("ls -la", `${home}/archiwum`)),
    ).toBe(false);
  });
  it("accepts reading the story files from any directory", () => {
    expect(commandPasses("lab-read-message", event("cat ~/.wiadomosc"))).toBe(
      true,
    );
    expect(commandPasses("lab-read-message", event("cat .wiadomosc"))).toBe(
      true,
    );
    expect(
      commandPasses("lab-read-message", event("cat .wiadomosc", "/tmp")),
    ).toBe(false);
    expect(
      commandPasses(
        "lab-read-report",
        event("cat raport.txt", `${home}/archiwum`),
      ),
    ).toBe(true);
    expect(
      commandPasses("lab-read-report", event("cat ~/biezace/raport.txt", "/")),
    ).toBe(true);
    expect(commandPasses("lab-read-report", event("cat raport.txt"))).toBe(
      false,
    );
    expect(
      commandPasses("lab-read-report", {
        ...event("cat raport.txt", `${home}/archiwum`),
        status: 1,
      }),
    ).toBe(false);
  });
  it("checks successful navigation and the resulting directory", () => {
    expect(
      commandPasses(
        "cd-relative",
        event("cd archiwum", `${home}/archiwum`, "builtin"),
        home,
      ),
    ).toBe(true);
    expect(
      commandPasses(
        "cd-relative",
        event("cd ../archiwum", `${home}/archiwum`, "builtin"),
        `${home}/biezace`,
      ),
    ).toBe(false);
    expect(
      commandPasses(
        "cd-relative",
        event(`cd ${home}/archiwum`, `${home}/archiwum`, "builtin"),
        home,
      ),
    ).toBe(false);
    expect(
      commandPasses(
        "cd-absolute",
        event(`cd ${home}/biezace/`, `${home}/biezace`, "builtin"),
      ),
    ).toBe(true);
    expect(
      commandPasses(
        "cd-absolute",
        event("cd ~/biezace", `${home}/biezace`, "builtin"),
      ),
    ).toBe(false);
    expect(commandPasses("history", event("history", home, "builtin"))).toBe(
      true,
    );
  });
  it("limits result checks to commands that can change the expected files", () => {
    expect(resultCommandPasses("lab-copy", event("cp -v a b"))).toBe(true);
    expect(resultCommandPasses("lab-copy", event("mv a b"))).toBe(false);
    expect(resultCommandPasses("lab-move", event("mv a b"))).toBe(true);
    expect(resultCommandPasses("lab-note", event("nano notatka.txt"))).toBe(
      true,
    );
    expect(
      resultCommandPasses("lab-touch", { ...event("touch x"), status: 1 }),
    ).toBe(false);
  });
});
