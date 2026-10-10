import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cell, CartesianGrid, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import type { AdminStatsDto, StatsRange } from '../../types/api';
import { EmptyState, PageHeader, Section, StatusMessage } from '../../components/admin/AdminUi';
import { errorText, numberFormat, plural } from '../../components/admin/adminFormat';

const ranges: StatsRange[] = [7, 30, 90];

const series = [
  { light: '#2a78d6', dark: '#3987e5' },
  { light: '#eb6834', dark: '#d95926' },
  { light: '#1baf7a', dark: '#199e70' },
  { light: '#eda100', dark: '#c98500' },
  { light: '#e87ba4', dark: '#d55181' },
  { light: '#008300', dark: '#008300' },
];

const timelineConfig = {
  registrations: { label: 'Rejestracje', theme: series[0] },
  solves: { label: 'Rozwiązania', theme: series[1] },
} satisfies ChartConfig;

const fixedSliceSlots: Record<string, number> = { 'paths-other': 3, 'paths-unassigned': 4, ctf: 5 };

function sliceSlots(keys: string[]) {
  let nextPathSlot = 0;
  return keys.map((key) => fixedSliceSlots[key] ?? nextPathSlot++);
}

const shortDate = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' });
const compactDateTime = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const longDate = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' });

const parseDay = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

