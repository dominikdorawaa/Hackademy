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
import LearnPage from './pages/LearnPage';
import UserDashboardPage from './pages/UserDashboardPage';
import PathDetailPage from './pages/PathDetailPage';
import ArenaPage from './pages/ArenaPage';
import { lazy, Suspense } from 'react';
import RankingPage from './pages/RankingPage';
import ProfilePage from './pages/ProfilePage';
import PublicProfilePage from './pages/PublicProfilePage';
import FriendsPage from './pages/FriendsPage';
import RoomPage from './pages/RoomPage';
import SettingsPage from './pages/SettingsPage';
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
        <Routes>
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
        </Routes>
        </FriendOnlineFeedProvider>
        </NotificationPreferencesProvider>
      </RealtimeProvider>
      </OnboardingProvider>
    </AuthProvider>
  );
}

export default App;
