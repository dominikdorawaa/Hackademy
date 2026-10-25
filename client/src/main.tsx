import { enableDeferredStyles } from './lib/deferredStyles';
import { ClerkProvider } from '@clerk/react';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { clerkAppearance } from './components/auth/clerkAppearance';
import { clerkLocalization } from './components/auth/clerkLocalization';
import './index.css'
import './styles/pixel.css'
import './styles/landing-experience.css'
import App from './App'
import AppErrorPage from './pages/AppErrorPage';
import { enableStaleChunkReload } from './lib/staleChunk';

enableDeferredStyles();
enableStaleChunkReload();

const router = createBrowserRouter([{ path: '*', element: <App />, errorElement: <AppErrorPage /> }]);

function ClerkApplication() {
  const { theme, reducedMotion } = useTheme();
  return <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} localization={clerkLocalization}
    signInUrl="/login" signUpUrl="/register" signInForceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard" afterSignOutUrl="/"
    appearance={clerkAppearance(theme, reducedMotion)}>
    <RouterProvider router={router} />
  </ClerkProvider>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider><ClerkApplication /></ThemeProvider>
  </StrictMode>,
)
