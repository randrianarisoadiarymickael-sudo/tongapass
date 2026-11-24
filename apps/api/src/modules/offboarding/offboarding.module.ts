import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { OffboardingController } from './offboarding.controller';
import { OffboardingService } from './offboarding.service';

@Module({
  imports: [EmployeesModule, WorkflowsModule],
  controllers: [OffboardingController],
  providers: [OffboardingService],
})
export class OffboardingModule {}