function StatTile({ label, value, detail, className }: { label: string; value: number; detail: string; className?: string }) {
  return (
    <div className={cn('h-full rounded-xl border bg-card px-5 py-4', className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-[Poppins] text-3xl font-semibold tracking-tight text-foreground tabular-nums">{numberFormat.format(value)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function TilesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Ładowanie statystyk">
      {[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-28 rounded-xl" />)}
    </div>
  );
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [range, setRange] = useState<StatsRange>(30);
  const [stats, setStats] = useState<AdminStatsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    adminApi.getStats(range, token)
      .then((data) => {
        if (!active) return;
        setStats(data ?? null);
        setError(null);
      })
      .catch((err: unknown) => {
        if (active) setError(errorText(err, 'Nie udało się pobrać statystyk.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range, token]);

  const periodTotals = useMemo(() => {
    const timeline = stats?.timeline ?? [];
    return {
      registrations: timeline.reduce((sum, day) => sum + day.registrations, 0),
      solves: timeline.reduce((sum, day) => sum + day.solves, 0),
    };
  }, [stats]);

  const slices = useMemo(() => {
    const source = stats?.solvesBySource ?? [];
    const slots = sliceSlots(source.map((slice) => slice.key));
    const total = source.reduce((sum, slice) => sum + slice.count, 0);
    return source.map((slice, index) => ({
      ...slice,
      slot: slots[index],
      share: total ? slice.count / total : 0,
    }));
  }, [stats]);

  const pieConfig = useMemo(
    () => Object.fromEntries(slices.map((slice) => [slice.key, { label: slice.label, theme: series[slice.slot] }])) satisfies ChartConfig,
    [slices],
  );

  const rangeLabel = `${range} ${plural(range, ['dzień', 'dni', 'dni'])}`;

  return (
    <>
      <PageHeader title="Pulpit" description="Stan platformy w liczbach. Dane odświeżają się przy każdym wejściu." />
      {error && <div className="mb-4"><StatusMessage kind="error">{error}</StatusMessage></div>}

      {!stats ? (
        loading ? <TilesSkeleton /> : null
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Użytkownicy" value={stats.totals.users} detail={`+${numberFormat.format(periodTotals.registrations)} w ostatnich ${rangeLabel}`} />
            <StatTile label="Rozwiązania" value={stats.totals.solves} detail={`+${numberFormat.format(periodTotals.solves)} w ostatnich ${rangeLabel}`} />
            <StatTile label="Aktywni w tym tygodniu" value={stats.totals.activeThisWeek} detail="Gracze z czasem nauki w bieżącym tygodniu" />
            <Link to="/admin/reports" className="group block h-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <StatTile
                className="transition-colors group-hover:border-primary/50 group-hover:bg-accent/40"
                label="Zgłoszenia czatu"
                value={stats.totals.pendingReports}
                detail={stats.totals.pendingReports > 0 ? 'Czekają na decyzję. Otwórz listę' : 'Nic nie czeka na decyzję'}
              />
            </Link>
          </div>

          <Section
            title="Rejestracje i rozwiązania"
            description={`Dziennie, ostatnie ${rangeLabel}`}
            actions={
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={String(range)}
                onValueChange={(value) => value && setRange(Number(value) as StatsRange)}
                aria-label="Zakres wykresu"
              >
                {ranges.map((option) => (
                  <ToggleGroupItem key={option} value={String(option)} aria-label={`Ostatnie ${option} dni`} className="px-3 tabular-nums">
                    {option} dni
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            }
          >
            <div aria-busy={loading} className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <ChartContainer config={timelineConfig} className="aspect-auto h-72 w-full" aria-hidden="true">
                <LineChart data={stats.timeline} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                    tickFormatter={(value: string) => shortDate.format(parseDay(value))}
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} padding={{ top: 16 }} />
                  <ChartTooltip
                    cursor={{ strokeDasharray: '4 4' }}
                    content={<ChartTooltipContent labelFormatter={(value) => longDate.format(parseDay(String(value)))} />}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line dataKey="registrations" type="linear" stroke="var(--color-registrations)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line dataKey="solves" type="linear" stroke="var(--color-solves)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ChartContainer>
              <div className="sr-only">
              <table>
                <caption>Rejestracje i rozwiązania dziennie, ostatnie {rangeLabel}</caption>
                <thead><tr><th>Dzień</th><th>Rejestracje</th><th>Rozwiązania</th></tr></thead>
                <tbody>
                  {stats.timeline.map((day) => (
                    <tr key={day.date}><td>{day.date}</td><td>{day.registrations}</td><td>{day.solves}</td></tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </Section>

          <div className="grid gap-6 xl:grid-cols-2">
            <Section title="Rozwiązania według źródła" description="Wszystkie rozwiązania: ścieżki i CTF">
              {slices.length === 0 ? (
                <EmptyState title="Brak rozwiązań" description="Wykres pojawi się po pierwszym rozwiązanym pokoju." />
              ) : (
                <div className="grid items-center gap-6 sm:grid-cols-[10rem_minmax(0,1fr)]">
                  <ChartContainer config={pieConfig} className="mx-auto aspect-square w-40" aria-hidden="true">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
                      <Pie data={slices} dataKey="count" nameKey="key" innerRadius="58%" outerRadius="100%" stroke="var(--card)" strokeWidth={2} paddingAngle={slices.length > 1 ? 1 : 0}>
                        {slices.map((slice) => <Cell key={slice.key} fill={`var(--color-${slice.key})`} />)}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <ul className="space-y-2" aria-label="Rozwiązania według źródła">
                    {slices.map((slice) => (
                      <li key={slice.key} className="flex items-center gap-2 text-sm">
                        <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ background: `var(--color-${slice.key})` }} data-slice={slice.key} />
                        <span className="min-w-0 flex-1 truncate text-foreground" title={slice.label}>{slice.label}</span>
                        <span className="tabular-nums text-foreground">{numberFormat.format(slice.count)}</span>
                        <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{Math.round(slice.share * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>

            <Section title="Ostatnie rozwiązania" description="Najnowsze ukończone pokoje" flush>
              {stats.recentSolves.length === 0 ? (
                <div className="p-5"><EmptyState title="Brak rozwiązań" /></div>
              ) : (
                <div className="overflow-hidden rounded-b-xl">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%] pl-5">Gracz</TableHead>
                        <TableHead>Pokój</TableHead>
                        <TableHead className="w-32 pr-5 text-right">Kiedy</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.recentSolves.map((solve, index) => (
                        <TableRow key={`${solve.username}-${solve.roomId}-${index}`}>
                          <TableCell className="truncate pl-5 font-medium">{solve.username}</TableCell>
                          <TableCell className="truncate">
                            <span className="block truncate" title={solve.roomTitle}>{solve.roomTitle}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {solve.roomType === 'CTF' ? 'CTF' : solve.pathTitle ?? 'Poza ścieżką'}
                            </span>
                          </TableCell>
                          <TableCell className="pr-5 text-right text-muted-foreground tabular-nums">
                            {compactDateTime.format(new Date(solve.solvedAt))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Section>
          </div>
        </div>
      )}
    </>
  );
}
