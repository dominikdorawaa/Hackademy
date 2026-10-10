import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';

function Location() {
  const location = useLocation();
  const navigation = useNavigationType();
  return <output data-testid="location">{location.pathname}:{navigation}</output>;
}

export function renderWithAuth(routes: ReactNode, initialEntry = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthProvider>
        <Location />
        <Routes>{routes}</Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}
