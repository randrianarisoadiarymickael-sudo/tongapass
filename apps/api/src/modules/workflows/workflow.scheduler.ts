import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WorkflowsService } from './workflows.service';

/** Planificateur : exécutions programmées, reprise sur incident et chien de garde. */
@Injectable()
export class WorkflowScheduler {
  private readonly logger = new Logger(WorkflowScheduler.name);
  private running = false;

  constructor(private readonly workflows: WorkflowsService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'workflow-tick', disabled: process.env.NODE_ENV === 'test' })
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const dispatched = await this.workflows.dispatchDueRuns();
      const resumed = await this.workflows.redispatchStuckRuns();
      const expired = await this.workflows.expireStaleRuns();
      if (dispatched || resumed || expired) {
        this.logger.log(
          `Planificateur : ${dispatched} exécution(s) planifiée(s) déclenchée(s), ${resumed} reprise(s), ${expired} expirée(s)`,
        );
      }
    } catch (error) {
      this.logger.error(`Planificateur en erreur : ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
