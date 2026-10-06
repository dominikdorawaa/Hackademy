import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import LearnPage from './pages/LearnPage';
import UserDashboardPage from './pages/UserDashboardPage';
import PathDetailPage from './pages/PathDetailPage';
import ArenaPage from './pages/ArenaPage';
import RankingPage from './pages/RankingPage';
import AdminPage from './pages/AdminPage';
import ExpertPage from './pages/ExpertPage';
import ProfilePage from './pages/ProfilePage';
import PublicProfilePage from './pages/PublicProfilePage';
import FriendsPage from './pages/FriendsPage';
import RoomPage from './pages/RoomPage';
import VpnPage from './pages/VpnPage';
import SettingsPage from './pages/SettingsPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import ExpertRoute from './components/auth/ExpertRoute';

function App() {
  return (
    <AuthProvider>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
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
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
            <Route
              path="/expert"
              element={
                <ExpertRoute>
                  <ExpertPage />
                </ExpertRoute>
              }
            />
          </Routes>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}

export default App;
