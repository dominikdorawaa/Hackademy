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

async function terminalFits(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const host = document
          .querySelector(".zero-terminal")!
          .getBoundingClientRect();
        const screen = document
          .querySelector(".xterm-screen")!
          .getBoundingClientRect();
        const footer = document
          .querySelector(".zero-terminal-toolbar")!
          .getBoundingClientRect();
        const lesson = document
          .querySelector(".zero-lesson-pane")!
          .getBoundingClientRect();
        const panel = document
          .querySelector(".zero-terminal-pane")!
          .getBoundingClientRect();
        const terminal = document.querySelector(".xterm")!;
        const viewport = terminal.querySelector(".xterm-viewport")!;
        const viewportStyle = getComputedStyle(viewport);
        const scrollbars = [...terminal.querySelectorAll(".scrollbar")];
        return (
          screen.left >= host.left &&
          screen.right <= host.right &&
          screen.top >= host.top &&
          screen.bottom <= host.bottom &&
          screen.bottom <= footer.top &&
          Math.abs(lesson.top - panel.top) < 1 &&
          Math.abs(lesson.bottom - panel.bottom) < 1 &&
          getComputedStyle(terminal).backgroundColor === "rgb(11, 18, 32)" &&
          viewportStyle.backgroundColor === "rgba(0, 0, 0, 0)" &&
          viewportStyle.overflowY === "hidden" &&
          viewport.clientWidth ===
            Math.round(viewport.getBoundingClientRect().width) &&
          scrollbars.every((bar) => getComputedStyle(bar).display === "none") &&
          document.documentElement.scrollWidth <= window.innerWidth
        );
      }),
    )
    .toBe(true);
}

test("fits the terminal at different viewport sizes and requires the new directory in home", async ({
  page,
  request,
}, testInfo) => {
  account = await createAccount(request, "layout");
  await signIn(page, account);
  await finishOnboarding(page, request);
  expect(
    (
      await request.put(`${API_URL}/api/ukos/lab-1/progress`, {
        headers: await apiHeaders(page),
        data: { completedSteps: 5 },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/learn/ukos");
  await expect(page.getByText("5 z 15 ćwiczeń ukończonych")).toBeVisible();
  await page.getByRole("button", { name: "Kontynuuj ćwiczenia" }).click();
  const targets = page.getByRole("list", { name: "Wymagane katalogi" });
  await expect(targets.locator("code")).toHaveText(["~/biezace"]);
  await page.getByRole("button", { name: "Uruchom terminal" }).click();
  await expect(page.getByText("Linux gotowy", { exact: true })).toBeVisible();
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await terminalFits(page);
  }
  const command = async (text: string) => {
    await page.locator(".xterm-helper-textarea").fill(text);
    await page.locator(".xterm-helper-textarea").press("Enter");
  };
  await command("cd archiwum");
  await command("mkdir biezace");
  await command("ls");
  await expect(page.locator(".xterm-rows")).toContainText("raport.txt");
  await expect(
    page.getByRole("progressbar", { name: "Postęp ćwiczeń" }),
  ).toHaveAttribute("aria-valuenow", "5");
  await command("mkdir ~/biezace");
  await expect(
    page.getByRole("progressbar", { name: "Postęp ćwiczeń" }),
  ).toHaveAttribute("aria-valuenow", "6");
  await terminalFits(page);
  await command("seq 1 120");
  await expect(page.locator(".xterm-rows")).toContainText("120");
  await terminalFits(page);
  await page.locator(".xterm-screen").hover();
  await page.mouse.wheel(0, -1500);
  await expect
    .poll(() => page.locator(".xterm-rows").innerText())
    .not.toContain("120");
  await expect
    .poll(async () => {
      await page.mouse.wheel(0, 2000);
      return page.locator(".xterm-rows").innerText();
    })
    .toContain("120");
  await terminalFits(page);
  await page
    .locator(".zero-terminal-pane")
    .screenshot({ path: testInfo.outputPath("terminal-panel.png") });
  await page.screenshot({
    path: testInfo.outputPath("aligned-terminal.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Zapisz i wróć" }).click();
  await expect(
    page.getByRole("button", { name: "Kontynuuj ćwiczenia" }),
  ).toBeVisible();
});
