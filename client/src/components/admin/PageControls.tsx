import { Button } from '../ui/button';

export function PageControls({ page, hasNext, loading, onPage }: {
  page: number; hasNext: boolean; loading: boolean; onPage: (page: number) => void;
}) {
  return <nav aria-label="Strony wyników" className="mt-4 flex items-center justify-end gap-3">
    <Button variant="outline" disabled={loading || page === 0} onClick={() => onPage(page - 1)}>Poprzednia</Button>
    <span className="text-sm tabular-nums">Strona {page + 1}</span>
    <Button variant="outline" disabled={loading || !hasNext} onClick={() => onPage(page + 1)}>Następna</Button>
  </nav>;
}
