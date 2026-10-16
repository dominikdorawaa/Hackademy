import { Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import RealtimeGameNavigation from './components/RealtimeGameNavigation';
import { RealtimeProvider } from './context/RealtimeContext';
import { NotificationPreferencesProvider } from './context/NotificationPreferencesContext';
import RealtimeNotifications from './components/RealtimeNotifications';
import Footer from './components/Footer';
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
import VpnPage from './pages/VpnPage';
import SettingsPage from './pages/SettingsPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import adminRoutes from './pages/admin/adminRoutes';

const ArenaAvatarPage = lazy(() => import('./pages/ArenaAvatarPage'));
const ArenaBattlePage = lazy(() => import('./pages/ArenaBattlePage'));

function SiteLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <RealtimeGameNavigation />
      <RealtimeNotifications />
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <NotificationPreferencesProvider>
        <Routes>
          {adminRoutes}
          <Route element={<SiteLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/arena/avatar" element={<ProtectedRoute><Suspense fallback={<p role="status">Ładowanie kreatora…</p>}><ArenaAvatarPage /></Suspense></ProtectedRoute>} />

            <Route path="/arena/battle/:gameId" element={<ProtectedRoute><Suspense fallback={<p role="status">Wczytuję walkę…</p>}><ArenaBattlePage /></Suspense></ProtectedRoute>} />
            <Route
              path="/arena"
              element={
                <ProtectedRoute>
                  <ArenaPage />
                </ProtectedRoute>
              }
            />
            <Route path="/ranking" element={<RankingPage />} />
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
              path="/vpn"
              element={
                <ProtectedRoute>
                  <VpnPage />
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
          </Route>
        </Routes>
        </NotificationPreferencesProvider>
      </RealtimeProvider>
    </AuthProvider>
  );
}

export default App;
