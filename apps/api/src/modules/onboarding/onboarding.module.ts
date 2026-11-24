import { Module } from '@nestjs/common';
import { AccessProfilesModule } from '../access-profiles/access-profiles.module';
import { EmployeesModule } from '../employees/employees.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [AccessProfilesModule, EmployeesModule, WorkflowsModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
