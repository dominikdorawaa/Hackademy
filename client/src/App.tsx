import { Routes, Route } from 'react-router-dom';
import SiteLayout from './components/SiteLayout';
import { AuthProvider } from './context/AuthContext';
import { OnboardingProvider } from './context/OnboardingContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { NotificationPreferencesProvider } from './context/NotificationPreferencesContext';
import { FriendOnlineFeedProvider } from './context/FriendOnlineFeedContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
const LearnPage = lazy(() => import('./pages/LearnPage'));
const UserDashboardPage = lazy(() => import('./pages/UserDashboardPage'));
const PathDetailPage = lazy(() => import('./pages/PathDetailPage'));
const ArenaPage = lazy(() => import('./pages/ArenaPage'));
import { lazy, Suspense } from 'react';
const RankingPage = lazy(() => import('./pages/RankingPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const RoomPage = lazy(() => import('./pages/RoomPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
import ProtectedRoute from './components/auth/ProtectedRoute';
import adminRoutes from './pages/admin/adminRoutes';
import NotFoundPage from './pages/NotFoundPage';
import { PrivacyPage, TermsPage } from './pages/LegalPages';
import { ArenaLoader } from './components/arena/ArenaLoader';

const UkosPage = lazy(() => import('./ukos/UkosPage'));
const ArenaAvatarPage = lazy(() => import('./pages/ArenaAvatarPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const ArenaBattlePage = lazy(() => import('./pages/ArenaBattlePage'));

function App() {
  return (
    <AuthProvider>
      <OnboardingProvider>
      <RealtimeProvider>
        <NotificationPreferencesProvider>
        <FriendOnlineFeedProvider>
        <Suspense fallback={<ArenaLoader label="Wczytuję aplikację" />}><Routes>
          {adminRoutes}
          <Route element={<SiteLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login/*" element={<LoginPage />} />
            <Route path="/register/*" element={<RegisterPage />} />
            <Route path="/witaj" element={<ProtectedRoute onboarding><Suspense fallback={<ArenaLoader label="Wczytuję powitanie" />}><OnboardingPage /></Suspense></ProtectedRoute>} />
            <Route path="/arena/avatar" element={<ProtectedRoute><Suspense fallback={<ArenaLoader label="Ładowanie kreatora awatara" />}><ArenaAvatarPage /></Suspense></ProtectedRoute>} />

            <Route path="/arena/battle/:gameId" element={<ProtectedRoute><Suspense fallback={<ArenaLoader label="Wczytuję walkę" />}><ArenaBattlePage /></Suspense></ProtectedRoute>} />
            <Route
              path="/arena"
              element={
                <ProtectedRoute>
                  <ArenaPage />
                </ProtectedRoute>
              }
            />
            <Route path="/learn/ukos" element={<ProtectedRoute><Suspense fallback={<ArenaLoader label="Ładowanie Dyżuru Zero" />}><UkosPage /></Suspense></ProtectedRoute>} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <UserDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/learn"
              element={
                <ProtectedRoute>
                  <LearnPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/learn/paths/:id"
              element={
                <ProtectedRoute>
                  <PathDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rooms/:id"
              element={
                <ProtectedRoute>
                  <RoomPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/:username"
              element={
                <ProtectedRoute>
                  <PublicProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/friends"
              element={
                <ProtectedRoute>
                  <FriendsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes></Suspense>
        </FriendOnlineFeedProvider>
        </NotificationPreferencesProvider>
      </RealtimeProvider>
      </OnboardingProvider>
    </AuthProvider>
  );
}

export default App;
