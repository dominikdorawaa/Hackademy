import { beforeEach, expect, it, vi } from "vitest";
import { courseRequest, CourseError } from "./api";
import { request } from "../services/http";
vi.mock("../services/http", () => ({ request: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it("uses authenticated GET and progress PUT", async () => {
  vi.mocked(request).mockResolvedValue({
    ok: true,
    json: async () => ({ completedSteps: 3 }),
  } as never);
  expect(await courseRequest("token")).toEqual({ completedSteps: 3 });
  expect(request).toHaveBeenLastCalledWith(
    "/api/ukos/lab-1",
    expect.objectContaining({
      method: "GET",
      headers: expect.objectContaining({ Authorization: "Bearer token" }),
    }),
  );
  await courseRequest("token", 4);
  expect(request).toHaveBeenLastCalledWith(
    "/api/ukos/lab-1/progress",
    expect.objectContaining({ method: "PUT", body: '{"completedSteps":4}' }),
  );
});
it("reports authentication and server failures", async () => {
  for (const status of [401, 403, 500]) {
    vi.mocked(request).mockResolvedValue({ ok: false, status } as never);
    await expect(courseRequest("token")).rejects.toBeInstanceOf(CourseError);
    expect(new CourseError(status).message.length).toBeGreaterThan(10);
  }
});
