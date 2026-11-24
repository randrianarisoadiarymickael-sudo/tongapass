import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/index.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Toaster } from 'sonner';
import { App } from './App';
import { IconAlert, IconCheck, IconPulse, IconShieldAlert } from './components/icons';
import { Spinner } from './components/ui/Spinner';
import { AuthProvider } from './auth/AuthProvider';
import { applyTheme } from './hooks/useTheme';
import { ApiError } from './lib/api';

applyTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => !(error instanceof ApiError && [400, 401, 403, 404].includes(error.status)) && count < 2,
    },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
      <Toaster
        position="bottom-right"
        closeButton
        gap={8}
        toastOptions={{ className: 'tp-toast', duration: 5000 }}
        icons={{
          success: <IconCheck className="size-[18px]" strokeWidth={2.4} />,
          error: <IconShieldAlert className="size-[18px]" />,
          warning: <IconAlert className="size-[18px]" />,
          info: <IconPulse className="size-[18px]" />,
          loading: <Spinner />,
        }}
        containerAriaLabel="Notifications"
      />
    </QueryClientProvider>
  </StrictMode>,
);
