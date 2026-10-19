import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWorkshop } from "../prototypes/ukos/useWorkshop";
import { lessons, upcomingLabs } from "./content";
import { useCourse } from "./useCourse";
import "@xterm/xterm/css/xterm.css";
import "./ukos.css";

type Course = ReturnType<typeof useCourse>;

function Workshop({
  course,
  account,
  onExit,
}: {
  course: Course;
  account: string;
  onExit: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [hintState, setHintState] = useState({ step: -1, count: 0 });
  const [reading, setReading] = useState<number | null>(null);
  const [reset, setReset] = useState(false);
  const [exiting, setExiting] = useState(false);
  const workshop = useWorkshop(container, {
    account,
    variant: "lab",
    initialStep: course.completed,
    onProgress: course.progress,
  });
  const current = Math.max(course.completed, workshop.step);
  const selected = reading ?? Math.min(current, lessons.length - 1);
  const lesson = lessons[selected];
  const hintCount = hintState.step === selected ? hintState.count : 0;

  useEffect(() => {
    if (exiting && workshop.status === "stopped") onExit();
  }, [exiting, workshop.status, onExit]);

  const leave = () => {
    if (workshop.status === "stopped") onExit();
    else {
      setExiting(true);
      workshop.stop();
    }
  };

  return (
    <section className="zero-workshop" aria-label="Warsztat ćwiczeń">
      <div className="zero-lesson">
        <div className="zero-progress-label">
          <span>Ćwiczenia</span>
          <strong>
            {Math.min(current, lessons.length)} / {lessons.length}
          </strong>
        </div>
        <progress
          value={Math.min(current, lessons.length)}
          max={lessons.length}
          aria-label="Postęp ćwiczeń"
        />
        {current >= lessons.length && reading === null ? (
          <>
            <span className="zero-kicker">LABORATORIUM 1 UKOŃCZONE</span>
            <h2>Stanowisko gotowe.</h2>
            <p>
              Potrafisz już odnaleźć pliki, uporządkować je i zostawić wiadomość
              zespołowi. Możesz dalej ćwiczyć w terminalu albo wrócić do mapy
              kursu.
            </p>
            <button onClick={leave}>Zakończ dyżur</button>
          </>
        ) : (
          <article key={selected}>
            <span className="zero-kicker">
              KROK {selected + 1}
              {selected < current ? " · UKOŃCZONY" : ""}
            </span>
            <h2>{lesson.title}</h2>
            <p>{lesson.intro}</p>
            <div className="zero-task">
              <strong>Twoje zadanie</strong>
              <p>{lesson.task}</p>
              {"targets" in lesson && (
                <ul className="zero-task-paths" aria-label="Wymagane katalogi">
                  {lesson.targets.map((path) => (
                    <li key={path}>
                      <code>{path}</code>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selected === current && (
              <>
                <p className="zero-muted">
                  Po poprawnym wykonaniu zadanie zaliczy się automatycznie.
                  Pracuj nad bieżącym krokiem.
                </p>
                <button
                  className="zero-text-button"
                  onClick={() =>
                    setHintState({
                      step: selected,
                      count: Math.min(hintCount + 1, lesson.hints.length),
                    })
                  }
                >
                  Podpowiedź
                </button>
                {lesson.hints.slice(0, hintCount).map((hint) => (
                  <p className="zero-hint" key={hint}>
                    {hint}
                  </p>
                ))}
              </>
            )}
            {reading !== null && (
              <button
                onClick={() => {
                  setReading(null);
                  setHintState({ step: -1, count: 0 });
                }}
              >
                Wróć do bieżącego zadania
              </button>
            )}
          </article>
        )}
        <nav className="zero-step-list" aria-label="Kroki laboratorium">
          {lessons.map((item, index) => (
            <button
              key={item.id}
              disabled={index > current}
              aria-current={index === current ? "step" : undefined}
              onClick={() => {
                setReading(index === current ? null : index);
                setHintState({ step: -1, count: 0 });
              }}
            >
              <span>
                {index < current ? "✓" : String(index + 1).padStart(2, "0")}
              </span>
              {item.title}
            </button>
          ))}
        </nav>
      </div>
      <div className="zero-terminal-panel">
        <div className="zero-terminal-header">
          <span>
            <i data-ready={workshop.status === "ready"} />
            {workshop.status === "ready"
              ? "Linux gotowy"
              : workshop.status === "booting"
                ? "Uruchamianie Linuksa"
                : workshop.status === "paused"
                  ? "Warsztat wstrzymany"
                  : "Twój terminal"}
          </span>
          <span>Bash · Alpine Linux</span>
        </div>
        <div
          ref={container}
          className="zero-terminal"
          aria-label="Terminal Linuksa"
        />
        {workshop.status === "stopped" && (
          <div className="zero-start">
            <h3>Zajmij stanowisko</h3>
            <p>
              Pierwszy start pobierze około 25 MB. Pliki są przechowywane w tej
              przeglądarce.
            </p>
            <button
              className="zero-primary"
              onClick={() => {
                setHintState({ step: -1, count: 0 });
                void workshop.start();
              }}
            >
              Uruchom terminal
            </button>
          </div>
        )}
        {(workshop.error || workshop.warning) && (
          <p className="zero-alert" role="alert">
            {workshop.error || workshop.warning}
          </p>
        )}
        <div className="zero-terminal-footer">
          <span>
            {workshop.saved
              ? `Pliki zapisane lokalnie o ${new Date(workshop.saved.savedAt).toLocaleTimeString("pl-PL")}`
              : workshop.status === "booting"
                ? "Pierwszy start wymaga pobrania obrazu."
                : "W nano zapisuj przez Ctrl+O, Enter. Wyjście: Ctrl+X."}
          </span>
          <div>
            <button
              disabled={workshop.status !== "ready"}
              onClick={() => workshop.send({ type: "save" })}
            >
              Zapisz pliki
            </button>
            <button
              disabled={!["ready", "paused"].includes(workshop.status)}
              onClick={() =>
                workshop.send({
                  type: "pause",
                  paused: workshop.status === "ready",
                })
              }
            >
              {workshop.status === "paused" ? "Wznów" : "Pauza"}
            </button>
            <button disabled={exiting} onClick={leave}>
              {exiting ? "Zapisywanie…" : "Zapisz i wróć"}
            </button>
          </div>
        </div>
        <div className="zero-reset">
          {!reset ? (
            <button
              className="zero-text-button"
              disabled={!workshop.canReset}
              onClick={() => setReset(true)}
            >
              Odtwórz pliki bieżącego kroku
            </button>
          ) : (
            <>
              <p>
                Twoje pliki zostaną usunięte. Przywrócimy początek bieżącego
                kroku. Zaliczenia pozostaną.
              </p>
              <button
                onClick={() => {
                  workshop.send({ type: "reset" });
                  setReset(false);
                }}
              >
                Odtwórz warsztat
              </button>
              <button onClick={() => setReset(false)}>Anuluj</button>
            </>
          )}
        </div>
        <p className="zero-muted zero-local-note">
          Zapis plików dotyczy tej przeglądarki. Niezapisany bufor nano nie
          wróci po odświeżeniu. Przed wyjściem zapisz dokument w edytorze.
        </p>
      </div>
    </section>
  );
}

function CoursePage({ account, token }: { account: string; token: string }) {
  const course = useCourse(account, token);
  const [working, setWorking] = useState(false);
  const [desktop, setDesktop] = useState(
    () => matchMedia("(min-width: 1000px) and (pointer: fine)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(min-width: 1000px) and (pointer: fine)");
    const change = () => setDesktop(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  const finished = course.completed === lessons.length;
  return (
    <div
      className={`zero-course hackademy-container${working ? " zero-in-session" : ""}`}
    >
      <Link className="zero-back" to="/learn">
        ← Wszystkie ścieżki
      </Link>
      <header className="zero-hero">
        <div>
          <span className="zero-kicker">UKOS · INTERAKTYWNY KURS LINUXA</span>
          <h1>
            Dyżur Zero<span>Twój pierwszy dzień po stronie terminala.</span>
          </h1>
          <p>
            Przejmij stanowisko zespołu Hackademy. Poznaj Linuksa i uporządkuj
            dokumenty po poprzedniej zmianie.
          </p>
        </div>
        <div className="zero-hero-mark" aria-hidden="true">
          ~/ <span>01</span>
        </div>
      </header>
      <div className="zero-status" role="status">
        <span>
          {course.syncing
            ? "Synchronizacja postępu…"
            : course.synchronized
              ? "Postęp zapisany na koncie"
              : "Postęp czeka na synchronizację"}
        </span>
        <span>
          Pliki pozostają w tej przeglądarce · bez punktów do rankingu
        </span>
      </div>
      {(course.error || course.storageError) && (
        <div className="zero-alert" role="alert">
          <p>{course.error || course.storageError}</p>
          <p>
            Ćwiczenia działają bez połączenia. Postęp trafi na konto, gdy serwer
            będzie znów dostępny.
          </p>
          <button disabled={course.syncing} onClick={() => void course.sync()}>
            Ponów synchronizację
          </button>
        </div>
      )}
      {!desktop && (
        <p className="zero-alert">
          Na tym ekranie możesz czytać materiały i przeglądać postęp. Do pracy w
          terminalu użyj komputera z klawiaturą i większym ekranem.
        </p>
      )}
      {desktop && working ? (
        <Workshop
          account={account}
          course={course}
          onExit={() => setWorking(false)}
        />
      ) : (
        <>
          {finished && (
            <section className="zero-success">
              <span className="zero-kicker">LABORATORIUM 1 UKOŃCZONE</span>
              <h2>Dyżur przekazany. Dobra robota.</h2>
              <p>
                Wszystkie ćwiczenia Laboratorium 1 są ukończone i zapisane na
                Twoim koncie. Kolejne laboratoria są w przygotowaniu.
              </p>
            </section>
          )}
          <section className="zero-lab-card">
            <div>
              <span className="zero-kicker">
                LABORATORIUM 01 · {finished ? "UKOŃCZONE" : "DOSTĘPNE"}
              </span>
              <h2>Odnajdź się w terminalu</h2>
              <p>
                Pliki po poprzedniej zmianie czekają na uporządkowanie.
                Ćwiczenia przeprowadzą Cię od pierwszego pwd do uporządkowanego
                archiwum.
              </p>
              <div className="zero-tags">
                <span>15 kroków</span>
                <span>Bash i nano</span>
              </div>
              <progress
                max={lessons.length}
                value={course.completed}
                aria-label="Ukończone kroki Lab 1"
              />
              <p>
                {course.completed} z {lessons.length} ćwiczeń ukończonych
              </p>
            </div>
            <div className="zero-lab-actions">
              <button
                className="zero-primary"
                disabled={!desktop}
                onClick={() => setWorking(true)}
              >
                {finished
                  ? "Wróć do ćwiczeń"
                  : course.completed
                    ? "Kontynuuj ćwiczenia"
                    : "Rozpocznij dyżur"}
              </button>
            </div>
          </section>
          <section className="zero-roadmap">
            <span className="zero-kicker">
              KOLEJNE DYŻURY · W PRZYGOTOWANIU
            </span>
            {upcomingLabs.map((title, index) => (
              <div key={title}>
                <span>{String(index + 2).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <span>Zapowiedź</span>
              </div>
            ))}
          </section>
          <details className="zero-reading">
            <summary>Przeczytaj materiały Laboratorium 1</summary>
            {lessons.map((lesson) => (
              <article key={lesson.id}>
                <h3>{lesson.title}</h3>
                <p>{lesson.intro}</p>
                <p>{lesson.task}</p>
              </article>
            ))}
          </details>
        </>
      )}
      <footer className="zero-source">
        Kurs rozwijany. Zakres na podstawie{" "}
        <a
          href="https://mhyla.com/courses/UKOS/stacjonarne/"
          target="_blank"
          rel="noreferrer"
        >
          materiałów UKOS Michała Hyli
        </a>
        . Historia i ćwiczenia: Hackademy.
      </footer>
    </div>
  );
}

export default function UkosPage() {
  const { user, token } = useAuth();
  return user && token ? (
    <CoursePage key={user.sub} account={user.sub} token={token} />
  ) : null;
}
