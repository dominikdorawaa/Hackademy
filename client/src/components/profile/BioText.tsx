import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';

export default function BioText({ bio }: { bio: string }) {
  const text = useRef<HTMLParagraphElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const element = text.current;
    if (!element || expanded) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const clamp = element.style.webkitLineClamp;
      element.style.webkitLineClamp = 'unset';
      const fullHeight = element.scrollHeight;
      element.style.webkitLineClamp = clamp;
      setOverflows(fullHeight > element.clientHeight + 1);
    };
    measure();
    void document.fonts?.ready.then(measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [bio, expanded]);
  return (
    <>
      <p ref={text} className={`profile-bio-text ${expanded ? '' : 'profile-bio-clamped'}`}>
        {bio}
      </p>
      {(overflows || expanded) && (
        <Button
          variant="link"
          size="sm"
          className="px-0"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Zwiń opis' : 'Rozwiń opis'}
        </Button>
      )}
    </>
  );
}
