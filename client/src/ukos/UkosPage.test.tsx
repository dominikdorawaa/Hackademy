import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import UkosPage from "./UkosPage";
import { useCourse } from "./useCourse";
import {
  useWorkshop,
  type WorkshopOptions,
} from "../prototypes/ukos/useWorkshop";
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { sub: "alice" }, token: "token" }),
}));
vi.mock("./useCourse", () => ({ useCourse: vi.fn() }));
vi.mock("../prototypes/ukos/useWorkshop", () => ({ useWorkshop: vi.fn() }));
let course: ReturnType<typeof useCourse>;
let workshop: ReturnType<typeof useWorkshop>;
let options: WorkshopOptions | undefined;
let desktop = true;
const draw = () =>
  render(
    <MemoryRouter>
      <UkosPage />
    </MemoryRouter>,
  );
beforeEach(() => {
  desktop = true;
  vi.stubGlobal("matchMedia", () => ({
    matches: desktop,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  course = {
    completed: 0,
    state: { completedSteps: 0 },
    error: "",
    storageError: "",
    syncing: false,
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
  fireEvent.click(screen.getByRole("button", { name: /✓.*Pierwszy dyżur/ }));
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
it("makes mobile read-only and exposes sync failures", () => {
  desktop = false;
  course.error = "Offline";
  course.synchronized = false;
  draw();
  expect(
    screen.getByRole("button", { name: "Rozpocznij dyżur" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Ponów synchronizację" }));
  expect(course.sync).toHaveBeenCalled();
  fireEvent.click(screen.getByText("Przeczytaj materiały Laboratorium 1"));
  expect(
    screen.getByRole("heading", { name: "Twój ślad pracy" }),
  ).toBeInTheDocument();
});
