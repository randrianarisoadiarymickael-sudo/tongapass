import { RunStatus, StepStatus } from '../../common/enums';

export interface StepOutcome {
  status: StepStatus;
  critical: boolean;
}

/**
 * Statut final d'une exécution à partir de ses étapes :
 * - une étape critique en échec → FAILED ;
 * - une étape secondaire en échec → PARTIAL (accès à vérifier) ;
 * - sinon → SUCCEEDED.
 */
export function computeFinalStatus(steps: StepOutcome[]): RunStatus {
  if (steps.some((step) => step.critical && step.status === StepStatus.FAILED)) return RunStatus.FAILED;
  if (steps.some((step) => step.status === StepStatus.FAILED)) return RunStatus.PARTIAL;
  if (steps.length > 0 && steps.every((step) => step.status === StepStatus.SKIPPED)) return RunStatus.FAILED;
  return RunStatus.SUCCEEDED;
}

export function stepProgress(steps: { status: StepStatus }[]): { done: number; total: number } {
  const done = steps.filter((step) => step.status !== StepStatus.PENDING && step.status !== StepStatus.RUNNING).length;
  return { done, total: steps.length };
}
