import { Route, Routes } from 'react-router';
import { useAuth } from '@/auth/AuthProvider';
import { AppShell } from '@/components/layout/AppShell';
import { AccessProfilesPage } from '@/pages/AccessProfilesPage';
import { AuditPage } from '@/pages/AuditPage';
import { CompliancePage } from '@/pages/CompliancePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { EmployeeDetailPage } from '@/pages/EmployeeDetailPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { IntegrationsPage } from '@/pages/IntegrationsPage';
import { LandingPage } from '@/pages/LandingPage';
import { OnboardingWizardPage } from '@/pages/OnboardingWizardPage';
import { RunDetailPage } from '@/pages/RunDetailPage';
import { RunsPage } from '@/pages/RunsPage';
import { ErrorScreen, ForbiddenScreen, LoadingScreen, NotFoundPage } from '@/pages/StatusScreens';

export function App() {
  const { state } = useAuth();

  switch (state.status) {
    case 'loading':
      return <LoadingScreen />;
    case 'anonymous':
      return <LandingPage />;
    case 'forbidden':
      return <ForbiddenScreen username={state.username} />;
    case 'error':
      return <ErrorScreen message={state.message} />;
    case 'authenticated':
      return (
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="employes" element={<EmployeesPage />} />
            <Route path="employes/:id" element={<EmployeeDetailPage />} />
            <Route path="arrivees/nouvelle" element={<OnboardingWizardPage />} />
            <Route path="executions" element={<RunsPage />} />
            <Route path="executions/:id" element={<RunDetailPage />} />
            <Route path="profils" element={<AccessProfilesPage />} />
            <Route path="conformite" element={<CompliancePage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      );
  }
}
