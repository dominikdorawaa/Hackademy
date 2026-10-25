import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

// The sign-up never gets verified, so no Clerk user is left behind.
async function reachWrongCode(page: Page) {
  await setupClerkTestingToken({ page });
  await page.goto("/register");
  await page.locator("input[name=emailAddress]").fill(`otp${Date.now()}+clerk_test@example.com`);
  const password = page.locator("input[name=password]");
  if (await password.isVisible()) await password.fill(`Hk-${Date.now()}-otp-check`);
  await page.locator(".cl-formButtonPrimary").click();
  await page.locator(".cl-otpCodeFieldInput").first().click();
  // +clerk_test addresses accept only 424242, so this code is always rejected.
  await page.keyboard.type("111111");
  await expect(page.locator(".cl-otpCodeFieldErrorText")).toBeVisible();
}

async function bounds(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const error = rect(".cl-otpCodeFieldErrorText");
    return {
      error,
      field: rect(".cl-otpCodeField"),
      inputs: rect(".cl-otpCodeFieldInputs"),
      resend: rect(".cl-formResendCodeLink"),
      fitsViewport: error.right <= window.innerWidth && document.documentElement.scrollWidth <= window.innerWidth,
    };
  });
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }]) {
  test(`keeps the wrong-code message readable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await reachWrongCode(page);
    await expect.poll(async () => {
      const { error, field, inputs, resend, fitsViewport } = await bounds(page);
      return (
        error.left >= field.left - 1 &&
        error.right <= field.right + 1 &&
        error.width >= inputs.width - 1 &&
        error.bottom <= resend.top &&
        fitsViewport
      );
    }).toBe(true);
  });
}
