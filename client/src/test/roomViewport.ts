import { vi } from 'vitest';

export function mockRoomViewport() {
  const original = HTMLElement.prototype.getBoundingClientRect;
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('room-mascot-zone')) return { left: 0, top: 64, right: 1024, bottom: 704, width: 1024, height: 640, x: 0, y: 64, toJSON: () => ({}) };
    return original.call(this);
  });
}
