import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { PrivacyPage, TermsPage } from './LegalPages';

it('shows the privacy policy with a working contact address and a link to the terms', () => {
  render(<MemoryRouter><PrivacyPage /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1, name: 'Polityka prywatności' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: 'Twoje prawa' })).toBeInTheDocument();
  for (const link of screen.getAllByRole('link', { name: 'kontakt@hackademy.app' })) {
    expect(link).toHaveAttribute('href', 'mailto:kontakt@hackademy.app');
  }
  expect(screen.getByRole('link', { name: 'regulamin' })).toHaveAttribute('href', '/terms');
});

it('shows the terms with a link to the privacy policy', () => {
  render(<MemoryRouter><TermsPage /></MemoryRouter>);
  expect(screen.getByRole('heading', { level: 1, name: 'Regulamin' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: 'Etyczne korzystanie z wiedzy' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'polityka prywatności' })).toHaveAttribute('href', '/privacy');
  expect(screen.getByRole('heading', { level: 2, name: 'Materiały edukacyjne' })).toHaveAttribute('id', 'educational-materials');
  expect(screen.getByText(/materiały opracowane z pomocą sztucznej inteligencji/)).toBeInTheDocument();
  expect(screen.getByText(/nie są oficjalnym bankiem pytań egzaminacyjnych/)).toBeInTheDocument();
  expect(screen.getByText('Ostatnia aktualizacja: 29 października 2026')).toBeInTheDocument();

});
