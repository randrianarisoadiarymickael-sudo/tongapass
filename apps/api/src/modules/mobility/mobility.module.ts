import { Module } from '@nestjs/common';
import { AccessProfilesModule } from '../access-profiles/access-profiles.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { MobilityController } from './mobility.controller';
import { MobilityService } from './mobility.service';

@Module({
  imports: [AccessProfilesModule, WorkflowsModule],
  controllers: [MobilityController],
  providers: [MobilityService],
})
export class MobilityModule {}
