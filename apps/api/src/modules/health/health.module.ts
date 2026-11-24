import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [IntegrationsService],
})
export class HealthModule {}
