import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function RouterBlocker({ dirty, saving, mayBlock, onBlock }: { dirty: boolean; saving: boolean; mayBlock: () => boolean; onBlock: (proceed: () => void, cancel: () => void) => void }) {
  const blocker = useBlocker(() => (dirty || saving) && mayBlock());
  useEffect(() => {
    if (blocker.state === 'blocked') onBlock(blocker.proceed, blocker.reset);
  }, [blocker, onBlock]);
  return null;
}
export function useUnsavedChanges(dirty: boolean, save: () => Promise<boolean>, saving: boolean) {
  const router = useContext(UNSAFE_DataRouterContext);
  const [pending, setPending] = useState<{ proceed: () => void; cancel: () => void; route?: boolean } | null>(null);
  const [continuing, setContinuing] = useState(false);
  const bypass = useRef(false);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  const block = useCallback((proceed: () => void, cancel: () => void) => {
    setPending(current => current ?? { proceed, cancel, route: true });
  }, []);
  const mayBlock = useCallback(() => {
    if (bypass.current) { bypass.current = false; return false; }
    return true;
  }, []);
  const request = (proceed: () => void) => {
    if (saving || continuing) return;
    if (dirty) setPending({ proceed, cancel: () => undefined });
    else proceed();
  };
  const leave = async (saveFirst: boolean) => {
    if (!pending || continuing || saving) return;
    setContinuing(true);
    let ok = !saveFirst;
    try { if (saveFirst) ok = await save(); }
    finally { setContinuing(false); }
    if (ok) { bypass.current = !pending.route; setPending(null); pending.proceed(); setTimeout(() => { bypass.current = false; }, 0); }
    else { pending.cancel(); setPending(null); }
  };
  const dialog = <>
    {router && <RouterBlocker dirty={dirty} saving={saving || continuing} mayBlock={mayBlock} onBlock={block} />}
    <Dialog open={!!pending} onOpenChange={(open) => { if (!open && !continuing) { pending?.cancel(); setPending(null); } }}>
      <DialogContent onEscapeKeyDown={(event) => { if (continuing) event.preventDefault(); }} onInteractOutside={(event) => { if (continuing) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>Niezapisane zmiany</DialogTitle><DialogDescription>Zapisz zmiany przed przejściem dalej albo zdecyduj o ich odrzuceniu. Zapis szkicu nie publikuje materiału.</DialogDescription></DialogHeader>
        <DialogFooter className="flex-wrap">
          <Button variant="outline" disabled={continuing} onClick={() => { pending?.cancel(); setPending(null); }}>Kontynuuj edycję</Button>
          <Button variant="outline" disabled={continuing} onClick={() => void leave(false)}>Wyjdź bez zapisywania</Button>
          <Button disabled={continuing} onClick={() => void leave(true)}>{continuing ? 'Zapisywanie…' : 'Zapisz i przejdź dalej'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
  return { request, dialog, allowNavigation: () => { bypass.current = true; } };
}
