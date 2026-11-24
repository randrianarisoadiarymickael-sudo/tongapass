import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AccessCatalog,
  AccessProfile,
  AuditLog,
  ComplianceCheck,
  ComplianceOverview,
  MobilityPreview,
  DashboardSummary,
  EmployeeDetail,
  Employee,
  IntegrationStatus,
  IntegrityReport,
  OnboardingPreview,
  Paginated,
  RunDetail,
  RunSummary,
} from '@/lib/types';

export const keys = {
  dashboard: ['dashboard'] as const,
  employees: (params: object) => ['employees', params] as const,
  employee: (id: string) => ['employee', id] as const,
  departments: ['departments'] as const,
  runs: (params: object) => ['runs', params] as const,
  run: (id: string) => ['run', id] as const,
  profiles: (all: boolean) => ['profiles', all] as const,
  catalog: ['catalog'] as const,
  audit: (params: object) => ['audit', params] as const,
  integrations: ['integrations'] as const,
  compliance: ['compliance'] as const,
  employeeCompliance: (id: string) => ['employee-compliance', id] as const,
  history: (id: string, page: number) => ['employee-history', id, page] as const,
};

export const useDashboard = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: () => api.get<DashboardSummary>('/dashboard'), refetchInterval: 60_000 });

export interface EmployeeFilters {
  search?: string;
  status?: string[];
  department?: string;
  accessProfileId?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
}

export const useEmployees = (filters: EmployeeFilters) =>
  useQuery({
    queryKey: keys.employees(filters),
    queryFn: ({ signal }) => api.get<Paginated<Employee>>('/employees', { ...filters }, signal),
    placeholderData: keepPreviousData,
  });

export const useEmployee = (id: string) =>
  useQuery({ queryKey: keys.employee(id), queryFn: () => api.get<EmployeeDetail>(`/employees/${id}`) });

export const useDepartments = () =>
  useQuery({ queryKey: keys.departments, queryFn: () => api.get<string[]>('/employees/departments'), staleTime: 300_000 });

export const useRuns = (params: { type?: string; status?: string[]; page?: number; pageSize?: number }) =>
  useQuery({
    queryKey: keys.runs(params),
    queryFn: () => api.get<Paginated<RunSummary>>('/workflow-runs', params),
    placeholderData: keepPreviousData,
  });

export const useRun = (id: string) =>
  useQuery({
    queryKey: keys.run(id),
    queryFn: () => api.get<RunDetail>(`/workflow-runs/${id}`),
    refetchInterval: (query) => (['QUEUED', 'RUNNING'].includes(query.state.data?.status ?? '') ? 4000 : false),
  });

export const useProfiles = (includeInactive = false) =>
  useQuery({
    queryKey: keys.profiles(includeInactive),
    queryFn: () => api.get<AccessProfile[]>('/access-profiles', { includeInactive }),
    staleTime: 60_000,
  });

export const useCatalog = () =>
  useQuery({ queryKey: keys.catalog, queryFn: () => api.get<AccessCatalog>('/access-profiles/catalog'), staleTime: Infinity });

export interface AuditFilters {
  search?: string;
  action?: string;
  actorType?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export const useAudit = (filters: AuditFilters, enabled = true) =>
  useQuery({
    enabled,
    queryKey: keys.audit(filters),
    queryFn: () => api.get<Paginated<AuditLog>>('/audit-logs', { ...filters }),
    placeholderData: keepPreviousData,
  });

export const useIntegrity = () =>
  useMutation({ mutationFn: () => api.get<IntegrityReport>('/audit-logs/integrity') });

export const useIntegrations = (enabled = true) =>
  useQuery({
    enabled,
    queryKey: keys.integrations,
    queryFn: () => api.get<IntegrationStatus[]>('/health/integrations'),
    refetchInterval: 30_000,
  });

export const usePreviewOnboarding = () =>
  useMutation({
    mutationFn: (body: { firstName: string; lastName: string; accessProfileId: string; extraRealmRoles?: string[] }) =>
      api.post<OnboardingPreview>('/onboarding/preview', body),
  });

export function useCreateOnboarding() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: unknown; idempotencyKey: string }) =>
      api.post<RunSummary>('/onboarding', body, { 'Idempotency-Key': idempotencyKey }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['employees'] });
      void client.invalidateQueries({ queryKey: keys.dashboard });
      void client.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}

