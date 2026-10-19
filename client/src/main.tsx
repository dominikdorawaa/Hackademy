import { ClerkProvider } from '@clerk/react';
import { plPL } from '@clerk/localizations';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { dark } from '@clerk/themes';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import './index.css'
import './styles/landing-experience.css'
import App from './App'

const router = createBrowserRouter([{ path: '*', element: <App /> }]);

function ClerkApplication() {
  const { theme } = useTheme();
  return <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} localization={plPL}
    signInUrl="/login" signUpUrl="/register" signInForceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard" afterSignOutUrl="/"
    appearance={{ theme: theme === 'dark' ? dark : undefined, variables: { colorPrimary: '#3b82f6' }, elements: { rootBox: { width: '100%' }, cardBox: { width: '100%' } } }}>
    <RouterProvider router={router} />
  </ClerkProvider>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider><ClerkApplication /></ThemeProvider>
  </StrictMode>,
)
