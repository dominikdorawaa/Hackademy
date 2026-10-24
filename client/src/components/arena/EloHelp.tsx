import { useEffect, useRef, useState } from 'react';
import { Popover } from 'radix-ui';
import { Info } from 'lucide-react';
import './EloHelp.css';

export function EloHelp() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const trigger = useRef<HTMLButtonElement>(null);
  const show = () => { clearTimeout(closeTimer.current); setOpen(true); };
  const leave = () => {
    if (document.activeElement === trigger.current) return;
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild>
      <button ref={trigger} type="button" className="ud-term-btn" aria-label="Co oznacza Elo?"
        onPointerEnter={event => { if (event.pointerType !== 'touch') show(); }} onPointerLeave={leave}
        onFocus={show} onClick={event => { event.preventDefault(); show(); }}>
        Elo <Info size={14} aria-hidden="true" />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className="user-dashboard elo-help-tip" side="top" sideOffset={12} collisionPadding={16}
        aria-label="Jak działa Elo" onOpenAutoFocus={event => event.preventDefault()} onCloseAutoFocus={event => event.preventDefault()}
        onPointerEnter={() => clearTimeout(closeTimer.current)} onPointerLeave={leave}>
        <strong>Elo to Twoja siła w pojedynkach.</strong>
        <p>Grasz w Trybie rankingowym: wygrywasz, to rośnie, przegrywasz, to spada. Pokonanie mocniejszego gracza daje więcej punktów. Każdy zaczyna z 500.</p>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
