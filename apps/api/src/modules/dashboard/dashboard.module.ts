import { Module } from '@nestjs/common';
import { ComplianceModule } from '../compliance/compliance.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [WorkflowsModule, ComplianceModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
