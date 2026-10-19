import { request } from "../services/http";

export type CourseState = {
  completedSteps: number;
};

export class CourseError extends Error {
  constructor(public readonly status: number) {
    super(
      status === 401 || status === 403
        ? "Sesja wygasła. Zaloguj się ponownie."
        : "Nie udało się połączyć z serwerem. Spróbuj ponownie.",
    );
  }
}

export async function courseRequest(
  sessionKey: string,
  completedSteps?: number,
): Promise<CourseState> {
  const update = completedSteps !== undefined;
  const response = await request<CourseState>(
    `/api/ukos/lab-1${update ? "/progress" : ""}`,
    {
      method: update ? "PUT" : "GET",
      auth: { sessionKey },
      ...(update ? { body: JSON.stringify({ completedSteps }) } : {}),
    },
  );
  if (!response.ok) throw new CourseError(response.status);
  return response.json();
}
