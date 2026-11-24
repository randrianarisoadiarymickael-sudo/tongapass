import { RunStatus, StepStatus } from '../../common/enums';
import { computeFinalStatus, stepProgress } from './run-status.util';

const step = (status: StepStatus, critical = false) => ({ status, critical });

describe('computeFinalStatus', () => {
  it('SUCCEEDED quand tout réussit (les étapes ignorées sont tolérées)', () => {
    expect(computeFinalStatus([step(StepStatus.SUCCEEDED, true), step(StepStatus.SKIPPED)])).toBe(RunStatus.SUCCEEDED);
  });

  it('FAILED si une étape critique échoue', () => {
    expect(computeFinalStatus([step(StepStatus.FAILED, true), step(StepStatus.SUCCEEDED)])).toBe(RunStatus.FAILED);
  });

  it('PARTIAL si seule une étape secondaire échoue', () => {
    expect(computeFinalStatus([step(StepStatus.SUCCEEDED, true), step(StepStatus.FAILED)])).toBe(RunStatus.PARTIAL);
  });

  it("FAILED si rien n'a été exécuté", () => {
    expect(computeFinalStatus([step(StepStatus.SKIPPED), step(StepStatus.SKIPPED)])).toBe(RunStatus.FAILED);
  });
});

describe('stepProgress', () => {
  it('compte les étapes terminées', () => {
    expect(
      stepProgress([{ status: StepStatus.SUCCEEDED }, { status: StepStatus.RUNNING }, { status: StepStatus.PENDING }]),
    ).toEqual({ done: 1, total: 3 });
  });
});
