import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Check, Lightbulb, TerminalSquare } from "lucide-react";
import RoomFrame from "../components/room/RoomFrame";
import RoomFooterBar from "../components/room/RoomFooterBar";
import RoomSplit from "../components/room/RoomSplit";
import { useAuth } from "../context/AuthContext";
import { useWorkshop } from "../prototypes/ukos/useWorkshop";
import { lessons, upcomingLabs } from "./content";
import { useCourse } from "./useCourse";
import "@xterm/xterm/css/xterm.css";
import "./ukos.css";

type Course = ReturnType<typeof useCourse>;

const megabytes = (bytes: number) =>
  (bytes / 1_000_000).toLocaleString("pl-PL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

function BootProgress({
  download,
}: {
  download: { loaded: number; total: number } | null;
}) {
  const known = download !== null && download.total > 0;
  const downloading = known && download.loaded < download.total;
  const percent = known
    ? Math.min(100, Math.floor((download.loaded / download.total) * 100))
    : 0;
  const title = !known
    ? "Przygotowanie terminala"
    : downloading
      ? "Pobieranie Linuksa"
      : "Uruchamianie systemu";
  return (
    <div className="zero-start zero-boot">
      <div>
        <TerminalSquare aria-hidden="true" />
        <h2>{title}</h2>
        <p aria-live="polite">
          {downloading
            ? `Pobrano ${megabytes(download.loaded)} z ${megabytes(download.total)} MB`
            : known
              ? "Pliki są gotowe. System startuje, to potrwa kilka sekund."
              : "Łączymy się z obrazem systemu."}
        </p>
        <div
          className={`zero-boot-meter${downloading ? "" : " is-waiting"}`}
          role="progressbar"
          aria-label={title}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={downloading ? percent : undefined}
        >
          <span
            style={downloading ? { transform: `scaleX(${percent / 100})` } : undefined}
          />
        </div>
        {downloading && <strong className="zero-boot-percent">{percent}%</strong>}
      </div>
    </div>
  );
}

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
  const lessonScroll = useRef<HTMLDivElement>(null);
  const titleId = useId();
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
  const finished = current >= lessons.length && reading === null;
  const last = lessons.length - 1;

  useEffect(() => {
    if (exiting && workshop.status === "stopped") onExit();
  }, [exiting, workshop.status, onExit]);

  useEffect(() => {
    lessonScroll.current?.scrollTo?.({ top: 0 });
  }, [selected, finished]);

  const leave = () => {
    if (workshop.status === "stopped") onExit();
    else {
      setExiting(true);
      workshop.stop();
    }
  };

  const select = (index: number) => {
    setReading(index === current ? null : index);
    setHintState({ step: -1, count: 0 });
  };

  const status =
    workshop.status === "ready"
      ? "Linux gotowy"
      : workshop.status === "booting"
        ? "Uruchamianie Linuksa"
        : workshop.status === "paused"
          ? "Warsztat wstrzymany"
          : "Twój terminal";

  const lessonPane = (
    <section className="room-pane zero-lesson-pane" aria-labelledby={titleId}>
      <div className="room-pane-tab">
        <span>
          <BookOpen aria-hidden="true" />
          Ćwiczenie
        </span>
      </div>
      <div className="room-pane-scroll" ref={lessonScroll}>
        {(course.error || course.storageError) && (
          <div className="room-alert" role="alert">
            <p>{course.error || course.storageError}</p>
            <p>
              Ćwiczenia działają bez połączenia. Postęp trafi na konto, gdy
              serwer będzie znów dostępny.
            </p>
            <button
              className="room-btn room-btn--small"
              disabled={course.syncing}
              onClick={() => void course.sync()}
            >
              Ponów synchronizację
            </button>
          </div>
        )}
        {finished ? (
          <article>
            <p className="room-kicker is-done">Laboratorium 1 ukończone</p>
            <h1 className="room-title" id={titleId}>
              Stanowisko gotowe.
            </h1>
            <div className="room-prose">
              <p>
                Potrafisz już odnaleźć pliki, uporządkować je i zostawić
                wiadomość zespołowi. Możesz dalej ćwiczyć w terminalu albo wrócić
                do mapy kursu.
              </p>
            </div>
          </article>
        ) : (
          <article key={selected}>
            <p className={`room-kicker${selected < current ? " is-done" : ""}`}>
              Krok {selected + 1} z {lessons.length}
              {selected < current ? " · ukończony" : ""}
            </p>
            <h1 className="room-title" id={titleId}>
              {lesson.title}
            </h1>
            <div className="room-prose">
              <p>{lesson.intro}</p>
            </div>
            <div className="room-callout">
              <strong className="room-callout-title">Twoje zadanie</strong>
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
                <p className="room-note">
                  Po poprawnym wykonaniu zadanie zaliczy się automatycznie.
                  Pracuj nad bieżącym krokiem.
                </p>
                {hintCount < lesson.hints.length && (
                  <button
                    className="room-btn room-btn--small"
                    onClick={() =>
                      setHintState({
                        step: selected,
                        count: Math.min(hintCount + 1, lesson.hints.length),
                      })
                    }
                  >
                    <Lightbulb aria-hidden="true" />
                    Podpowiedź
                  </button>
                )}
                {hintCount > 0 && (
                  <ol className="zero-hints" aria-label="Podpowiedzi">
                    {lesson.hints.slice(0, hintCount).map((hint, index) => (
                      <li className="room-hint" key={hint}>
                        <span className="room-hint-mark" aria-hidden="true">
                          {index + 1}
                        </span>
                        <p>{hint}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
            {reading !== null && (
              <button
                className="room-btn room-btn--small"
                onClick={() => select(current)}
              >
                Wróć do bieżącego zadania
              </button>
            )}
          </article>
        )}
      </div>
    </section>
  );

  const terminalPane = (
    <section className="room-pane zero-terminal-pane" aria-label="Terminal">
      <div className="room-pane-tab">
        <span className="zero-terminal-status">
          <i data-ready={workshop.status === "ready"} aria-hidden="true" />
          {status}
        </span>
        <span>Bash · Alpine Linux</span>
      </div>
      <div className="zero-terminal-stage">
        <div
          ref={container}
          className="zero-terminal"
          aria-label="Terminal Linuksa"
        />
        {workshop.status === "stopped" && (
          <div className="zero-start">
            <div>
              <TerminalSquare aria-hidden="true" />
              <h2>Zajmij stanowisko</h2>
              <p>
                Pierwszy start pobierze około 25 MB. Pliki są przechowywane w
                tej przeglądarce.
              </p>
              <button
                className="room-btn room-btn--primary"
                onClick={() => {
                  setHintState({ step: -1, count: 0 });
                  void workshop.start();
                }}
              >
                Uruchom terminal
              </button>
            </div>
          </div>
        )}
        {workshop.status === "booting" && <BootProgress download={workshop.download} />}
      </div>
      {(workshop.error || workshop.warning) && (
        <p className="zero-terminal-alert" role="alert">
          {workshop.error || workshop.warning}
        </p>
      )}
      <div className="zero-terminal-toolbar">
        <span>
          {workshop.saved
            ? `Pliki zapisane lokalnie o ${new Date(workshop.saved.savedAt).toLocaleTimeString("pl-PL")}`
            : workshop.status === "booting"
              ? "Pierwszy start wymaga pobrania obrazu."
              : "W nano zapisuj przez Ctrl+O, Enter. Wyjście: Ctrl+X."}
        </span>
        <div>
          <button
            className="room-btn room-btn--small"
            disabled={workshop.status !== "ready"}
            onClick={() => workshop.send({ type: "save" })}
          >
            Zapisz pliki
          </button>
          <button
            className="room-btn room-btn--small"
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
          <button
            className="room-btn room-btn--small"
            disabled={exiting}
            onClick={leave}
          >
            {exiting ? "Zapisywanie…" : "Zapisz i wróć"}
          </button>
        </div>
      </div>
      <div className="zero-terminal-reset">
        {!reset ? (
          <>
            <button
              className="zero-link-button"
              disabled={!workshop.canReset}
              onClick={() => setReset(true)}
            >
              Odtwórz pliki bieżącego kroku
            </button>
            <span>
              Zapis plików dotyczy tej przeglądarki. Niezapisany bufor nano nie
              wróci po odświeżeniu.
            </span>
          </>
        ) : (
          <>
            <p>
              Twoje pliki zostaną usunięte. Przywrócimy początek bieżącego
              kroku. Zaliczenia pozostaną.
            </p>
            <div>
              <button
                className="room-btn room-btn--small"
                onClick={() => {
                  workshop.send({ type: "reset" });
                  setReset(false);
                }}
              >
                Odtwórz warsztat
              </button>
              <button
                className="room-btn room-btn--small"
                onClick={() => setReset(false)}
              >
                Anuluj
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );

  return (
    <RoomFrame
      label="Warsztat ćwiczeń"
      className="room-frame--split room-frame--panels zero-room"
      nav={{
        back: {
          title: "Dyżur Zero",
          label: "Wróć do Dyżuru Zero",
          onClick: leave,
          disabled: exiting,
        },
        title: "Laboratorium 1: Odnajdź się w terminalu",
        progress: {
          value: Math.min(current, lessons.length),
          max: lessons.length,
          label: "Postęp ćwiczeń",
        },
      }}
      footer={
        <RoomFooterBar
          steps={lessons.map((item, index) => ({
            key: item.id,
            title: item.title,
            done: index < current,
            locked: index > current,
          }))}
          current={selected}
          unit="Krok"
          listLabel="Kroki laboratorium"
          title={finished ? "Laboratorium ukończone" : lesson.title}
          onSelect={select}
          center={
            finished ? (
              <span className="room-state room-state--done">
                <Check aria-hidden="true" />
                Wszystkie kroki ukończone
              </span>
            ) : selected < current ? (
              <span className="room-state room-state--done">
                <Check aria-hidden="true" />
                Krok ukończony
              </span>
            ) : (
              <span className="room-state">Zalicza się automatycznie</span>
            )
          }
          back={{
            label: "Wstecz",
            disabled: selected === 0 && !finished,
            onClick: () => select(finished ? last : selected - 1),
          }}
          next={
            finished
              ? {
                  label: "Zakończ dyżur",
                  onClick: leave,
                  disabled: exiting,
                  primary: true,
                }
              : {
                  label: "Dalej",
                  disabled: selected >= current,
                  primary: selected < current,
                  onClick: () => select(selected + 1),
                }
          }
        />
      }
    >
      <RoomSplit start={lessonPane} end={terminalPane} initial={0.4} />
    </RoomFrame>
  );
}

function CoursePage({ account, sessionKey }: { account: string; sessionKey: string }) {
  const course = useCourse(account, sessionKey);
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
  if (desktop && working)
    return (
      <Workshop
        account={account}
        course={course}
        onExit={() => setWorking(false)}
      />
    );
  return (
    <div className="zero-course hackademy-container">
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
  const { user, sessionKey } = useAuth();
  return user && sessionKey ? (
    <CoursePage key={user.username} account={user.username} sessionKey={sessionKey} />
  ) : null;
}
