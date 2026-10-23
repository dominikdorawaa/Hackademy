import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { ONBOARDING_PATH } from '../../lib/onboarding';

const ProtectedRoute = ({ children, onboarding = false }: PropsWithChildren<{ onboarding?: boolean }>) => {
  const { isAuthenticated, loading } = useAuth();
  const { status, state, refresh } = useOnboarding();
  const location = useLocation();

  if (loading) return <div role="status">Wczytuję…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (status === 'error') {
    return <div className="onboarding-gate" role="alert">
      <p>Nie udało się sprawdzić Twojego konta.</p>
      <button type="button" className="ud-btn ud-btn-solid" onClick={refresh}>Spróbuj ponownie</button>
    </div>;
  }
  if (state && !state.avatarConfirmed && !onboarding) return <Navigate to={ONBOARDING_PATH} replace state={{ from: location.pathname }} />;
  if (state?.avatarConfirmed && onboarding) return <Navigate to="/dashboard" replace />;
  const pending = status !== 'ready' || !state;
  return <>{pending && <div role="status">Wczytuję…</div>}<div hidden={pending} inert={pending || undefined} style={pending ? undefined : { display: 'contents' }}>{children}</div></>;
};

export default ProtectedRoute;
