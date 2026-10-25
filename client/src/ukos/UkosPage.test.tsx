import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import UkosPage from "./UkosPage";
import { mockRoomViewport } from '../test/roomViewport';
import { useCourse } from "./useCourse";
import { submitBugReport } from "../services/bugReportApi";
import {
  useWorkshop,
  type WorkshopOptions,
} from "../prototypes/ukos/useWorkshop";
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { username: "alice" }, sessionKey: "sessionKey" }),
}));
vi.mock("./useCourse", () => ({ useCourse: vi.fn() }));
vi.mock("../services/bugReportApi", () => ({ submitBugReport: vi.fn() }));
vi.mock("../prototypes/ukos/useWorkshop", () => ({ useWorkshop: vi.fn() }));
let course: ReturnType<typeof useCourse>;
let workshop: ReturnType<typeof useWorkshop>;
let options: WorkshopOptions | undefined;
let desktop = true;
const draw = () =>
  render(
    <MemoryRouter initialEntries={['/learn/ukos?view=lab']}>
      <UkosPage />
    </MemoryRouter>,
  );
beforeEach(() => {
  vi.mocked(submitBugReport).mockResolvedValue({ ok: true } as Response);
  mockRoomViewport();
  desktop = true;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? false : desktop,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  course = {
    completed: 0,
    state: { completedSteps: 0 },
    error: "",
    storageError: "",
    syncing: false,
    successCount: 0,
    synchronized: true,
    progress: vi.fn(),
    sync: vi.fn(),
  };
  workshop = {
    status: "stopped",
    step: 0,
    error: "",
    warning: "",
    lastCommand: null,
    metrics: null,
    download: null,
    saved: null,
    start: vi.fn(),
    stop: vi.fn(),
    send: vi.fn(),
    canReset: true,
  };
  vi.mocked(useCourse).mockImplementation(() => course);
  vi.mocked(useWorkshop).mockImplementation((_container, config) => {
    options = config;
    return workshop;
  });
});
it.each([
  [0, false, 'pwd'],
  [5, false, 'lab-directory'],
  [5, true, 'lab-read-message'],
  [15, false, 'history'],
] as const)("reports the displayed lab step at progress %i, review %s", async (completed, review, lessonId) => {
  course.completed = completed;
  workshop.step = completed;
  draw();
  fireEvent.click(screen.getByRole('button', { name: completed === 15 ? 'Wróć do ćwiczeń' : completed ? 'Kontynuuj ćwiczenia' : 'Rozpocznij dyżur' }));
  if (review) fireEvent.click(screen.getByRole('button', { name: 'Wstecz' }));
  const button = screen.getByRole('button', { name: 'Zgłoś błąd' });
  expect(button).toHaveClass('room-nav-report', 'is-icon');
  expect(button.closest('.room-nav')).not.toBeNull();
  fireEvent.click(button);
  const dialog = within(await screen.findByRole('dialog', { name: 'Zgłoś błąd' }));
  fireEvent.change(dialog.getByLabelText('Opis problemu'), { target: { value: 'Terminal nie reaguje na polecenie.' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Wyślij zgłoszenie' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(submitBugReport).toHaveBeenLastCalledWith({
    source: 'LAB', lessonId, pagePath: '/learn/ukos', description: 'Terminal nie reaguje na polecenie.',
  }, { sessionKey: 'sessionKey' });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("guides one active step, reveals hints only on request and allows review", () => {
  const view = draw();
  fireEvent.click(screen.getByRole("button", { name: "Rozpocznij dyżur" }));
  expect(options?.variant).toBe("lab");
  fireEvent.click(screen.getByRole("button", { name: "Podpowiedź" }));
  fireEvent.click(screen.getByRole("button", { name: "Podpowiedź" }));
  expect(
    screen.getByText("Wpisz pwd i zatwierdź Enterem."),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Uruchom terminal" }));
  expect(workshop.start).toHaveBeenCalled();
  act(() => options?.onProgress?.(1));
  expect(course.progress).toHaveBeenCalledWith(1);
  workshop = { ...workshop, step: 1, status: "ready" };
  view.rerender(
    <MemoryRouter>
      <UkosPage />
    </MemoryRouter>,
  );
  expect(
    screen.queryByText("Wpisz pwd i zatwierdź Enterem."),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Dalej" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Wstecz" }));
  expect(
    screen.getByRole("heading", { name: "Pierwszy dyżur" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Dalej" }));
  expect(
    screen.getByRole("heading", { name: "Co zastaliśmy na stanowisku?" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Kroki laboratorium" }));
  expect(
    screen.getByRole("button", { name: /Zajrzyj do archiwum/ }),
  ).toBeDisabled();
  const done = screen.getByRole("button", { name: /Pierwszy dyżur/ });
  expect(done).toHaveAccessibleName("Pierwszy dyżur, ukończone");
  fireEvent.click(done);
  expect(
    screen.queryByRole("navigation", { name: "Kroki laboratorium" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Wróć do bieżącego zadania" }),
  );
  expect(
    screen.getByRole("heading", { name: "Co zastaliśmy na stanowisku?" }),
  ).toBeInTheDocument();
});
it("saves, pauses and resets files, then waits for the worker to stop before leaving", () => {
  workshop = {
    ...workshop,
    status: "ready",
    saved: { type: "saved", bytes: 10, elapsedMs: 2, savedAt: Date.now() },
  };
  const view = draw();
  fireEvent.click(screen.getByRole("button", { name: "Rozpocznij dyżur" }));
  fireEvent.click(screen.getByRole("button", { name: "Zapisz pliki" }));
  fireEvent.click(screen.getByRole("button", { name: "Pauza" }));
  expect(workshop.send).toHaveBeenLastCalledWith({
    type: "pause",
    paused: true,
  });
  workshop.status = "paused";
  view.rerender(
    <MemoryRouter>
      <UkosPage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Wznów" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Odtwórz pliki bieżącego kroku" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Anuluj" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Odtwórz pliki bieżącego kroku" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Odtwórz warsztat" }));
  expect(workshop.send).toHaveBeenLastCalledWith({ type: "reset" });
  fireEvent.click(screen.getByRole("button", { name: "Zapisz i wróć" }));
  expect(workshop.stop).toHaveBeenCalled();
  workshop.status = "stopped";
  view.rerender(
    <MemoryRouter>
      <UkosPage />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("button", { name: "Rozpocznij dyżur" }),
  ).toBeInTheDocument();
});
it("completes the room after the last exercise without an exam", () => {
  course.completed = 15;
  course.state = { completedSteps: 15 };
  draw();
  expect(
    screen.getByRole("heading", { name: "Dyżur przekazany. Dobra robota." }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/egzamin/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Wróć do ćwiczeń" }));
  expect(
    screen.getByRole("heading", { name: "Stanowisko gotowe." }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Zakończ dyżur" }));
  expect(
    screen.getByRole("button", { name: "Wróć do ćwiczeń" }),
  ).toBeInTheDocument();
});
it("disables the mobile terminal and exposes sync failures", () => {
  desktop = false;
  course.error = "Offline";
  course.synchronized = false;
  draw();
  expect(
    screen.getByRole("button", { name: "Rozpocznij dyżur" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Ponów synchronizację" }));
  expect(course.sync).toHaveBeenCalled();
  expect(document.querySelector('.room-mascot-zone')).toBeNull();
});

it("keeps Bit in the footer lane, celebrates only confirmed progress and ignores review", () => {
  vi.useFakeTimers();
  course = { ...course, completed: 5, state: { completedSteps: 5 } };
  workshop = { ...workshop, step: 5 };
  const view = draw();
  fireEvent.click(screen.getByRole("button", { name: "Kontynuuj ćwiczenia" }));
  const zone = () => document.querySelector('.room-mascot-zone');
  expect(screen.getByRole('heading', { name: 'Miejsce na sprawy w toku' })).toBeInTheDocument();
  expect(zone()?.parentElement).toHaveClass('room-footer-lane');
  expect(document.querySelector('.room-split-companion')).toBeNull();
  expect(zone()?.closest('.room-body-shell, .zero-terminal-pane, .zero-start, .room-pane-scroll')).toBeNull();
  expect(zone()).toHaveAttribute('data-state', 'idle');
  fireEvent.click(screen.getByRole('button', { name: 'Podpowiedź' }));
  act(() => options?.onProgress?.(6, true));
  expect(course.progress).toHaveBeenCalledWith(6, true);
  expect(zone()).toHaveAttribute('data-state', 'idle');
  workshop = { ...workshop, status: 'ready', step: 6 };
  view.rerender(<MemoryRouter><UkosPage /></MemoryRouter>);
  expect(zone()).toHaveAttribute('data-state', 'idle');
  course = { ...course, completed: 6, state: { completedSteps: 6 }, successCount: 1 };
  view.rerender(<MemoryRouter><UkosPage /></MemoryRouter>);
  expect(zone()).toHaveAttribute('data-state', 'jump');
  act(() => vi.advanceTimersByTime(640));
  expect(zone()).toHaveAttribute('data-state', 'idle');
  fireEvent.click(screen.getByRole('button', { name: 'Wstecz' }));
  expect(zone()).toHaveAttribute('data-state', 'idle');
  expect(zone()?.parentElement).toHaveClass('room-footer-lane');
});
it("shows how much of Linux is downloaded and then waits for the system to boot", () => {
  workshop = { ...workshop, status: "booting" };
  const view = draw();
  fireEvent.click(screen.getByRole("button", { name: "Rozpocznij dyżur" }));
  expect(
    screen.getByRole("progressbar", { name: "Przygotowanie terminala" }),
  ).not.toHaveAttribute("aria-valuenow");
  workshop = { ...workshop, download: { loaded: 0, total: 0 } };
  view.rerender(
    <MemoryRouter>
      <UkosPage />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("progressbar", { name: "Przygotowanie terminala" }),
  ).toBeInTheDocument();
  workshop = {
    ...workshop,
    download: { loaded: 12_600_000, total: 25_200_000 },
  };
  view.rerender(
    <MemoryRouter>
      <UkosPage />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("progressbar", { name: "Pobieranie Linuksa" }),
  ).toHaveAttribute("aria-valuenow", "50");
  expect(screen.getByText("Pobrano 12,6 z 25,2 MB")).toBeInTheDocument();
  expect(screen.getByText("50%")).toBeInTheDocument();
  workshop = {
    ...workshop,
    download: { loaded: 25_200_000, total: 25_200_000 },
  };
  view.rerender(
    <MemoryRouter>
      <UkosPage />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("progressbar", { name: "Uruchamianie systemu" }),
  ).not.toHaveAttribute("aria-valuenow");
  workshop = { ...workshop, status: "ready" };
  view.rerender(
    <MemoryRouter>
      <UkosPage />
    </MemoryRouter>,
  );
  expect(screen.queryByRole("progressbar", { name: /Uruchamianie/ })).not.toBeInTheDocument();
});
