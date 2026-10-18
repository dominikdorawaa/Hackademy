import { useRef, useState } from "react";
import { steps } from "./protocol";
import { useWorkshop } from "./useWorkshop";
import { useResponsiveness } from "./useResponsiveness";

const statusLabels: Record<string, string> = {
  stopped: "Warsztat zatrzymany",
  booting: "Uruchamianie Linuksa",
  ready: "Linux gotowy",
  paused: "Emulator wstrzymany",
  error: "Nie udało się uruchomić",
};

export default function Prototype() {
  const container = useRef<HTMLDivElement>(null);
  const workshop = useWorkshop(container);
  const frames = useResponsiveness();
  const [hint, setHint] = useState<number | null>(null);
  const [clicks, setClicks] = useState(0);
  const [resetConfirmation, setResetConfirmation] = useState(false);
  const current = steps[workshop.step];
  const running = workshop.status === "ready";
  const stopped = workshop.status === "stopped";
  return (
    <div className="ukos-prototype">
      <header className="ukos-header">
        <a href="/" className="ukos-brand">
          hackademy<span>/ warsztat</span>
        </a>
        <span className="ukos-tag">Prototyp techniczny</span>
      </header>
      <section className="ukos-intro">
        <p className="ukos-eyebrow">UKOS · LABORATORIUM 01</p>
        <h1>
          Dyżur Zero<span>Pierwszy kontakt z systemem.</span>
        </h1>
        <p>
          Twój pierwszy dyżur w zespole Hackademy. Poznaj warsztat, zabezpiecz
          raport i uporządkuj archiwum.
        </p>
        <p className="ukos-prototype-note">
          Test środowiska: sześć kroków, lokalny zapis i pomiary. Postęp nie
          łączy się jeszcze z kontem. Finał egzaminacyjny powstanie w kolejnym
          etapie.
        </p>
      </section>
      <div className="ukos-workspace">
        <section className="ukos-lesson" aria-label="Aktualne ćwiczenie">
          <div className="ukos-progress">
            <span>Sprawdzenie środowiska</span>
            <strong>
              {workshop.step} / {steps.length}
            </strong>
          </div>
          <progress
            value={workshop.step}
            max={steps.length}
            aria-label="Zaliczone kroki"
          />
          {current ? (
            <>
              <p className="ukos-eyebrow">KROK {workshop.step + 1}</p>
              <h2>{current.title}</h2>
              <p>{current.description}</p>
              <p className="ukos-help">
                Po poprawnym wykonaniu zadanie zaliczy się automatycznie.
              </p>
              <button
                className="ukos-text-button"
                onClick={() =>
                  setHint(hint === workshop.step ? null : workshop.step)
                }
                aria-expanded={hint === workshop.step}
              >
                Podpowiedź
              </button>
              {hint === workshop.step && (
                <div className="ukos-hint">{current.hint}</div>
              )}
            </>
          ) : (
            <div role="status">
              <p className="ukos-eyebrow">TEST UKOŃCZONY</p>
              <h2>Archiwum uporządkowane.</h2>
              <p>
                Komendy, edytor i sprawdzanie plików działają razem. Możesz
                dalej eksperymentować w terminalu.
              </p>
            </div>
          )}
          <ol className="ukos-step-list">
            {steps.map((step, index) => (
              <li
                key={step.id}
                aria-current={index === workshop.step ? "step" : undefined}
              >
                <span>
                  {index < workshop.step
                    ? "✓"
                    : String(index + 1).padStart(2, "0")}
                </span>
                {step.title}
              </li>
            ))}
          </ol>
        </section>
        <section className="ukos-terminal-panel" aria-label="Warsztat Linux">
          <div className="ukos-terminal-bar">
            <span>
              <i data-status={workshop.status} />
              {statusLabels[workshop.status]}
            </span>
            <span>Bash · Alpine Linux · v86</span>
          </div>
          <div className="ukos-terminal" ref={container} />
          {stopped && (
            <div className="ukos-start">
              <div>
                <h2>Twój własny Linux.</h2>
                <p>
                  Środowisko uruchomi się w tej przeglądarce po naciśnięciu
                  przycisku. Nie ma dostępu do plików Twojego komputera.
                </p>
                <button
                  className="ukos-primary"
                  onClick={() => void workshop.start()}
                >
                  Uruchom warsztat <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          )}
          {workshop.status === "booting" && (
            <div className="ukos-loading" role="status">
              Uruchamianie Linuksa. Pierwszy start wymaga pobrania obrazu.
            </div>
          )}
          {workshop.error && (
            <div className="ukos-error" role="alert">
              {workshop.error}
            </div>
          )}
          {workshop.warning && (
            <div className="ukos-warning" role="alert">
              {workshop.warning}
            </div>
          )}
          <div className="ukos-controls">
            <span role="status">
              {workshop.saved
                ? `Pliki zapisane lokalnie o ${new Date(workshop.saved.savedAt).toLocaleTimeString("pl-PL")}`
                : "Brak potwierdzonego zapisu"}
            </span>
            <div>
              <button
                disabled={!running}
                onClick={() => workshop.send({ type: "save" })}
              >
                Zapisz teraz
              </button>
              <button
                disabled={!running && workshop.status !== "paused"}
                onClick={() =>
                  workshop.send({ type: "pause", paused: running })
                }
              >
                {workshop.status === "paused" ? "Wznów" : "Pauza"}
              </button>
              <button disabled={stopped} onClick={workshop.stop}>
                Zatrzymaj
              </button>
            </div>
          </div>
        </section>
      </div>
      <section className="ukos-diagnostics" aria-label="Pomiary prototypu">
        <div>
          <span>Start do gotowego Basha</span>
          <strong>
            {workshop.metrics
              ? `${(workshop.metrics.bootMs / 1000).toFixed(2)} s`
              : "oczekuje"}
          </strong>
        </div>
        <div>
          <span>Pamięć przydzielona Linuksowi</span>
          <strong>
            {workshop.metrics
              ? `${workshop.metrics.guestMemoryMiB} MiB`
              : "oczekuje"}
          </strong>
        </div>
        <div>
          <span>Odstęp klatek p95 / maksimum</span>
          <strong>
            {frames.p95.toFixed(1)} / {frames.max.toFixed(1)} ms
          </strong>
        </div>
        <div>
          <span>Długie zadania głównego wątku</span>
          <strong>{frames.longTasks}</strong>
        </div>
        <div>
          <span>Zapis plików / czas</span>
          <strong>
            {workshop.saved
              ? `${workshop.saved.bytes} B / ${workshop.saved.elapsedMs.toFixed(0)} ms`
              : "oczekuje"}
          </strong>
        </div>
        <div>
          <span>Odtworzono poprzednią pracę</span>
          <strong>
            {workshop.metrics
              ? workshop.metrics.restored
                ? "tak"
                : "nie"
              : "oczekuje"}
          </strong>
        </div>
      </section>
      <section className="ukos-test-controls">
        <div>
          <button onClick={() => setClicks((value) => value + 1)}>
            Sprawdź reakcję strony: {clicks}
          </button>
          <p>
            Ten przycisk powinien reagować również podczas obciążania Linuksa.
          </p>
        </div>
        <div>
          {!resetConfirmation ? (
            <button
              disabled={!workshop.canReset}
              onClick={() => setResetConfirmation(true)}
            >
              Resetuj pliki warsztatu
            </button>
          ) : (
            <>
              <span>Usunąć pliki i odtworzyć bieżący krok? </span>
              <button
                onClick={() => {
                  workshop.send({ type: "reset" });
                  setResetConfirmation(false);
                }}
              >
                Tak, resetuj pliki
              </button>
              <button onClick={() => setResetConfirmation(false)}>
                Anuluj
              </button>
            </>
          )}
        </div>
      </section>
      <details className="ukos-debug">
        <summary>Ostatnie zdarzenie z Basha</summary>
        <pre>
          {workshop.lastCommand
            ? JSON.stringify(workshop.lastCommand, null, 2)
            : "Brak zdarzeń"}
        </pre>
        <p>
          Ocena poleceń pochodzi z osobnego kanału Basha. Ocena plików sprawdza
          stan systemu, niezależnie od tekstu wyświetlanego w terminalu.
        </p>
      </details>
      <footer className="ukos-footer">
        Warsztat jest lokalny. Usunięcie danych przeglądarki usuwa jego pliki.
        „Zatrzymaj” kończy proces emulatora i zwalnia jego pamięć. W nano
        zapisuj pliki przez Ctrl+O. Niezapisany tekst edytora nie wróci po
        odświeżeniu.
      </footer>
    </div>
  );
}
