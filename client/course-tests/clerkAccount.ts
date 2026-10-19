import { randomUUID } from "node:crypto";
import { clerk } from "@clerk/testing/playwright";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API_URL = "http://localhost:8080";
const CLERK_API_URL = process.env.CLERK_API_URL ?? "https://api.clerk.com";
const AVATAR = {
  outfit: "bluza",
  hair: "irokez",
  hat: "brak",
  skin: "oliwkowa",
  hairColor: "niebieskie",
  topColor: "bordowy",
  bottomColor: "granatowy",
  shoesColor: "bialy",
  hatColor: "czerwony",
  pose: "profil",
};

export interface CourseAccount {
  email: string;
  clerkUserId: string;
}

function secretKey() {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) {
    throw new Error("Course tests need the Clerk Development secret key in CLERK_SECRET_KEY.");
  }
  return key;
}

function clerkHeaders() {
  return { Authorization: `Bearer ${secretKey()}` };
}

export async function createAccount(request: APIRequestContext, prefix: string): Promise<CourseAccount> {
  const email = `${prefix}${Date.now()}+clerk_test@example.com`;
  const response = await request.post(`${CLERK_API_URL}/v1/users`, {
    headers: clerkHeaders(),
    data: {
      email_address: [email],
      password: `Hk-${randomUUID()}`,
      skip_password_checks: true,
      skip_legal_checks: true,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const { id } = (await response.json()) as { id: string };
  return { email, clerkUserId: id };
}

export async function deleteAccount(request: APIRequestContext, account: CourseAccount | undefined) {
  if (!account) return;
  await request.delete(`${CLERK_API_URL}/v1/users/${account.clerkUserId}`, { headers: clerkHeaders() });
}

export async function signIn(page: Page, account: CourseAccount) {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: account.email });
}

export async function sessionToken(page: Page) {
  const token = await page.evaluate(async () => {
    const browser = window as unknown as { Clerk?: { session?: { getToken(): Promise<string | null> } } };
    return (await browser.Clerk?.session?.getToken()) ?? null;
  });
  if (!token) throw new Error("Clerk did not return a session token");
  return token;
}

export async function apiHeaders(page: Page) {
  return { Authorization: `Bearer ${await sessionToken(page)}` };
}

export async function finishOnboarding(page: Page, request: APIRequestContext) {
  const avatar = await request.post(`${API_URL}/api/user/me/onboarding/avatar`, {
    headers: await apiHeaders(page),
    data: AVATAR,
  });
  expect(avatar.ok(), await avatar.text()).toBeTruthy();
  const tour = await request.post(`${API_URL}/api/user/me/onboarding/tour`, {
    headers: await apiHeaders(page),
    data: { status: "SKIPPED" },
  });
  expect(tour.ok(), await tour.text()).toBeTruthy();
}
