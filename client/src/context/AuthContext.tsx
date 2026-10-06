import { createContext, useState, useContext, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

import type { PropsWithChildren } from 'react';
import type { JwtPayload } from 'jwt-decode';

export interface AuthUser extends JwtPayload {
  sub: string;
  roles: string[];
}

export interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  login: (newToken: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        const decodedUser = jwtDecode<AuthUser>(storedToken);
        setUser(decodedUser);
        setToken(storedToken);
      }
    } catch (error) {
      console.error("Failed to process token from localStorage:", error);

      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (newToken: string) => {
    try {
      const decodedUser = jwtDecode<AuthUser>(newToken);
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(decodedUser);
    } catch (error) {
      console.error("Failed to set item in localStorage or decode token:", error);
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error("Failed to remove item from localStorage:", error);
    }
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};