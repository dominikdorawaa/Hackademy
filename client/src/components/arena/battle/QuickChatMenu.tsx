import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { PixelSprite } from '../../PixelSprite';
import { QUICK_REACTIONS, REACTION_GROUPS } from './quickChat';

export function QuickChatMenu({ children, onPick, notice }: { children: ReactNode; onPick: (id: string) => void; notice: string | null }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    items.current[0]?.focus();
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const shut = () => { setOpen(false); trigger.current?.focus(); };
  const pick = (id: string) => { shut(); onPick(id); };

  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items.current.filter((item): item is HTMLButtonElement => item !== null);
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const move = (next: number) => { event.preventDefault(); list[(next + list.length) % list.length]?.focus(); };
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') move(index + 1);
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(list.length - 1);
    else if (event.key === 'Escape') { event.preventDefault(); shut(); }
    else if (event.key === 'Tab') setOpen(false);
  };

  return (
    <div className="quick-chat" ref={root}>
      <button ref={trigger} type="button" className="quick-chat-trigger" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        aria-label="Szybkie reakcje" onClick={() => setOpen(value => !value)}
        onKeyDown={event => { if (event.key === 'ArrowDown' && !open) { event.preventDefault(); setOpen(true); } }}>
        {children}
        <span className="quick-chat-badge" aria-hidden="true">💬</span>
      </button>
      {open && (
        <div id={menuId} className="quick-chat-menu" role="menu" aria-label="Szybkie reakcje" onKeyDown={navigate}>
          {REACTION_GROUPS.map(group => (
            <div key={group.kind} className={`quick-chat-group is-${group.kind}`} role="group" aria-label={group.label}>
              <p className="quick-chat-group-label" aria-hidden="true">{group.label}</p>
              <div className="quick-chat-items">
                {QUICK_REACTIONS.filter(reaction => reaction.kind === group.kind).map(reaction => {
                  const slot = QUICK_REACTIONS.indexOf(reaction);
                  return (
                    <button key={reaction.id} ref={element => { items.current[slot] = element; }} type="button" role="menuitem" tabIndex={-1}
                      className="quick-chat-item" aria-label={reaction.name} onClick={() => pick(reaction.id)}>
                      {reaction.sprite ? <PixelSprite sprite={reaction.sprite} duration={reaction.sprite.frames * 110} /> : reaction.text}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {notice && <p className="quick-chat-notice" role="alert">{notice}</p>}
    </div>
  );
}
