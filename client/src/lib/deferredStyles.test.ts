import { expect, it } from 'vitest';
import { enableDeferredStyles } from './deferredStyles';

it('activates deferred fonts and icons without changing unrelated print styles', () => {
  const fonts = document.createElement('link');
  fonts.dataset.deferredStyle = '';
  fonts.media = 'print';
  const printing = document.createElement('link');
  printing.media = 'print';
  document.head.append(fonts, printing);
  try {
    enableDeferredStyles();
    expect(fonts.media).toBe('all');
    expect(printing.media).toBe('print');
  } finally { fonts.remove(); printing.remove(); }
});
