import type { ActivityDto } from '../types/api';

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function activityDays(today: Date) {
  const end = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    12,
  );
  const start = new Date(end);
  start.setDate(start.getDate() - 83);
  const dates: Date[] = [];
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1))
    dates.push(new Date(day));
  return dates;
}

export function activitySummary(data: ActivityDto[], dates: Date[]) {
  const keys = new Set(dates.map(localDateKey));
  const rows = data.filter((item) => keys.has(item.date));
  return {
    solved: rows.reduce((sum, item) => sum + item.count, 0),
    activeDays: rows.filter((item) => item.count > 0).length,
  };
}

export function activityDescription(date: Date, count: number) {
  const label = date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${label}: ${count} ${solvedRoomsLabel(count)}`;
}

export function profileActivityFacts(data: ActivityDto[], today: Date) {
  const counts = new Map(data.map((item) => [item.date, item.count]));
  let bestDay: { count: number; date: Date } | null = null;
  let currentStreak = 0;
  let longestStreak = 0;
  let solved = 0;
  let activeDays = 0;
  for (const day of activityDays(today)) {
    const count = counts.get(localDateKey(day)) ?? 0;
    currentStreak = count > 0 ? currentStreak + 1 : 0;
    longestStreak = Math.max(longestStreak, currentStreak);
    if (count > 0) {
      solved += count;
      activeDays++;
    }
    if (count > 0 && count >= (bestDay?.count ?? 0))
      bestDay = { count, date: day };
  }
  return {
    bestDay, longestStreak, activeDays,
    averagePerActiveDay: activeDays ? solved / activeDays : 0,
  };
}

export function solvedRoomsLabel(count: number) {
  if (count === 1) return 'rozwiązany pokój';
  return count % 10 >= 2 &&
    count % 10 <= 4 &&
    (count % 100 < 12 || count % 100 > 14)
    ? 'rozwiązane pokoje'
    : 'rozwiązanych pokoi';
}
