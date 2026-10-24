import { lazy, Suspense } from 'react';
import { LoadingRows } from '../../components/admin/AdminUi';
import { Navigate, Route } from 'react-router-dom';
import { AdminAccessRoute, AdminOnly } from './adminAccess';
import AdminLayout from './AdminLayout';
const DashboardPage = lazy(() => import('./DashboardPage'));
const UsersPage = lazy(() => import('./UsersPage'));
const BugReportsPage = lazy(() => import('./BugReportsPage'));
const RoomsPage = lazy(() => import('./RoomsPage'));
const RoomEditorPage = lazy(() => import('./RoomEditorPage'));
const PathsPage = lazy(() => import('./PathsPage'));
const PathEditorPage = lazy(() => import('./PathEditorPage'));
const ArenaQuestionsPage = lazy(() => import('./ArenaQuestionsPage'));
const RoomPage = lazy(() => import('../RoomPage'));
const PathDetailPage = lazy(() => import('../PathDetailPage'));

const adminRoutes = (
  <Route
    path="/admin"
    element={
      <AdminAccessRoute>
        <Suspense fallback={<LoadingRows label="Wczytuję panel" />}><AdminLayout /></Suspense>
      </AdminAccessRoute>
    }
  >
    <Route index element={<AdminOnly><DashboardPage /></AdminOnly>} />
    <Route path="users" element={<AdminOnly><UsersPage /></AdminOnly>} />
    <Route path="bug-reports" element={<AdminOnly><BugReportsPage /></AdminOnly>} />
    <Route path="arena/questions" element={<AdminOnly><ArenaQuestionsPage /></AdminOnly>} />
    <Route path="preview/rooms/:id" element={<RoomPage preview />} />
    <Route path="preview/paths/:id" element={<PathDetailPage preview />} />
    <Route path="paths" element={<PathsPage />} />
    <Route path="paths/rooms" element={<RoomsPage key="PATH" kind="PATH" />} />
    <Route path="paths/rooms/:roomId" element={<RoomEditorPage key="PATH" kind="PATH" />} />
    <Route path="paths/:pathId" element={<PathEditorPage />} />
    <Route path="ctf" element={<RoomsPage key="CTF" kind="CTF" />} />
    <Route path="ctf/:roomId" element={<RoomEditorPage key="CTF" kind="CTF" />} />
    <Route path="*" element={<Navigate to="/admin" replace />} />
  </Route>
);

export default adminRoutes;
