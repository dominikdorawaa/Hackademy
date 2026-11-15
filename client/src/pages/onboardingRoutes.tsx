import { lazy, Suspense } from 'react';
import { Navigate, Route } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { ArenaLoader } from '../components/arena/ArenaLoader';
import { LEGACY_ONBOARDING_PATH, ONBOARDING_PATH } from '../lib/onboarding';
const OnboardingPage = lazy(() => import('./OnboardingPage'));

const onboardingRoutes = (
  <>
    <Route path={ONBOARDING_PATH} element={<ProtectedRoute onboarding><Suspense fallback={<ArenaLoader label="Wczytuję powitanie" />}><OnboardingPage /></Suspense></ProtectedRoute>} />
    <Route path={LEGACY_ONBOARDING_PATH} element={<Navigate to={ONBOARDING_PATH} replace />} />
  </>
);

export default onboardingRoutes;
