import { IconFlow, IconPerson, IconShieldCheck, type IconComponent } from '@/components/icons';
import type { LiveEntry } from '@/hooks/useLiveEvents';
import { EMPLOYEE_STATUS, RUN_STATUS, STEP_STATUS, SYSTEM_LABEL, type Tone } from './labels';
import type { EmployeeStatus, RunStatus, StepStatus, StepSystem } from './types';

interface Described {
  icon: IconComponent;
  title: string;
  detail: string;
  tone: Tone;
  to: string | null;
}

/** Traduit un événement SSE brut en phrase lisible. */
export function describeLiveEvent(event: LiveEntry): Described {
  const data = event.data as {
    runId?: string;
    employeeId?: string;
    status?: string;
    step?: string;
    detail?: string | null;
    scope?: string;
  };
  const to = data.runId ? `/executions/${data.runId}` : data.employeeId ? `/employes/${data.employeeId}` : null;
  if (event.type === 'step.updated') {
    const system = (data.step?.split('.')[0] ?? 'core') as StepSystem;
    const status = STEP_STATUS[(data.status ?? 'RUNNING') as StepStatus] ?? STEP_STATUS.RUNNING;
    return {
      icon: IconFlow,
      title: `Étape ${SYSTEM_LABEL[system] ?? system} · ${data.status === 'SUCCEEDED' ? 'terminée' : status.label.toLowerCase()}`,
      detail: data.detail || `Signal reçu de n8n (${data.step ?? 'étape'})`,
      tone: status.tone,
      to,
    };
  }
  if (event.type === 'run.updated') {
    const status = RUN_STATUS[(data.status ?? 'RUNNING') as RunStatus] ?? RUN_STATUS.RUNNING;
    return { icon: IconFlow, title: `Exécution ${status.label.toLowerCase()}`, detail: 'Workflow mis à jour par n8n', tone: status.tone, to };
  }
  if (event.type === 'employee.updated' && data.scope === 'compliance') {
    return { icon: IconShieldCheck, title: 'Contrôle de conformité', detail: 'Résultats mis à jour', tone: 'brand', to: '/conformite' };
  }
  const status = data.status ? EMPLOYEE_STATUS[data.status as EmployeeStatus] : undefined;
  return {
    icon: IconPerson,
    title: status ? `Statut du salarié · ${status.label.toLowerCase()}` : 'Fiche employé mise à jour',
    detail: 'Cycle de vie de l’employé',
    tone: status?.tone ?? 'neutral',
    to,
  };
}
