import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getCurrentUser } from '../../services/userApi';
import type { Role } from '../../types/api';

export type PanelRole = Extract<Role, 'ADMIN' | 'EXPERT'>;

interface AdminAccess {
  role: PanelRole;
  username: string;
  isAdmin: boolean;
}

const AdminAccessContext = createContext<AdminAccess | null>(null);

export function useAdminAccess() {
  const access = useContext(AdminAccessContext);
  if (!access) {
    throw new Error('useAdminAccess must be used inside AdminAccessRoute');
  }
  return access;
}

type AccessState =
  | { token: string | null; status: 'checking' }
  | { token: string | null; status: 'denied' | 'error' }
  | { token: string | null; status: 'allowed'; role: PanelRole; username: string };

export function AdminAccessRoute({ children }: PropsWithChildren) {
  const { isAuthenticated, token, loading } = useAuth();
  const [access, setAccess] = useState<AccessState>({ token: null, status: 'checking' });

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const controller = new AbortController();

    getCurrentUser({ Authorization: `Bearer ${token}` }, controller.signal)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((currentUser) => {
        if (currentUser.role === 'ADMIN' || currentUser.role === 'EXPERT') {
          setAccess({ token, status: 'allowed', role: currentUser.role, username: currentUser.username });
        } else {
          setAccess({ token, status: 'denied' });
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          setAccess({ token, status: 'error' });
        }
      });

    return () => controller.abort();
  }, [isAuthenticated, token]);

  if (loading || (isAuthenticated && (access.token !== token || access.status === 'checking'))) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Sprawdzanie uprawnień…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (access.status === 'error') {
    return (
      <div role="alert" className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-sm text-foreground">
        Nie udało się sprawdzić uprawnień. Odśwież stronę i spróbuj ponownie.
      </div>
    );
  }

  if (access.status !== 'allowed') {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminAccessContext.Provider value={{ role: access.role, username: access.username, isAdmin: access.role === 'ADMIN' }}>
      {children}
    </AdminAccessContext.Provider>
  );
}

export function AdminOnly({ children }: PropsWithChildren) {
  const { isAdmin } = useAdminAccess();
  if (!isAdmin) {
    return <Navigate to="/admin/paths" replace />;
  }
  return <>{children}</>;
}
