import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HmacSignatureGuard } from '../../common/guards/hmac-signature.guard';
import { AutomationController } from './automation.controller';
import { N8nClient } from './n8n.client';
import { WorkflowRun } from './workflow-run.entity';
import { WorkflowRunsController } from './workflow-runs.controller';
import { WorkflowStep } from './workflow-step.entity';
import { WorkflowScheduler } from './workflow.scheduler';
import { WorkflowsService } from './workflows.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowRun, WorkflowStep])],
  controllers: [WorkflowRunsController, AutomationController],
  providers: [WorkflowsService, N8nClient, WorkflowScheduler, HmacSignatureGuard],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
