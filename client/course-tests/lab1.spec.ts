import { expect, test, type Page } from "@playwright/test";
import {
  API_URL,
  apiHeaders,
  createAccount,
  deleteAccount,
  finishOnboarding,
  signIn,
  type CourseAccount,
} from "./clerkAccount";

let account: CourseAccount | undefined;

test.afterEach(async ({ request }) => {
  await deleteAccount(request, account);
  account = undefined;
});

test("full account-backed lab, restoration on a new device and room completion", async ({
  page,
  request,
  browser,
}) => {
  account = await createAccount(request, "ukos");
  await signIn(page, account);
  await finishOnboarding(page, request);
  await page.goto("/learn");
  await page.getByRole("link", { name: /Dyżur Zero/ }).click();
  await expect(page.getByText("Postęp zapisany na koncie")).toBeVisible();
  await page.getByRole("button", { name: "Rozpocznij dyżur" }).click();
  await page.getByRole("button", { name: "Uruchom terminal" }).click();
  await expect(page.getByText("Linux gotowy", { exact: true })).toBeVisible();
  const command = async (target: Page, text: string) => {
    await target.locator(".xterm-helper-textarea").fill(text);
    await target.locator(".xterm-helper-textarea").press("Enter");
  };
  const step = async (text: string, next: number) => {
    await command(page, text);
    await expect(
      page.getByRole("progressbar", { name: "Postęp ćwiczeń" }),
    ).toHaveAttribute("aria-valuenow", String(next));
  };
  await command(page, "echo pwd");
  await expect(
    page.getByRole("progressbar", { name: "Postęp ćwiczeń" }),
  ).toHaveAttribute("aria-valuenow", "0");
  await step("pwd", 1);
  await step("ls", 2);
  await step("ls -l", 2);
  await step("ls -l archiwum", 3);
  await step("ls -la", 4);
  await step("cat ~/.wiadomosc", 5);
  await expect(page.locator(".xterm-rows")).toContainText(
    "Wiadomość od nocnej zmiany",
  );
  await step("mkdir ~/biezace", 6);
  await step("rmdir ~/archiwum/tymczasowe", 7);
  await step("cd biezace", 7);
  await step("cd ../archiwum", 7);
  await step("cd", 7);
  await step("cd archiwum", 8);
  await step("cat raport.txt", 9);
  await expect(page.locator(".xterm-rows")).toContainText(
    "RAPORT ZMIANY NOCNEJ",
  );
  await step("mv raport.txt ~/biezace/", 9);
  await step("cp ~/biezace/raport.txt raport-kopia.txt", 11);
  await step("cd /home/student/biezace", 12);
  await step("touch notatka.txt", 13);
  await command(page, "nano notatka.txt");
  await expect(page.locator(".xterm-screen")).toContainText("GNU nano");
  await page.locator(".xterm-helper-textarea").fill("Gotowy do pracy");
  await page.locator(".xterm-helper-textarea").press("Control+o");
  await page.locator(".xterm-helper-textarea").press("Enter");
  await page.locator(".xterm-helper-textarea").press("Control+x");
  await expect(
    page.getByRole("progressbar", { name: "Postęp ćwiczeń" }),
  ).toHaveAttribute("aria-valuenow", "14");
  await step("history", 15);
  await expect(
    page.getByRole("heading", { name: "Stanowisko gotowe." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zakończ dyżur" }).click();
  await expect(
    page.getByRole("heading", { name: "Dyżur przekazany. Dobra robota." }),
  ).toBeVisible();
  await expect(page.getByText(/egzamin/i)).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`${API_URL}/api/ukos/lab-1`, {
              headers: await apiHeaders(page),
            })
          ).json()
        ).completedSteps,
    )
    .toBe(15);
  const second = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const restored = await second.newPage();
  await signIn(restored, account);
  await restored.goto("http://localhost:5173/learn/ukos");
  await expect(restored.getByText("15 z 15 ćwiczeń ukończonych")).toBeVisible();
  await restored.getByRole("button", { name: "Wróć do ćwiczeń" }).click();
  await restored.getByRole("button", { name: "Uruchom terminal" }).click();
  await expect(
    restored.getByText("Linux gotowy", { exact: true }),
  ).toBeVisible();
  await command(restored, "cat ~/biezace/notatka.txt; ls ~/archiwum");
  await expect(restored.locator(".xterm-rows")).toContainText(
    "Gotowy do pracy",
  );
  await expect(restored.locator(".xterm-rows")).toContainText(
    "raport-kopia.txt",
  );
  await restored.getByRole("button", { name: "Zakończ dyżur" }).click();
  await expect(
    restored.getByRole("heading", {
      name: "Dyżur przekazany. Dobra robota.",
    }),
  ).toBeVisible();
  await second.close();
  await page.screenshot({
    path: test.info().outputPath("complete.png"),
    fullPage: true,
  });
});

test("starts over a 10 Mbps connection with slower CPU and keeps the page responsive", async ({
  page,
  request,
}, testInfo) => {
  account = await createAccount(request, "slow");
  await signIn(page, account);
  await finishOnboarding(page, request);
  await page.goto("/learn/ukos");
  await page.getByRole("button", { name: "Rozpocznij dyżur" }).click();
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 100,
    downloadThroughput: 1250000,
    uploadThroughput: 625000,
  });
  const started = Date.now();
  await page.getByRole("button", { name: "Uruchom terminal" }).click();
  await expect(page.getByText("Linux gotowy", { exact: true })).toBeVisible({
    timeout: 60000,
  });
  const bootMs = Date.now() - started;
  await page.locator(".xterm-helper-textarea").fill("while true; do :; done");
  await page.locator(".xterm-helper-textarea").press("Enter");
  await page.getByRole("button", { name: "Podpowiedź" }).click();
  await expect(page.getByText(/pwd to skrót/)).toBeVisible();
  const frames = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const samples: number[] = [];
        let previous = performance.now();
        const frame = (now: number) => {
          samples.push(now - previous);
          previous = now;
          if (samples.length === 120) resolve(samples);
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
  );
  const p95 = frames.sort((a, b) => a - b)[113];
  expect(p95).toBeLessThan(50);
  await page.locator(".xterm-helper-textarea").press("Control+c");
  await page.getByRole("button", { name: "Zapisz i wróć" }).click();
  await expect(
    page.getByRole("button", { name: "Rozpocznij dyżur" }),
  ).toBeVisible();
  await testInfo.attach("slow-device-metrics", {
    body: JSON.stringify({
      cpuThrottle: 4,
      Mbps: 10,
      latencyMs: 100,
      bootMs,
      rafP95Ms: p95,
    }),
    contentType: "application/json",
  });
  console.log(JSON.stringify({ slowBootMs: bootMs, slowRafP95Ms: p95 }));
});
