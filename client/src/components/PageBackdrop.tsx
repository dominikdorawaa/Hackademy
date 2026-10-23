import { useLayoutEffect, useRef } from 'react';
import { SCENE_PANELS, sceneBounds, sceneCover } from '../lib/pageScenery';
import './PageBackdrop.css';

export default function PageBackdrop() {
  const backdrop = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const layer = backdrop.current;
    const canvas = layer?.parentElement;
    if (!layer || !canvas) return;
    let frame = 0;
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => schedule()) : null;
    const align = () => {
      frame = 0;
      const focus = parseFloat(getComputedStyle(canvas).getPropertyValue('--scene-focus'));
      const bounds = sceneBounds(canvas.dataset.scene, document.documentElement.getAttribute('data-theme'));
      const scene = sceneCover(layer.offsetWidth, layer.offsetHeight, Number.isFinite(focus) ? focus : .5, bounds);
      const size = `${scene.width}px ${scene.height}px`;
      layer.style.setProperty('--scene-size', size);
      layer.style.setProperty('--scene-offset', `${scene.x}px ${scene.y}px`);
      const origin = layer.getBoundingClientRect();
      canvas.querySelectorAll<HTMLElement>(SCENE_PANELS).forEach(panel => {
        const box = panel.getBoundingClientRect();
        const offset = `${Math.round(origin.left + scene.x - box.left - panel.clientLeft)}px ${Math.round(origin.top + scene.y - box.top - panel.clientTop)}px`;
        if (panel.style.getPropertyValue('--scene-offset') !== offset) panel.style.setProperty('--scene-offset', offset);
        if (panel.style.getPropertyValue('--scene-size') !== size) panel.style.setProperty('--scene-size', size);
        panel.dataset.sceneAligned = '';
        resize?.observe(panel);
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(align); };
    align();
    resize?.observe(canvas);
    const mutation = new MutationObserver(schedule);
    mutation.observe(canvas, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-scene'] });
    mutation.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      mutation.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return <div ref={backdrop} className="page-backdrop" aria-hidden="true" />;
}
