import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { RoomPathDto } from '../../types/api';
import { plural } from './adminFormat';

const titles = (paths: RoomPathDto[]) => paths.map((path) => path.title).join(', ');

/** "w 1 opublikowanej ścieżce", "w 3 opublikowanych ścieżkach". */
function inPaths(count: number, adjective: [string, string]) {
  return count === 1 ? `1 ${adjective[0]} ścieżce` : `${count} ${adjective[1]} ścieżkach`;
}

export function publishedPathsWarning(paths: RoomPathDto[]) {
  const published = paths.filter((path) => path.published);
  if (!published.length) return null;
  return `Ten pokój jest w ${inPaths(published.length, ['opublikowanej', 'opublikowanych'])}: ${titles(published)}. Zmiany po zapisie są od razu widoczne.`;
}

export function poolStatus(paths: RoomPathDto[], pathId: number | null) {
  const others = paths.filter((path) => path.id !== pathId);
  if (!others.length) return { label: 'Nieprzypisany', title: undefined };
  return { label: `W ${inPaths(others.length, ['innej', 'innych'])}`, title: titles(others) };
}

export function DeleteRoomDescription({ paths }: { paths: RoomPathDto[] }) {
  return (
    <>
      Pokój, jego zadania, podpowiedzi, plik i postępy graczy zostaną trwale usunięte.
      {paths.length > 0 && (
        <span className="mt-3 block text-foreground">
          {paths.length === 1 ? 'Zniknie ze ścieżki' : `Zniknie z ${paths.length} ${plural(paths.length, ['ścieżki', 'ścieżek', 'ścieżek'])}`}:
          <span className="mt-1 block font-medium">{titles(paths)}</span>
        </span>
      )}
    </>
  );
}

export function RoomPathsCell({ paths }: { paths: RoomPathDto[] }) {
  if (!paths.length) return <Badge variant="outline" className="text-muted-foreground">Bez ścieżki</Badge>;
  if (paths.length === 1) {
    return (
      <Link to={`/admin/paths/${paths[0].id}`} className="text-muted-foreground hover:text-foreground hover:underline underline-offset-4">
        {paths[0].title}
      </Link>
    );
  }
  const count = `${paths.length} ${plural(paths.length, ['ścieżka', 'ścieżki', 'ścieżek'])}`;
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label={`${count}: ${titles(paths)}`}
            className="cursor-default rounded-sm text-muted-foreground tabular-nums underline decoration-dotted underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            {count}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <ul className="space-y-0.5">{paths.map((path) => <li key={path.id}>{path.title}{path.published ? '' : ' (szkic)'}</li>)}</ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
