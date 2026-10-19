import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import Footer from './Footer';

it('links to the terms and the privacy policy', () => {
  render(<MemoryRouter><Footer /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Regulamin' })).toHaveAttribute('href', '/regulamin');
  expect(screen.getByRole('link', { name: 'Prywatność' })).toHaveAttribute('href', '/prywatnosc');
});