export function useCreateOffboarding() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post<RunSummary>('/offboarding', body),
    onSuccess: (run) => {
      void client.invalidateQueries({ queryKey: keys.employee(run.employee.id) });
      void client.invalidateQueries({ queryKey: ['employees'] });
      void client.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

export function useCancelOffboarding() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.post<RunSummary>(`/offboarding/${runId}/cancel`),
    onSuccess: (run) => {
      void client.invalidateQueries({ queryKey: keys.employee(run.employee.id) });
      void client.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

export function useRetryRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.post<RunDetail>(`/workflow-runs/${runId}/retry`),
    onSuccess: (run) => {
      void client.invalidateQueries({ queryKey: keys.employee(run.employee.id) });
      void client.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}

export function useUpdateEmployee(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Employee>) => api.patch<Employee>(`/employees/${id}`, body),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.employee(id) }),
  });
}

export function useSaveProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Partial<AccessProfile> }) =>
      id ? api.patch<AccessProfile>(`/access-profiles/${id}`, body) : api.post<AccessProfile>('/access-profiles', body),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['profiles'] }),
  });
}

export function useDeleteProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/access-profiles/${id}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['profiles'] }),
  });
}

// ---------------------------------------------------------------------------
// Planification : annuler / exécuter maintenant
// ---------------------------------------------------------------------------

export function useCancelRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.post<RunSummary>(`/workflow-runs/${runId}/cancel`),
    onSuccess: (run) => {
      void client.invalidateQueries({ queryKey: keys.run(run.id) });
      void client.invalidateQueries({ queryKey: keys.employee(run.employee.id) });
      void client.invalidateQueries({ queryKey: ['runs'] });
      void client.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

export function useRunNow() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.post<RunDetail>(`/workflow-runs/${runId}/run-now`),
    onSuccess: (run) => {
      void client.invalidateQueries({ queryKey: keys.employee(run.employee.id) });
      void client.invalidateQueries({ queryKey: keys.run(run.id) });
      void client.invalidateQueries({ queryKey: ['runs'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Mobilité
// ---------------------------------------------------------------------------

export const useMobilityPreview = (employeeId: string) =>
  useMutation({
    mutationFn: (body: { accessProfileId: string; extraRealmRoles?: string[] }) =>
      api.post<MobilityPreview>(`/employees/${employeeId}/mobility/preview`, body),
  });

export function useCreateMobility(employeeId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => api.post<RunSummary>(`/employees/${employeeId}/mobility`, body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.employee(employeeId) });
      void client.invalidateQueries({ queryKey: ['runs'] });
      void client.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

// ---------------------------------------------------------------------------
// Conformité et historique
// ---------------------------------------------------------------------------

export const useComplianceOverview = (enabled = true) =>
  useQuery({ enabled, queryKey: keys.compliance, queryFn: () => api.get<ComplianceOverview>('/compliance') });

export function useScanCompliance() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ total: number; counts: Record<string, number> }>('/compliance/scan'),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.compliance });
      void client.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

export const useEmployeeCompliance = (employeeId: string) =>
  useQuery({
    queryKey: keys.employeeCompliance(employeeId),
    queryFn: () => api.get<ComplianceCheck | null>(`/employees/${employeeId}/compliance`),
  });

export function useCheckCompliance(employeeId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ComplianceCheck>(`/employees/${employeeId}/compliance`),
    onSuccess: (check) => {
      client.setQueryData(keys.employeeCompliance(employeeId), check);
      void client.invalidateQueries({ queryKey: keys.compliance });
    },
  });
}

export const useEmployeeHistory = (employeeId: string, page: number, enabled = true) =>
  useQuery({
    enabled,
    queryKey: keys.history(employeeId, page),
    queryFn: () => api.get<Paginated<AuditLog>>(`/employees/${employeeId}/history`, { page, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });
