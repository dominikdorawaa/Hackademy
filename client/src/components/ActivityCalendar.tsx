import { useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { ActivityDto } from '../types/api';
import {
  activityDays,
  activityDescription,
  activitySummary,
  localDateKey,
  solvedRoomsLabel,
} from '../lib/activity';
import './ActivityCalendar.css';

function CalendarGrid({ data, dates }: { data: ActivityDto[]; dates: Date[] }) {
  const counts = new Map(data.map((item) => [item.date, item.count]));
  const offset = (dates[0].getDay() + 6) % 7;
  const weeks = Math.ceil((dates.length + offset) / 7);
  const [focused, setFocused] = useState(dates.length - 1);
  const [selected, setSelected] = useState<number | null>(null);
  const cells = useRef(new Map<number, HTMLButtonElement>());
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[
      event.key
    ];
    if (delta === undefined) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(dates.length - 1, index + delta));
    setFocused(next);
    cells.current.get(next)?.focus();
  };
  const months = dates.flatMap((date, index) =>
    index === 0 || date.getDate() === 1
      ? [
          {
            label: date.toLocaleDateString('pl-PL', { month: 'short' }),
            column: Math.floor((index + offset) / 7) + 1,
          },
        ]
      : [],
  );

  return (
    <>
      <div
        className="activity-calendar-scroll"
        role="region"
        aria-label="Kalendarz rozwiązanych pokoi"
        tabIndex={0}
      >
        <div
          className="activity-calendar-layout"
          style={{ '--calendar-weeks': weeks } as CSSProperties}
        >
          <div className="activity-calendar-months" aria-hidden="true">
            {months.map((month, index) => (
              <span key={index} style={{ gridColumn: month.column }}>
                {month.label}
              </span>
            ))}
          </div>
          <div className="activity-calendar-days" aria-hidden="true">
            {['Pn', '', 'Śr', '', 'Pt', '', ''].map((day, index) => (
              <span key={index}>{day}</span>
            ))}
          </div>
          <div className="activity-calendar-grid">
            {Array.from({ length: offset }, (_, index) => (
              <span key={`empty-${index}`} />
            ))}
            {dates.map((date, index) => {
              const key = localDateKey(date);
              const count = counts.get(key) ?? 0;
              const description = activityDescription(date, count);
              return (
                <button
                  key={key}
                  type="button"
                  data-slot="activity-day"
                  data-date={key}
                  data-level={Math.min(count, 4)}
                  aria-label={description}
                  title={description}
                  tabIndex={focused === index ? 0 : -1}
                  ref={(element) => {
                    if (element) cells.current.set(index, element);
                    else cells.current.delete(index);
                  }}
                  onKeyDown={(event) => move(event, index)}
                  onFocus={() => {
                    setFocused(index);
                    setSelected(index);
                  }}
                  onClick={() => setSelected(index)}
                />
              );
            })}
          </div>
        </div>
      </div>
      <div className="activity-calendar-footer">
        <p className="activity-calendar-detail" aria-live="polite">
          {selected === null
            ? 'Wybierz dzień, aby zobaczyć liczbę rozwiązań.'
            : activityDescription(
                dates[selected],
                counts.get(localDateKey(dates[selected])) ?? 0,
              )}
        </p>
        <div
          className="activity-calendar-legend"
          aria-label="Intensywność: od zera do co najmniej czterech rozwiązanych pokoi"
        >
          <span>Mniej</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} data-level={level} aria-hidden="true" />
          ))}
          <span>Więcej</span>
        </div>
      </div>
    </>
  );
}

export default function ActivityCalendar({ data }: { data: ActivityDto[] }) {
  const dates = activityDays(new Date());
  const summary = activitySummary(data, dates);
  return (
    <div className="activity-calendar-container">
      <div className="activity-calendar-heading">
        <div>
          <p className="activity-calendar-summary">
            <strong>{summary.solved}</strong> {solvedRoomsLabel(summary.solved)}
          </p>
          <p className="activity-calendar-period">
            {summary.activeDays} {summary.activeDays === 1 ? 'dzień' : 'dni'}{' '}
            aktywności · ostatnie 12 tygodni
          </p>
        </div>
      </div>
      <CalendarGrid data={data} dates={dates} />
    </div>
  );
}
