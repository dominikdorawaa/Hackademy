import { clerkSetup } from "@clerk/testing/playwright";
import { loadEnv } from "vite";

export default async function globalSetup() {
  const env = loadEnv("development", process.cwd(), "");
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? env.VITE_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey?.startsWith("pk_test_")) {
    throw new Error("Course tests need the Clerk Development publishable key.");
  }
  await clerkSetup({ publishableKey, dotenv: false });
}
