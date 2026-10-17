import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it } from 'vitest';
import NotFoundPage from './NotFoundPage';

it('shows the lost bug and ways back for an unknown address', () => {
  render(<MemoryRouter initialEntries={['/nie-ma-takiej-strony']}><Routes><Route path="*" element={<NotFoundPage />} /></Routes></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1, name: 'Ten adres to bug' })).toBeInTheDocument();
  expect(screen.getByText('Błąd 404')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Wróć na start' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: 'Przeglądaj ścieżki' })).toHaveAttribute('href', '/learn');
  const sprite = document.querySelector('.not-found-track .pixel-sprite') as HTMLElement;
  expect(sprite.style.getPropertyValue('--sprite')).toBe('url(/assets/pixel/lost-bug.png)');
  expect(document.querySelector('.not-found-track')).toHaveAttribute('aria-hidden', 'true');
});
