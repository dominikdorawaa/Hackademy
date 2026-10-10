import { Navigate, Route } from 'react-router-dom';
import { AdminAccessRoute, AdminOnly } from './adminAccess';
import AdminLayout from './AdminLayout';
import DashboardPage from './DashboardPage';
import UsersPage from './UsersPage';
import ReportsPage from './ReportsPage';
import RoomsPage from './RoomsPage';
import RoomEditorPage from './RoomEditorPage';
import PathsPage from './PathsPage';
import PathEditorPage from './PathEditorPage';

const adminRoutes = (
  <Route
    path="/admin"
    element={
      <AdminAccessRoute>
        <AdminLayout />
      </AdminAccessRoute>
    }
  >
    <Route index element={<AdminOnly><DashboardPage /></AdminOnly>} />
    <Route path="users" element={<AdminOnly><UsersPage /></AdminOnly>} />
    <Route path="reports" element={<AdminOnly><ReportsPage /></AdminOnly>} />
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
